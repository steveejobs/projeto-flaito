import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateWorkerRequest,
  buildUserContext,
  buildWorkerContext,
  buildDelegatedStorageContext,
  logExecutionContext,
  TrustContext,
} from "../_shared/execution-context.ts";

// ============================================================
// CORS — Restricted to known origins only (never wildcard)
// ============================================================
const ALLOWED_ORIGINS = [
  "https://app.flaito.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin  = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

// ============================================================
// EXPLICIT ACTION ALLOWLIST — Stage 10 Trust Boundary
//
// USER_ACTIONS:   require JWT, run under user context with RLS
// WORKER_ACTIONS: require x-worker-secret, REJECT user JWT
// OPERATOR_ACTIONS: handled by session-admin-actions endpoint
// ============================================================
const USER_ACTIONS   = new Set([
  "ingest_chunk",
  "finalize_session",
  "transcribe_session",
  "create_snapshot",
  "generate_legal_output",
  "generate_medical_output",
  "log_medical_review",
  "certify_medical_output",
]);
const WORKER_ACTIONS = new Set(["process_job"]);

// ============================================================
// CLIENT FACTORIES
// ============================================================

function createUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw Object.assign(new Error("UNAUTHORIZED: Missing or invalid Authorization header"), { status: 401 });
  }
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
}

// workerClient: service_role — for exclusive use in worker and controlled delegated writes
const workerClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

// ============================================================
// CANONICAL HASHING (deterministic, strips volatile fields)
// ============================================================
function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + (obj as unknown[]).map(canonicalStringify).join(",") + "]";
  const keys = Object.keys(obj as object).sort();
  return "{" + keys
    .filter(k => !["created_at","updated_at","id","attempt_count","worker_id","lease_expires_at"].includes(k))
    .map(k => `"${k}":${canonicalStringify((obj as Record<string,unknown>)[k])}`)
    .join(",") + "}";
}

async function computeHash(input: string | Uint8Array | ArrayBuffer): Promise<string> {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================
// SECURITY: Assert session ownership via user client
// ============================================================
async function assertSessionOwnership(
  userClient: SupabaseClient,
  sessionId: string
): Promise<{ session: Record<string,unknown>; userId: string; officeId: string }> {
  const { data: user, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user?.user) {
    throw Object.assign(new Error("UNAUTHORIZED: Token validation failed"), { status: 401 });
  }

  const { data: session, error: sessionErr } = await userClient
    .from("sessions")
    .select("id, office_id, status")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    throw Object.assign(
      new Error(`FORBIDDEN: Session ${sessionId} not accessible. Either it does not exist or you lack permission.`),
      { status: 403 }
    );
  }

  return { session, userId: user.user.id, officeId: session.office_id as string };
}

// ============================================================
// SECURITY: Assert job payload ownership (worker context)
// ============================================================
async function assertJobPayloadOwnership(job: Record<string,unknown>): Promise<void> {
  const sessionId = job.session_id as string;
  const officeId  = job.office_id  as string;
  const config    = (job.config_json ?? {}) as Record<string,unknown>;
  const snapshotId      = config.snapshot_id      as string | undefined;
  const transcriptionId = config.transcription_id as string | undefined;

  const { data: sess } = await workerClient
    .from("sessions")
    .select("id, office_id")
    .eq("id", sessionId)
    .single();

  if (!sess || sess.office_id !== officeId) {
    throw new Error(
      `CROSS_TENANT_VIOLATION: Job office_id (${officeId}) does not match session ${sessionId} office (${sess?.office_id ?? "not found"})`
    );
  }

  if (snapshotId) {
    const { data: snap } = await workerClient
      .from("session_processing_snapshots")
      .select("session_id")
      .eq("id", snapshotId)
      .single();

    if (!snap || snap.session_id !== sessionId) {
      throw new Error(
        `CROSS_TENANT_VIOLATION: snapshot ${snapshotId} does not belong to session ${sessionId}`
      );
    }
  }

  if (transcriptionId) {
    const { data: trans } = await workerClient
      .from("session_transcriptions")
      .select("session_id")
      .eq("id", transcriptionId)
      .single();

    if (!trans || trans.session_id !== sessionId) {
      throw new Error(
        `CROSS_TENANT_VIOLATION: transcription ${transcriptionId} does not belong to session ${sessionId}`
      );
    }
  }
}

// ============================================================
// FSM TRANSITION HELPER — Stage 11 aligned
// ============================================================
async function transitionSession(
  client: SupabaseClient,
  sessionId: string,
  targetStatus: string,
  targetStep?: string | null,
  reason?: string,
  metadata?: unknown,
  callerOfficeId?: string,
  executionContext: string = "system"
) {
  const { error } = await client.rpc("transition_session_fsm", {
    p_session_id:        sessionId,
    p_target_status:     targetStatus,
    p_target_step:       targetStep         ?? null,
    p_reason:            reason             ?? null,
    p_metadata:          metadata           ?? null,
    p_caller_office_id:  callerOfficeId     ?? null,
    p_execution_context: executionContext,
  });
  if (error) throw new Error(`FSM_TRANSITION_ERROR: ${error.message} (Target: ${targetStatus})`);
}

// ============================================================
// JOB ENQUEUEING HELPER
// ============================================================
async function enqueueJob(
  client: SupabaseClient,
  sessionId: string,
  officeId: string,
  type: string,
  idempotencyKey: string,
  config: unknown = {},
  priority: number = 0
) {
  const { data: job, error } = await client.from("session_jobs").insert({
    session_id:      sessionId,
    office_id:       officeId,
    job_type:        type,
    idempotency_key: idempotencyKey,
    config_json:     config,
    priority,
    status: "queued",
  }).select().single();

  // 23505 = unique_violation (idempotency key already exists — safe to ignore)
  if (error && error.code !== "23505") {
    throw error;
  }
  return job;
}

// ============================================================
// Stage 11: RETRY CLASSIFICATION
// Non-retryable errors must never be blindly retried.
// They signal stale context, security violations, or domain gates.
// ============================================================
const NON_RETRYABLE_PREFIXES = [
  "CROSS_TENANT_VIOLATION",
  "SNAPSHOT_NOT_FOUND",
  "REQUIRED_CONTEXT_MISSING",
  "PROHIBITED_GENERATION",
  "PROHIBITED_STALE_CERTIFICATION",
  "INTEGRITY_MISMATCH",
  "CHUNKS_NOT_FOUND",
  "INVALID_FSM_TRANSITION",
  "SESSION_NOT_FOUND",
  "ACCESS_DENIED",
  "WORKER_SECURITY_ERROR",
];

function isRetryable(errorMessage: string): boolean {
  return !NON_RETRYABLE_PREFIXES.some(prefix => errorMessage.startsWith(prefix));
}

// ============================================================
// Stage 12: RATE LIMIT HELPER (fail-open)
// ============================================================
async function enforceRateLimit(
  scopeType: string,
  scopeId:   string,
  action:    string,
  limit:     number,
  windowMin: number = 1
): Promise<{ allowed: boolean; blocked_until?: string; degraded?: boolean }> {
  try {
    const { data, error } = await workerClient.rpc("check_and_increment_rate_limit", {
      p_scope_type:       scopeType,
      p_scope_id:         scopeId,
      p_action:           action,
      p_limit_per_window: limit,
      p_window_minutes:   windowMin,
    });
    if (error) {
      console.warn(`[RateLimit] RATE_LIMIT_SYSTEM_DEGRADED: ${error.message}`);
      return { allowed: true, degraded: true };
    }
    return data as { allowed: boolean; blocked_until?: string; degraded?: boolean };
  } catch (err) {
    console.warn(`[RateLimit] RATE_LIMIT_SYSTEM_DEGRADED: ${(err as Error).message}`);
    return { allowed: true, degraded: true };
  }
}

// ============================================================
// Stage 12: AI BUDGET HELPER (fail-open on system errors)
// ============================================================
async function enforceAiBudget(
  officeId:        string,
  estimatedTokens: number,
  jobType:         string,
  isCritical:      boolean = false
): Promise<{ allowed: boolean; reason?: string; pct_used?: number }> {
  try {
    const { data, error } = await workerClient.rpc("check_and_charge_ai_budget", {
      p_office_id:        officeId,
      p_estimated_tokens: estimatedTokens,
      p_job_type:         jobType,
      p_is_critical:      isCritical,
    });
    if (error) {
      console.warn(`[AiBudget] AI_BUDGET_SYSTEM_ERROR: ${error.message}`);
      return { allowed: true };  // fail-open
    }
    const result = data as Record<string, unknown>;
    if (result.warning === "BUDGET_WARNING") {
      console.warn(`[AiBudget] Office ${officeId} at ${result.pct_used}% of daily budget — rate limits will be reduced`);
    }
    return { allowed: result.allowed as boolean, reason: result.reason as string, pct_used: result.pct_used as number };
  } catch (err) {
    console.warn(`[AiBudget] AI_BUDGET_SYSTEM_ERROR: ${(err as Error).message}`);
    return { allowed: true };  // fail-open
  }
}

// ============================================================
// Stage 16: PRE-EXECUTION CONTROLS (HARDENED)
// ============================================================

/**
 * Heuristic token estimation (Stage 16)
 * In production, this could result in a WASM tiktoken port.
 */
function estimateTokens(jobType: string, activeJob: any): number {
  switch (jobType) {
    case "TRANSCRIBE":      return 500;
    case "ANALYZE_LEGAL":   return 4000;
    case "ANALYZE_MEDICAL": return 2500;
    default:                return 1000;
  }
}

async function checkRerunGuard(sessionId: string, snapshotHash: string): Promise<{allowed: boolean, reason?: string}> {
  try {
    const { data, error } = await workerClient.rpc("check_rerun_loop_guard", {
      p_session_id: sessionId,
      p_snapshot_hash: snapshotHash
    });
    if (error) return { allowed: true }; 
    const res = data as any[];
    return { allowed: res[0].allowed, reason: res[0].reason };
  } catch {
    return { allowed: true }; 
  }
}

async function getPreExecutionVerdict(jobId: string, tokens: number): Promise<{allowed: boolean, decision: string, cost: number, reason?: string}> {
  try {
    const { data, error } = await workerClient.rpc("get_pre_execution_verdict", {
      p_job_id: jobId,
      p_estimated_tokens: tokens
    });
    if (error) return { allowed: true, decision: 'execute', cost: 0 }; 
    const res = data as any[];
    return { 
      allowed: res[0].allowed, 
      decision: res[0].decision_taken, 
      cost: res[0].estimated_cost_usd,
      reason: res[0].reason 
    };
  } catch {
    return { allowed: true, decision: 'execute', cost: 0 };
  }
}

async function getAdaptiveModelTier(officeId: string, jobType: string, decision: string): Promise<string> {
  try {
    const { data, error } = await workerClient.rpc('get_adaptive_model_tier', {
       p_office_id: officeId,
       p_job_type: jobType,
       p_decision_taken: decision
    });
    if (error || !data) return (jobType.startsWith("ANALYZE_")) ? "gpt-4o" : "gpt-4o-mini";
    return data as string;
  } catch {
    return (jobType.startsWith("ANALYZE_")) ? "gpt-4o" : "gpt-4o-mini";
  }
}

async function lookupSmartDedup(officeId: string, snapshotHash: string, jobType: string): Promise<{found: boolean, output_id?: string}> {
  try {
    const { data, error } = await workerClient.rpc('lookup_smart_dedup', {
      p_office_id: officeId,
      p_snapshot_hash: snapshotHash,
      p_job_type: jobType
    });
    if (error || !data || (data as any[]).length === 0) return { found: false };
    const res = data as any[];
    return { found: res[0].found, output_id: res[0].existing_output_id };
  } catch {
    return { found: false };
  }
}

async function checkTokenRateLimit(officeId: string, tokens: number): Promise<{allowed: boolean, current: number, limit: number}> {
  try {
    const { data, error } = await workerClient.rpc('check_token_rate_limit', {
      p_office_id: officeId,
      p_estimated_tokens: tokens
    });
    if (error || !data || (data as any[]).length === 0) return { allowed: true, current: 0, limit: 100000 };
    const res = data as any[];
    return { allowed: res[0].allowed, current: res[0].current_tpm, limit: res[0].limit_tpm };
  } catch {
    return { allowed: true, current: 0, limit: 100000 };
  }
}

// ============================================================
// Stage 12: KILL-SWITCH CHECK HELPER
// ============================================================
async function isKillSwitchActive(
  switchType: string,
  scopeId?:   string
): Promise<boolean> {
  try {
    const { data, error } = await workerClient.rpc("is_kill_switch_active", {
      p_switch_type: switchType,
      p_scope_id:    scopeId ?? null,
    });
    if (error) return false;  // fail-open: don't block if system is degraded
    return data as boolean;
  } catch {
    return false;  // fail-open
  }
}

// ============================================================
// Stage 11: ADAPTIVE LEASE DURATION BY JOB TYPE
// TRANSCRIBE: 20 min (long-running audio → Deepgram)
// ANALYZE_*:  10 min (LLM calls)
// Others:      5 min (fast DB operations)
// ============================================================
function leaseDurationForJobType(jobType: string): string {
  switch (jobType) {
    case "TRANSCRIBE":      return "20 minutes";
    case "ANALYZE_LEGAL":
    case "ANALYZE_MEDICAL": return "10 minutes";
    default:               return "5 minutes";
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================
const OPENAI_MODEL      = "gpt-4o";
const DEEPGRAM_API_URL  = "https://api.deepgram.com/v1/listen";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url    = new URL(req.url);
    const action = url.searchParams.get("action");

    if (!action) {
      throw Object.assign(new Error("MISSING_ACTION"), { status: 400 });
    }

    // ----------------------------------------------------------
    // ACTION ALLOWLIST — Reject unknown actions immediately
    // ----------------------------------------------------------
    if (!USER_ACTIONS.has(action) && !WORKER_ACTIONS.has(action)) {
      throw Object.assign(
        new Error(`UNKNOWN_ACTION: "${action}" is not a recognized action`),
        { status: 400 }
      );
    }

    // ==========================================================
    // WORKER: PROCESS JOB — Stage 11 Job Integrity
    //
    // NEW in Stage 11:
    //   - Adaptive lease duration by job type (passed to claim_session_job)
    //   - Heartbeat loop (25s interval, renews lease by 60s)
    //   - side_effect_confirmed marking before external API calls
    //   - Retry classification: retryable vs non-retryable
    //   - Chain failure compensation (compensating FSM state)
    // ==========================================================
    if (action === "process_job") {
      const workerAuth = authenticateWorkerRequest(req);

      if (!workerAuth.ok) {
        const statusCode =
          workerAuth.code === "USER_JWT_ON_WORKER_ROUTE" ? 403 :
          workerAuth.code === "TIMESTAMP_EXPIRED"        ? 429 : 401;

        console.error(`[session-processor] Worker auth failed: ${workerAuth.error}`);
        return new Response(
          JSON.stringify({ error: workerAuth.error, code: workerAuth.code }),
          { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const worker_id = workerAuth.worker_id!;
      const startTime = Date.now();

      // Stage 11: Claim with a default 5-min lease; will be reviewed per job type below
      const { data: job, error: claimErr } = await workerClient.rpc("claim_session_job", {
        p_worker_id:      worker_id,
        p_worker_type:    "CPU",
        p_max_jobs:       1,
        p_lease_duration: "5 minutes",
      });

      if (claimErr || !job || job.length === 0) {
        return new Response(
          JSON.stringify({ ok: true, message: "NO_JOBS_CLAIMED", error: claimErr }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const activeJob = job[0] as Record<string,unknown>;
      const sessionId = activeJob.session_id as string;
      const officeId  = activeJob.office_id  as string;
      const jobType   = activeJob.job_type   as string;

      // Stage 11: Immediately extend lease to adaptive duration for this job type
      // (The claim gave default 5 min; we upgrade to the proper duration)
      const adaptiveLease = leaseDurationForJobType(jobType);
      await workerClient.rpc("renew_job_lease", {
        p_job_id:    activeJob.id,
        p_worker_id: worker_id,
        p_extend_s:  jobType === "TRANSCRIBE" ? 1200 : jobType.startsWith("ANALYZE_") ? 600 : 300,
      });

      // Build and log worker trust context
      const workerCtx = buildWorkerContext(
        worker_id,
        officeId,
        undefined,
        req.headers.get("x-trace-id") ?? undefined
      );
      await logExecutionContext(workerClient, workerCtx, "session-processor", `process_job:${jobType}`);

      // Stage 11: Heartbeat loop — renew lease every 25 seconds while job runs.
      // Stage 12: Also checks kill-switches in heartbeat to catch in-flight execution.
      // clearInterval MUST be called in finally to avoid dangling timer.
      let heartbeatActive = true;
      const heartbeatTimer = setInterval(async () => {
        if (!heartbeatActive) return;
        const { data: renewed } = await workerClient.rpc("renew_job_lease", {
          p_job_id:    activeJob.id,
          p_worker_id: worker_id,
          p_extend_s:  60,
        });
        if (!renewed) {
          console.warn(`[Heartbeat] Lease renewal FAILED for job ${activeJob.id} — job may have been reclaimed by janitor`);
          heartbeatActive = false;
          return;
        }
        // Stage 12: Check kill-switch at each heartbeat (catches in-flight activation)
        const ksActive = await isKillSwitchActive("session_processing", activeJob.office_id as string)
          || await isKillSwitchActive("worker_drain");
        if (ksActive) {
          console.error(`[Heartbeat] KILL_SWITCH detected for job ${activeJob.id} — stopping heartbeat and aborting`);
          heartbeatActive = false;  // Worker will fail naturally on next operation check
        } else {
          console.log(`[Heartbeat] Job ${activeJob.id} lease renewed.`);
        }
      }, 25_000);

      try {
        // SECURITY: Validate job payload ownership before any processing
        await assertJobPayloadOwnership(activeJob);

        // ── Stage 12: Kill-switch — session_processing per office ──
        const sessionKillActive = await isKillSwitchActive("session_processing", officeId);
        if (sessionKillActive) {
          console.error(`[KillSwitch] session_processing is active for office ${officeId} — rejecting job ${activeJob.id}`);
          throw Object.assign(
            new Error(`KILL_SWITCH_ACTIVE: session_processing is blocking execution for office ${officeId}`),
            { status: 503 }
          );
        }

        // ── Stage 16: Hardened Pre-Execution Guard ──
        if (["TRANSCRIBE", "ANALYZE_LEGAL", "ANALYZE_MEDICAL"].includes(jobType)) {
          const estimatedTokens = estimateTokens(jobType, activeJob);
          
          // 1. Rerun Loop Guard (for Analysis jobs)
          if (jobType.startsWith("ANALYZE_")) {
            const snapshotId = (activeJob.config_json as any)?.snapshot_id;
            if (snapshotId) {
              const { data: snap } = await workerClient.from("session_processing_snapshots").select("snapshot_hash").eq("id", snapshotId).single();
              if (snap) {
                const guard = await checkRerunGuard(sessionId, snap.snapshot_hash);
                if (!guard.allowed) {
                  throw Object.assign(new Error(`RERUN_LOOP_DETECTED: ${guard.reason}`), { status: 429 });
                }
              }
            }
          }

          // 2. Cost Visibility & Budget Verdict
          const verdict = await getPreExecutionVerdict(activeJob.id as string, estimatedTokens);
          
          // Persist verdict metadata
          await workerClient.from("session_jobs").update({
            estimated_cost_usd: verdict.cost,
            decision_taken:     verdict.decision,
            token_estimate:     estimatedTokens
          }).eq("id", activeJob.id);

          if (!verdict.allowed) {
            console.error(`[CostControl] BUDGET_EXHAUSTED for office ${officeId}: ${verdict.reason}`);
            throw Object.assign(
              new Error(`BUDGET_EXHAUSTED: AI execution blocked by financial guard. Reason: ${verdict.reason}`),
              { status: 429 }
            );
          }

          if (verdict.decision === 'degrade') {
             console.warn(`[CostControl] Office ${officeId} in WARNING mode — degrading to balanced model tier.`);
          }

          // 2.5 Temporal Rate Limit (TPM)
          const rateLimit = await checkTokenRateLimit(officeId, estimatedTokens);
          if (!rateLimit.allowed) {
            console.error(`[RateLimit] TPM_EXHAUSTED for office ${officeId}: ${rateLimit.current}/${rateLimit.limit} tokens.`);
            throw Object.assign(
              new Error(`RATE_LIMIT_EXCEEDED: Daily tokens-per-minute limit reached (${rateLimit.limit} TPM). Try again in a minute.`),
              { status: 429 }
            );
          }

          // 3. Smart Deduplication Check (Bypass cost/latency if already processed)
          if (["ANALYZE_LEGAL", "ANALYZE_MEDICAL"].includes(jobType)) {
            const snapshotId = (activeJob.config_json as any)?.snapshot_id;
            if (snapshotId) {
              const { data: snap } = await workerClient.from("session_processing_snapshots").select("snapshot_hash").eq("id", snapshotId).single();
              if (snap) {
                const dedup = await lookupSmartDedup(officeId, snap.snapshot_hash, jobType);
                if (dedup.found) {
                  console.log(`[SmartDedup] Match found for hash ${snap.snapshot_hash.substring(0,8)}. Reusing output ${dedup.output_id}.`);
                  
                  await workerClient.from("session_jobs").update({
                    status:    "succeeded",
                    dedup_hit: true,
                    decision_taken: "execute" // Overwrite if it was 'degrade' since it's free now
                  }).eq("id", activeJob.id);

                  await transitionSession(
                    workerClient, sessionId, "outputs_generated", "none",
                    `${jobType} result reused via Smart Deduplication.`, null, officeId, "worker"
                  );

                  return new Response(JSON.stringify({ ok: true, job_id: activeJob.id, dedup: true, output_id: dedup.output_id }), { headers: corsHeaders });
                }
              }
            }
          }
        }

        await workerClient
          .from("session_jobs")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("id", activeJob.id);

        let selectedModel = (["TRANSCRIBE", "ANALYZE_LEGAL", "ANALYZE_MEDICAL"].includes(jobType))
          ? await getAdaptiveModelTier(officeId, jobType, (activeJob as any).decision_taken || 'execute')
          : "gpt-4o-mini";

        let result: unknown = null;
        if      (jobType === "TRANSCRIBE")      result = await handleTranscription(activeJob, worker_id);
        else if (jobType === "INGEST")          result = await handleContextIngestion(activeJob, worker_id);
        else if (jobType === "SNAPSHOT")        result = await handleSnapshotCreation(activeJob, worker_id);
        else if (jobType === "ANALYZE_LEGAL")   result = await handleDomainAnalysis(activeJob, "legal", worker_id, selectedModel); 
        else if (jobType === "ANALYZE_MEDICAL") result = await handleDomainAnalysis(activeJob, "medical", worker_id, selectedModel); 

        const duration = Date.now() - startTime;
        await workerClient.from("session_jobs").update({
          status:                "succeeded",
          finished_at:           new Date().toISOString(),
          execution_duration_ms: duration,
          last_error:            null,
        }).eq("id", activeJob.id);

        return new Response(
          JSON.stringify({ ok: true, job_id: activeJob.id, duration, result }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } catch (err) {
        const duration    = Date.now() - startTime;
        const errMessage  = (err as Error).message;
        const retryable   = isRetryable(errMessage);
        // Stage 11: Non-retryable → dead_lettered. Retryable → failed (standard retry path).
        const newJobStatus = retryable ? "failed" : "dead_lettered";

        console.error(`[Worker] Job ${activeJob.id} (${jobType}) ${retryable ? "failed (retryable)" : "DEAD-LETTERED (non-retryable)"}: ${errMessage}`);

        await workerClient.from("session_jobs").update({
          status:                newJobStatus,
          last_error:            errMessage,
          execution_duration_ms: duration,
          updated_at:            new Date().toISOString(),
        }).eq("id", activeJob.id);

        // Stage 11: Non-retryable errors also transition session to dead_lettered
        if (!retryable) {
          try {
            await transitionSession(
              workerClient, sessionId, "dead_lettered", null,
              `Non-retryable failure in ${jobType}: ${errMessage}`,
              null, officeId, "worker"
            );
            // Persist health alert for non-retryable death
            await workerClient.from("session_health_alerts").insert({
              session_id: sessionId,
              office_id:  officeId,
              alert_type: "zombie_job",
              severity:   "critical",
              detail:  {
                job_id:       activeJob.id,
                job_type:     jobType,
                error:        errMessage,
                non_retryable: true,
                guidance:      "Inspect lineage and determine if output was generated. Use retry_job only if side_effect_confirmed=false.",
              },
            });
          } catch (fsmErr) {
            console.error(`[Worker] Could not transition session to dead_lettered: ${(fsmErr as Error).message}`);
          }
        }

        // Stage 11: Chain failure → compensating state (prevents silent stuck session)
        // Only for retryable chain stages where session may have inconsistent intermediate state
        if (retryable && ["INGEST", "SNAPSHOT", "ANALYZE_LEGAL", "ANALYZE_MEDICAL"].includes(jobType)) {
          try {
            await transitionSession(
              workerClient, sessionId, "compensating",
              `compensation:${jobType.toLowerCase()}`,
              `Chain stage ${jobType} failed. Compensation triggered. Session awaiting recovery.`,
              { job_id: activeJob.id, error: errMessage },
              officeId, "worker"
            );
          } catch (compErr) {
            console.error(`[Worker] Could not transition session to compensating: ${(compErr as Error).message}`);
          }
        }

        throw err;
      } finally {
        heartbeatActive = false;
        clearInterval(heartbeatTimer);
      }
    }

    // ==========================================================
    // USER ACTIONS — Stage 10 Trust Boundary (unchanged model)
    // ==========================================================
    const userClient = createUserClient(req);
    const { data: userInfo } = await userClient.auth.getUser();
    if (!userInfo?.user) {
      throw Object.assign(new Error("UNAUTHORIZED: Invalid token"), { status: 401 });
    }

    // ----------------------------------------------------------
    // ACTION: ingest_chunk
    // ----------------------------------------------------------
    if (action === "ingest_chunk") {
      const formData    = await req.formData();
      const sessionId   = formData.get("session_id")   as string;
      const chunkIndex  = parseInt(formData.get("chunk_index") as string);
      const chunkFile   = formData.get("file")         as File;
      const clientHash  = formData.get("checksum")     as string;
      const duration    = parseFloat(formData.get("duration") as string);

      if (!sessionId || isNaN(chunkIndex) || !chunkFile) {
        throw Object.assign(new Error("INVALID_CHUNK_PARAMS"), { status: 400 });
      }

      const { officeId, userId } = await assertSessionOwnership(userClient, sessionId);

      const arrayBuffer  = await chunkFile.arrayBuffer();
      const serverHash   = await computeHash(new Uint8Array(arrayBuffer));

      if (serverHash !== clientHash) {
        return new Response(
          JSON.stringify({ error: "HASH_MISMATCH", server: serverHash }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session } = await userClient
        .from("sessions").select("status").eq("id", sessionId).single();

      if (session?.status === "recording") {
        await transitionSession(userClient, sessionId, "uploading", "ingesting", undefined, undefined, undefined, "user");
      }

      const storagePath = `${officeId}/${sessionId}/chunks/${chunkIndex}.webm`;

      const delegatedCtx = buildDelegatedStorageContext(userId, officeId, sessionId);
      await logExecutionContext(workerClient, delegatedCtx, "session-processor", "ingest_chunk:storage_write");

      await workerClient.storage
        .from("session-recordings")
        .upload(storagePath, arrayBuffer, { contentType: "audio/webm", upsert: true });

      const { error: dbErr } = await workerClient
        .from("session_recording_chunks")
        .upsert({
          session_id:      sessionId,
          chunk_index:     chunkIndex,
          storage_path:    storagePath,
          size_bytes:      chunkFile.size,
          duration,
          checksum_sha256: serverHash,
          upload_status:   "uploaded",
          confirmed_at:    new Date().toISOString(),
        }, { onConflict: "session_id, chunk_index" });

      if (dbErr) throw dbErr;

      return new Response(
        JSON.stringify({ ok: true, checksum: serverHash }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------
    // ACTION: finalize_session
    // ----------------------------------------------------------
    if (action === "finalize_session") {
      const { session_id } = await req.json();
      const { officeId, userId } = await assertSessionOwnership(userClient, session_id);

      await transitionSession(
        userClient, session_id, "ready_for_integrity_check", "finalizing",
        "User requested session finalization.", undefined, undefined, "user"
      );

      const { data: chunks } = await workerClient
        .from("session_recording_chunks")
        .select("chunk_index, checksum_sha256")
        .eq("session_id", session_id)
        .order("chunk_index");

      if (!chunks || chunks.length === 0) throw new Error("NO_CHUNKS_FOUND");

      const allHashes     = (chunks as Array<{checksum_sha256: string}>).map(c => c.checksum_sha256).join("");
      const aggregateHash = await computeHash(allHashes);

      const delegatedCtx = buildDelegatedStorageContext(userId, officeId, session_id);
      await logExecutionContext(workerClient, delegatedCtx, "session-processor", "finalize_session:aggregate_hash_write");

      await workerClient.from("sessions").update({
        total_chunks_received:  chunks.length,
        aggregate_session_hash: aggregateHash,
        ended_at:               new Date().toISOString(),
      }).eq("id", session_id);

      await transitionSession(
        workerClient, session_id, "ready_for_transcription", "none",
        "Integrity check passed.", null, officeId, "worker"
      );

      // Stage 11: Idempotency key based on aggregate_session_hash — stable across retries
      const job = await enqueueJob(
        workerClient, session_id, officeId,
        "TRANSCRIBE", `transcribe:${session_id}:${aggregateHash}`
      );

      return new Response(
        JSON.stringify({ ok: true, hash: aggregateHash, job_id: job?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------
    // ACTION: transcribe_session (manual re-trigger)
    // Stage 11: Idempotency key based on aggregate_session_hash
    // NOT Date.now() — prevents duplicate jobs on manual retry
    // ----------------------------------------------------------
    if (action === "transcribe_session") {
      const { session_id } = await req.json();
      const { officeId } = await assertSessionOwnership(userClient, session_id);

      // Stage 11: Fetch current aggregate hash for stable idempotency key
      const { data: sess } = await workerClient
        .from("sessions")
        .select("aggregate_session_hash")
        .eq("id", session_id)
        .single();

      const aggregateHash = (sess as Record<string,unknown>)?.aggregate_session_hash as string | null;
      if (!aggregateHash) {
        throw new Error("CHUNKS_NOT_FOUND: No aggregate session hash found — session may not be finalized");
      }

      // Stable key: same retry always produces same key → idempotent
      const idempKey = `transcribe:${session_id}:${aggregateHash}`;
      const job = await enqueueJob(workerClient, session_id, officeId, "TRANSCRIBE", idempKey);

      return new Response(
        JSON.stringify({ ok: true, job_id: job?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------
    // ACTION: create_snapshot
    // ----------------------------------------------------------
    if (action === "create_snapshot") {
      const { session_id, transcription_id } = await req.json();
      const { officeId } = await assertSessionOwnership(userClient, session_id);

      const job = await enqueueJob(
        workerClient, session_id, officeId,
        "SNAPSHOT",
        `snapshot:${session_id}:${transcription_id}`,
        { transcription_id }
      );

      return new Response(
        JSON.stringify({ ok: true, job_id: job?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------
    // ACTION: generate_legal_output / generate_medical_output
    // ----------------------------------------------------------
    if (action === "generate_legal_output" || action === "generate_medical_output") {
      const { session_id, snapshot_id, reprocess_reason, parent_output_id, force_reprocess: forceFlag } = await req.json();
      const { officeId } = await assertSessionOwnership(userClient, session_id);
      const domain  = action === "generate_legal_output" ? "LEGAL" : "MEDICAL";
      const userId  = userInfo.user.id;

      // Stage 12: Rate limit — AI generation per user (10/min) and per office (30/min)
      const [userRl, officeRl] = await Promise.all([
        enforceRateLimit("user",   userId,   "ai_generation", 10, 1),
        enforceRateLimit("office", officeId, "ai_generation", 30, 1),
      ]);
      if (!userRl.allowed || !officeRl.allowed) {
        const blockedUntil = userRl.blocked_until ?? officeRl.blocked_until;
        throw Object.assign(
          new Error(`RATE_LIMITED: AI generation limit exceeded. Try again after ${blockedUntil ?? "next window"}.`),
          { status: 429 }
        );
      }

      // Stage 12: Kill-switch check for ai_generation
      if (await isKillSwitchActive("ai_generation", officeId)) {
        throw Object.assign(
          new Error("KILL_SWITCH_ACTIVE: AI generation is currently disabled"),
          { status: 503 }
        );
      }

      // Stage 13 Fix G-05: Idempotency key must be stable (no Date.now()) to prevent
      // multiple concurrent calls from creating duplicate ANALYZE jobs for the same snapshot.
      // If force_reprocess is explicitly requested, suffix with timestamp to allow new job creation.
      const forceExplicit = forceFlag === true;
      const rerunKey = forceExplicit
        ? `analyze:${snapshot_id}:${domain}:force:${Date.now()}`
        : `analyze:${snapshot_id}:${domain}`;

      const job = await enqueueJob(
        workerClient, session_id, officeId,
        `ANALYZE_${domain}`, rerunKey,
        { snapshot_id, reprocess_reason, parent_output_id, force_reprocess: forceExplicit },
        10
      );

      return new Response(
        JSON.stringify({ ok: true, job_id: job?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------
    // ACTION: log_medical_review
    // ----------------------------------------------------------
    if (action === "log_medical_review") {
      const { output_id, session_id, action_performed, reviewer_notes, started_at } = await req.json();
      const userId = userInfo.user.id;

      await assertSessionOwnership(userClient, session_id);

      const { data: output } = await userClient
        .from("medical_session_outputs")
        .select("output_hash, snapshot_id")
        .eq("id", output_id)
        .single();

      if (!output) throw new Error("MEDICAL_OUTPUT_NOT_FOUND");

      const { data: log, error } = await workerClient
        .from("medical_review_logs")
        .insert({
          session_id,
          output_id,
          reviewer_id:            userId,
          started_at:             started_at || new Date().toISOString(),
          completed_at:           new Date().toISOString(),
          action_performed,
          reviewer_notes,
          snapshot_id:            (output as Record<string,unknown>).snapshot_id,
          content_hash_at_review: (output as Record<string,unknown>).output_hash,
          execution_context:      "user",
          trigger_source:         "http_user",
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ ok: true, log_id: (log as Record<string,unknown>).id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------
    // ACTION: certify_medical_output
    // ----------------------------------------------------------
    if (action === "certify_medical_output") {
      const { output_id, content_hash } = await req.json();
      const userId = userInfo.user.id;

      const { data: output } = await userClient
        .from("medical_session_outputs")
        .select("*, session:sessions(id, office_id, current_snapshot_id, status)")
        .eq("id", output_id)
        .single();

      if (!output) throw Object.assign(new Error("OUTPUT_NOT_FOUND"), { status: 404 });

      const outputTyped = output as Record<string, unknown>;
      const session     = outputTyped.session as Record<string, unknown>;

      const { error: gateErr } = await workerClient.rpc("assert_medical_output_certifiable", {
        p_output_id: output_id,
      });
      if (gateErr) throw new Error(gateErr.message);

      if (session.current_snapshot_id !== outputTyped.snapshot_id) {
        throw new Error("PROHIBITED_STALE_CERTIFICATION: Session snapshot evolved. Reprocess required.");
      }

      if (outputTyped.output_hash !== content_hash) {
        throw new Error("INTEGRITY_MISMATCH: Content changed since analysis.");
      }

      const { data: reviewLog } = await workerClient
        .from("medical_review_logs")
        .select("id")
        .eq("output_id", output_id)
        .eq("action_performed", "APPROVE")
        .limit(1);

      if (!reviewLog || reviewLog.length === 0) {
        throw new Error("PROHIBITED_CERTIFICATION: Explicit human APPROVE review event missing.");
      }

      const { data: settings } = await userClient
        .from("user_medical_settings")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!settings || !(settings as Record<string,unknown>).professional_license_display) {
        throw new Error("PROHIBITED_CERTIFICATION: Valid CRM metadata required.");
      }

      const settingsTyped = settings as Record<string, unknown>;
      const profTag = `${settingsTyped.title_prefix ?? "Dr(a)."} ${settingsTyped.full_name_override ?? userInfo.user.email} - ${settingsTyped.professional_license_display}`;

      const delegatedCtx = buildDelegatedStorageContext(userId, session.office_id as string, session.id as string);
      await logExecutionContext(
        workerClient, delegatedCtx,
        "session-processor", "certify_medical_output:finalize_certification"
      );

      await transitionSession(
        workerClient,
        session.id as string,
        "approved", "none",
        "Medical output officially certified.",
        null,
        session.office_id as string,
        "user"
      );

      await workerClient.from("medical_session_outputs").update({
        is_finalized:              true,
        certified_at:              new Date().toISOString(),
        certified_by:              userId,
        professional_tag_snapshot: profTag,
        certification_hash:        await computeHash(`${content_hash}:${profTag}`),
      }).eq("id", output_id);

      await workerClient.from("governance_reports").insert({
        session_id:                   session.id,
        office_id:                    session.office_id,
        status:                       "approved_signed",
        report_version_hash:          content_hash,
        signed_hash:                  content_hash,
        professional_license_display: settingsTyped.professional_license_display,
        signed_at:                    new Date().toISOString(),
        signed_by:                    userId,
        execution_context:            "user",
      });

      return new Response(
        JSON.stringify({ ok: true, professional_tag: profTag }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw Object.assign(new Error("UNROUTED_ACTION"), { status: 400 });

  } catch (error) {
    const err = error as Error & { status?: number };
    console.error(`[session-processor] Failure: ${err.message}`);
    const status = err.status ?? (
      err.message.includes("STALE")          ? 409 :
      err.message.includes("UNAUTHORIZED")   ? 401 :
      err.message.includes("FORBIDDEN")      ? 403 :
      err.message.includes("ACCESS_DENIED")  ? 403 :
      err.message.includes("CROSS_TENANT")   ? 403 :
      err.message.includes("PROHIBITED")     ? 422 : 500
    );
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================
// WORKER HANDLERS — Stage 11: execution_context = 'worker'
// Changes from Stage 10:
//   - worker_id passed to helpers for side_effect_confirmed marking
//   - Handlers mark side_effect_confirmed BEFORE external API calls
//   - Chain handlers propagate failures for compensation handling
// ============================================================

type Job = Record<string, unknown>;

// Stage 11: Helper to mark side effect confirmed (before external API call)
async function markSideEffectConfirmed(jobId: unknown, workerId: string): Promise<void> {
  const { data, error } = await workerClient.rpc("confirm_job_side_effect", {
    p_job_id:    jobId,
    p_worker_id: workerId,
  });
  if (error || !data) {
    console.warn(`[SideEffect] Could not mark side_effect_confirmed for job ${jobId}: ${error?.message}`);
  }
}

async function handleTranscription(job: Job, workerId: string) {
  const sessionId = job.session_id as string;
  const officeId  = job.office_id  as string;

  await transitionSession(
    workerClient, sessionId, "processing", "transcribing",
    "Worker starting transcription.", null, officeId, "worker"
  );

  const { data: chunks } = await workerClient
    .from("session_recording_chunks")
    .select("storage_path")
    .eq("session_id", sessionId)
    .order("chunk_index");

  if (!chunks) throw new Error("CHUNKS_NOT_FOUND");

  // Stage 11: Mark side effect BEFORE calling Deepgram
  // If worker crashes after this point, reclaim will be blocked (requires manual review)
  await markSideEffectConfirmed(job.id, workerId);

  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks as Array<{storage_path: string}>) {
        const { data } = await workerClient.storage
          .from("session-recordings")
          .download(chunk.storage_path);
        if (data) controller.enqueue(new Uint8Array(await (data as Blob).arrayBuffer()));
      }
      controller.close();
    },
  });

  const dgResponse = await fetch(
    `${DEEPGRAM_API_URL}?smart_format=true&diarize=true&language=pt-BR&model=nova-2`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${Deno.env.get("DEEPGRAM_API_KEY")}`,
        "Content-Type": "audio/webm",
      },
      body: stream,
    }
  );

  const dgResult   = await dgResponse.json();
  const transcript = dgResult.results?.channels[0]?.alternatives[0]?.transcript;

  const { data: trans } = await workerClient
    .from("session_transcriptions")
    .insert({
      session_id:      sessionId,
      version_number:  1,
      version_type:    "diarized",
      raw_text:        transcript,
      structured_json: dgResult,
      language:        "pt-BR",
      provider:        "deepgram",
    })
    .select()
    .single();

  await transitionSession(
    workerClient, sessionId, "transcribed", "none",
    "Transcription data persisted by worker.", null, officeId, "worker"
  );

  await enqueueJob(workerClient, sessionId, officeId,
    "INGEST",
    `ingest:${sessionId}:${(trans as Record<string,unknown>).id}`,
    { transcription_id: (trans as Record<string,unknown>).id }
  );

  return { transcription_id: (trans as Record<string,unknown>).id };
}

async function handleContextIngestion(job: Job, workerId: string) {
  const sessionId       = job.session_id as string;
  const officeId        = job.office_id  as string;
  const transcriptionId = (job.config_json as Record<string,unknown>).transcription_id as string;

  await transitionSession(
    workerClient, sessionId, "processing", "ingesting_context",
    "Worker ingesting context version.", null, officeId, "worker"
  );

  const { data: sources } = await workerClient
    .from("session_context_sources")
    .select("*")
    .eq("session_id", sessionId);

  const contextHash = await computeHash(canonicalStringify(sources ?? []));

  const { data: maxVer } = await workerClient
    .from("session_context_versions")
    .select("version_number")
    .eq("session_id", sessionId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((maxVer as Record<string,unknown>)?.version_number as number ?? 0) + 1;

  const { data: version } = await workerClient
    .from("session_context_versions")
    .insert({
      session_id:       sessionId,
      version_number:   nextVersion,
      context_snapshot: { sources: sources ?? [] },
      context_hash:     contextHash,
      source_count:     (sources ?? []).length,
    })
    .select()
    .single();

  await transitionSession(
    workerClient, sessionId, "context_ready", "none",
    "Context frozen by worker.", null, officeId, "worker"
  );

  await enqueueJob(workerClient, sessionId, officeId,
    "SNAPSHOT",
    `snapshot:${sessionId}:${transcriptionId}`,
    { transcription_id: transcriptionId }
  );

  return { context_version_id: (version as Record<string,unknown>).id };
}

async function handleSnapshotCreation(job: Job, workerId: string) {
  const sessionId       = job.session_id as string;
  const officeId        = job.office_id  as string;
  const transcriptionId = (job.config_json as Record<string,unknown>).transcription_id as string;

  await transitionSession(
    workerClient, sessionId, "processing", "creating_snapshot",
    "Worker creating frozen snapshot.", null, officeId, "worker"
  );

  const { data: trans }   = await workerClient.from("session_transcriptions").select("*").eq("id", transcriptionId).single();
  const { data: context } = await workerClient.from("session_context_versions").select("*").eq("session_id", sessionId).order("version_number", { ascending: false }).limit(1).single();
  const { data: sources } = await workerClient.from("session_context_sources").select("*").eq("session_id", sessionId).order("id");

  if (!trans || !context) throw new Error("REQUIRED_CONTEXT_MISSING");

  const { included, excluded } = resolveLegalContext(sources ?? []);
  const snapshotPayload = {
    session_id: sessionId,
    transcription_id: transcriptionId,
    context_version: (context as Record<string,unknown>).version_number,
    context_hash: (context as Record<string,unknown>).context_hash,
    ordered_sources: included,
  };
  const snapshotHash = await computeHash(canonicalStringify(snapshotPayload));

  const { data: snapshot } = await workerClient
    .from("session_processing_snapshots")
    .insert({
      session_id:            sessionId,
      transcription_id:      transcriptionId,
      context_version:       (context as Record<string,unknown>).version_number,
      context_hash:          (context as Record<string,unknown>).context_hash,
      snapshot_hash:         snapshotHash,
      ordered_sources_json:  included,
      excluded_sources_json: excluded,
      created_by:            job.created_by,
    })
    .select()
    .single();

  await workerClient.from("sessions").update({
    current_snapshot_id: (snapshot as Record<string,unknown>).id,
  }).eq("id", sessionId);

  await transitionSession(
    workerClient, sessionId, "snapshot_created", "none",
    "Snapshot head updated by worker.", null, officeId, "worker"
  );

  const { data: sess } = await workerClient.from("sessions").select("session_type").eq("id", sessionId).single();
  const domain = (sess as Record<string,unknown>)?.session_type === "legal_meeting" ? "LEGAL" : "MEDICAL";

  await enqueueJob(workerClient, sessionId, officeId,
    `ANALYZE_${domain}`,
    `analyze:${(snapshot as Record<string,unknown>).id}:${domain}`,
    { snapshot_id: (snapshot as Record<string,unknown>).id }
  );

  return { snapshot_id: (snapshot as Record<string,unknown>).id };
}

// ---- Legal Context Resolution ----
type ContextSource = { source_id: string; source_type: string; source_hash: string; relevance_score: number; inclusion_mode?: string; inclusion_reason?: string };

function resolveLegalContext(sources: unknown[]): { included: ContextSource[]; excluded: unknown[] } {
  const included: ContextSource[] = [];
  const excluded: unknown[]       = [];
  const mandatoryTypes = ["legal_document", "medical_record"];

  for (const s of sources as Record<string,unknown>[]) {
    const isMandatory = mandatoryTypes.includes(s.source_type as string);
    const score = (s.relevance_score as number) || 1.0;
    if (isMandatory || score >= 0.5) {
      included.push({
        source_id:    s.source_id as string,
        source_type:  s.source_type as string,
        source_hash:  s.source_hash as string,
        relevance_score: score,
        inclusion_mode:  isMandatory ? "MANDATORY" : "RELEVANT",
        inclusion_reason: isMandatory ? "Primary documentary evidence" : "High contextual relevance score",
      });
    } else {
      excluded.push({ source_id: s.source_id, reason: "LOW_RELEVANCE", score });
    }
  }
  return { included, excluded };
}

function calculateSufficiency(included: ContextSource[], hasTranscription: boolean): "sufficient" | "weak" | "insufficient" {
  if (!hasTranscription) return "insufficient";
  const hasMandatory = included.some(s => s.inclusion_mode === "MANDATORY");
  const docCount     = included.filter(s => s.source_type !== "audio").length;
  if (!hasMandatory || docCount === 0) return "insufficient";
  if (docCount < 2) return "weak";
  return "sufficient";
}

async function handleDomainAnalysis(job: Job, domain: string, workerId: string, modelOverride?: string) {
  const sessionId       = job.session_id as string;
  const officeId        = job.office_id  as string;
  // ...
  const targetModel     = modelOverride || OPENAI_MODEL;
  const config          = (job.config_json ?? {}) as Record<string,unknown>;
  const snapshotId      = config.snapshot_id      as string;
  const reprocessReason = config.reprocess_reason as string | undefined;
  const parentOutputId  = config.parent_output_id as string | undefined;
  const forceReprocess  = config.force_reprocess  as boolean | undefined;
  const outputTable     = domain === "legal" ? "legal_session_outputs" : "medical_session_outputs";

  if (!forceReprocess) {
    const { data: existingOutput } = await workerClient
      .from(outputTable).select("id").eq("snapshot_id", snapshotId).limit(1).maybeSingle();

    if (existingOutput) {
      console.log(`[AI-Dedup] Reusing existing output for snapshot ${snapshotId}`);
      await transitionSession(
        workerClient, sessionId, "outputs_generated", "none",
        `${domain} output reused via deduplication.`, null, officeId, "worker"
      );
      return { output_id: (existingOutput as Record<string,unknown>).id, reused: true };
    }
  }

  await transitionSession(
    workerClient, sessionId, "processing", `analyzing_${domain}`,
    `Worker generating ${domain} intelligence.`, null, officeId, "worker"
  );

  const { data: snapshot } = await workerClient
    .from("session_processing_snapshots").select("*").eq("id", snapshotId).single();
  if (!snapshot) throw new Error("SNAPSHOT_NOT_FOUND");

  const snapshotTyped = snapshot as Record<string, unknown>;
  const sufficiency   = calculateSufficiency(
    (snapshotTyped.ordered_sources_json as ContextSource[]) ?? [],
    !!snapshotTyped.transcription_id
  );

  if (sufficiency === "insufficient" && domain === "legal") {
    throw new Error("PROHIBITED_GENERATION: Insufficient documentary background for legal analysis.");
  }

  // Stage 11: Mark side effect BEFORE calling external AI service
  // Stage 13 Fix G-03: Verify lease is still held before marking side-effects and executing.
  // If heartbeat was lost, aborting here prevents duplicate outputs from ghost workers.
  if (!heartbeatActive) {
    throw new Error("LEASE_LOST: Worker lease expired before side-effect execution — aborting to prevent possible duplicate output.");
  }
  await markSideEffectConfirmed(job.id, workerId);

  const mockContent: Record<string,unknown> = {
    summary:       `Worker ${domain} analysis for snapshot ${snapshotId.substring(0, 8)}.`,
    fact_taxonomy: { oral_facts: ["Relato do paciente 1"], documentary_facts: ["Evidência do documento A"], inferences: ["Conclusão assistiva X"] },
    validation_gates: { contradiction_check: "passed", mandatory_doc_check: "passed", clinical_safety_gate: "passed" },
  };

  if (domain === "medical") {
    mockContent.pre_report_draft  = "RASCUNHO ASSISTIVO: Os achados sugerem compatibilidade com quadro X. Considerar diagnósticos diferenciais Y. Este documento requer revisão médica obrigatória.";
    mockContent.pre_diagnosis     = "HIPÓTESE DIAGNÓSTICA ASSISTIVA (Requer validação clínica).";
    mockContent.clinical_findings = ["Achado 1", "Achado 2"];
    mockContent.missing_data      = ["Dados de histórico familiar ausentes"];
  }

  const outputHash = await computeHash(canonicalStringify(mockContent));

  const insertData: Record<string,unknown> = {
    session_id:           sessionId,
    snapshot_id:          snapshotId,
    transcription_id:     snapshotTyped.transcription_id,
    context_version:      snapshotTyped.context_version,
    context_hash:         snapshotTyped.context_hash,
    output_hash:          outputHash,
    parent_output_id:     parentOutputId ?? null,
    summary:              mockContent.summary,
    model_used:           OPENAI_MODEL,
    generation_timestamp: new Date().toISOString(),
    reprocess_reason:     reprocessReason ?? null,
    reprocessed_by:       job.created_by ?? null,
    execution_context:    "worker",
  };

  if (domain === "legal") {
    insertData.context_sufficiency = sufficiency;
    insertData.fact_taxonomy       = mockContent.fact_taxonomy;
    insertData.validation_gates    = mockContent.validation_gates;
  } else {
    insertData.pre_report_draft        = mockContent.pre_report_draft;
    insertData.pre_diagnosis           = mockContent.pre_diagnosis;
    insertData.clinical_findings       = mockContent.clinical_findings;
    insertData.missing_data            = mockContent.missing_data;
    insertData.language_safety_version = "v1_final";
    insertData.fact_taxonomy           = mockContent.fact_taxonomy;
  }

  // Stage 13 Fix G-03: Final lease check before persisting output to DB.
  // Prevents output insertion by a ghost worker whose lease was stolen by the janitor.
  if (!heartbeatActive) {
    throw new Error("LEASE_LOST: Worker lease expired after AI call — output will NOT be persisted. Janitor will reclaim (dead_letter) this job.");
  }
  const { data: output, error: insertErr } = await workerClient.from(outputTable).insert(insertData).select().single();
  if (insertErr) throw insertErr;

  await workerClient.from("session_jobs").update({ token_estimate: 1200 }).eq("id", job.id);

  await transitionSession(
    workerClient, sessionId, "outputs_generated", "none",
    `${domain} output finalized by worker (Sufficiency: ${sufficiency}).`, null, officeId, "worker"
  );

  return { output_id: (output as Record<string,unknown>).id, reused: false, sufficiency };
}
