import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildOperatorContext,
  hasOperatorConfirmation,
  logExecutionContext,
  TrustContext,
} from "../_shared/execution-context.ts";

// ============================================================
// session-admin-actions — Stage 11: Job Integrity Hardening
//
// Changes from Stage 10:
//   - retry_job: side-effect safety check (won't retry if output exists)
//   - requeue_session: FSM/freshness validation, only from safe statuses
//   - emergency_stop: FSM reconciliation (session → failed if processing)
//   - [NEW] resolve_stuck_session: diagnose + recover stuck sessions
//   - [NEW] inspect_health_alerts: list open alerts for office
//
// Trust model: operator (JWT + OWNER/ADMIN role required)
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-operator-confirm",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// ============================================================
// CLIENT FACTORIES
// ============================================================

function createUserClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
}

const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

// ============================================================
// OPERATOR AUTHENTICATION & AUTHORIZATION
// ============================================================

interface OperatorAuth {
  ok: true;
  userId: string;
  role: "OWNER" | "ADMIN";
  officeId: string;
  ctx: TrustContext;
}
interface OperatorAuthError {
  ok: false;
  status: number;
  error: string;
}

async function authenticateOperator(req: Request): Promise<OperatorAuth | OperatorAuthError> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "UNAUTHORIZED: Missing Authorization header" };
  }

  const userClient = createUserClient(authHeader);
  const { data: authData, error: authErr } = await userClient.auth.getUser();

  if (authErr || !authData?.user) {
    return { ok: false, status: 401, error: "UNAUTHORIZED: Invalid token" };
  }

  const { data: membership, error: memberErr } = await userClient
    .from("office_members")
    .select("role, office_id")
    .eq("user_id", authData.user.id)
    .in("role", ["OWNER", "ADMIN"])
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memberErr) {
    return { ok: false, status: 500, error: "ERROR: Could not validate office membership" };
  }

  if (!membership) {
    return { ok: false, status: 403, error: "FORBIDDEN: OWNER or ADMIN role required for operator actions" };
  }

  const traceId = req.headers.get("x-trace-id") ?? crypto.randomUUID();
  const role    = membership.role as "OWNER" | "ADMIN";
  const ctx     = buildOperatorContext(authData.user.id, role, membership.office_id, traceId);

  return {
    ok:       true,
    userId:   authData.user.id,
    role,
    officeId: membership.office_id,
    ctx,
  };
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
): Promise<{ allowed: boolean; blocked_until?: string }> {
  try {
    const { data, error } = await adminClient.rpc("check_and_increment_rate_limit", {
      p_scope_type:       scopeType,
      p_scope_id:         scopeId,
      p_action:           action,
      p_limit_per_window: limit,
      p_window_minutes:   windowMin,
    });
    if (error) {
      console.warn(`[RateLimit] RATE_LIMIT_SYSTEM_DEGRADED: ${error.message}`);
      return { allowed: true };  // fail-open
    }
    return data as { allowed: boolean; blocked_until?: string };
  } catch (err) {
    console.warn(`[RateLimit] RATE_LIMIT_SYSTEM_DEGRADED: ${(err as Error).message}`);
    return { allowed: true };  // fail-open
  }
}

// ============================================================
// IDEMPOTENCY GUARD
// ============================================================
async function checkIdempotency(key: string): Promise<{ alreadyExecuted: boolean; previousResult?: string }> {
  const { data } = await adminClient
    .from("operator_action_log")
    .select("id, execution_result")
    .eq("idempotency_key", key)
    .maybeSingle();

  if (data) {
    return { alreadyExecuted: true, previousResult: data.execution_result };
  }
  return { alreadyExecuted: false };
}

// ============================================================
// OPERATOR ACTION LOG
// ============================================================
async function logOperatorAction(params: {
  operatorId:         string;
  operatorRole:       string;
  officeId:           string;
  actionType:         string;
  targetResourceType: string | null;
  targetResourceId:   string | null;
  justification:      string | null;
  idempotencyKey:     string;
  executionResult:    "success" | "rejected" | "error";
  rejectionReason?:   string;
  errorDetail?:       string;
  traceId:            string;
}): Promise<void> {
  await adminClient.from("operator_action_log").insert({
    operator_id:          params.operatorId,
    operator_role:        params.operatorRole,
    office_id:            params.officeId,
    action_type:          params.actionType,
    target_resource_type: params.targetResourceType,
    target_resource_id:   params.targetResourceId,
    justification:        params.justification,
    idempotency_key:      params.idempotencyKey,
    execution_result:     params.executionResult,
    rejection_reason:     params.rejectionReason ?? null,
    error_detail:         params.errorDetail ?? null,
    trace_id:             params.traceId,
  });
}

// ============================================================
// FSM TRANSITION via adminClient with operator context
// ============================================================
async function operatorTransitionSession(
  sessionId:    string,
  targetStatus: string,
  reason:       string,
  officeId:     string
): Promise<void> {
  const { error } = await adminClient.rpc("transition_session_fsm", {
    p_session_id:        sessionId,
    p_target_status:     targetStatus,
    p_target_step:       null,
    p_reason:            reason,
    p_metadata:          null,
    p_caller_office_id:  officeId,
    p_execution_context: "operator",
  });
  if (error) throw new Error(`FSM_TRANSITION_ERROR: ${error.message}`);
}

// ============================================================
// Stage 11: RESOLVE OPEN HEALTH ALERTS for session
// ============================================================
async function resolveSessionAlerts(sessionId: string, resolvedBy: string, note: string): Promise<number> {
  const { data } = await adminClient
    .from("session_health_alerts")
    .update({
      resolved_at:      new Date().toISOString(),
      resolved_by:      resolvedBy,
      resolution_note:  note,
      updated_at:       new Date().toISOString(),
    })
    .eq("session_id", sessionId)
    .is("resolved_at", null)
    .select("id");

  return (data ?? []).length;
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await authenticateOperator(req);

  if (!authResult.ok) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { userId, role, officeId, ctx } = authResult;

  const url    = new URL(req.url);
  const action = url.searchParams.get("action") ?? "unknown";

  await logExecutionContext(adminClient, ctx, "session-admin-actions", action);

  try {
    const body = await req.json().catch(() => ({}));

    // ========================================================
    // Stage 13 Fix G-07: operator_freeze kill-switch check.
    // Blocks all write actions while frozen. Read-only actions
    // and manage_kill_switch (to allow deactivation) are exempt.
    // ========================================================
    const READ_ONLY_ACTIONS = ["inspect_lineage", "inspect_health_alerts", "run_readiness_check", "manage_kill_switch"];
    if (!READ_ONLY_ACTIONS.includes(action)) {
      const { data: freezeActive } = await adminClient.rpc("is_kill_switch_active", {
        p_switch_type: "operator_freeze",
        p_scope_id: officeId,
      });
      if (freezeActive) {
        throw Object.assign(
          new Error("KILL_SWITCH_ACTIVE: operator_freeze is enabled — all write actions are suspended"),
          { status: 503 }
        );
      }
    }

    // ========================================================
    // ACTION: inspect_lineage — read-only, no FSM changes
    // ========================================================
    if (action === "inspect_lineage") {
      const { session_id } = body as { session_id: string };
      if (!session_id) throw Object.assign(new Error("MISSING_PARAM: session_id required"), { status: 400 });

      const { data: session } = await adminClient
        .from("sessions")
        .select("id, office_id, status, processing_step")
        .eq("id", session_id)
        .single();

      if (!session || session.office_id !== officeId) {
        throw Object.assign(new Error("FORBIDDEN: Session not in your office"), { status: 403 });
      }

      const [
        { data: snapshots },
        { data: outputs_legal },
        { data: outputs_medical },
        { data: jobs },
        { data: alerts },
      ] = await Promise.all([
        adminClient
          .from("session_processing_snapshots")
          .select("id, snapshot_hash, context_version, context_hash, created_at")
          .eq("session_id", session_id)
          .order("created_at", { ascending: false }),
        adminClient
          .from("legal_session_outputs")
          .select("id, output_hash, snapshot_id, status, generation_timestamp, reprocess_reason")
          .eq("session_id", session_id),
        adminClient
          .from("medical_session_outputs")
          .select("id, output_hash, snapshot_id, is_finalized, certified_at, generation_timestamp")
          .eq("session_id", session_id),
        adminClient
          .from("session_jobs")
          .select("id, job_type, status, started_at, finished_at, last_error, attempt_count, side_effect_confirmed, reclaim_attempts, execution_duration_ms")
          .eq("session_id", session_id)
          .order("created_at", { ascending: false })
          .limit(20),
        // Stage 11: Include health alerts in lineage
        adminClient
          .from("session_health_alerts")
          .select("id, alert_type, severity, detail, resolved_at, created_at")
          .eq("session_id", session_id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      return new Response(JSON.stringify({
        ok: true,
        session,
        snapshots: snapshots ?? [],
        outputs: { legal: outputs_legal ?? [], medical: outputs_medical ?? [] },
        jobs:     jobs ?? [],
        alerts:   alerts ?? [],   // Stage 11: health alerts in lineage
        trace_id: ctx.trace_id,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========================================================
    // ACTION: retry_job — Stage 11 hardened + Stage 12 rate limit
    // Now checks side_effect_confirmed and output existence
    // before allowing retry. Prevents duplicate output generation.
    // ========================================================
    if (action === "retry_job") {
      const { job_id, justification } = body as { job_id: string; justification?: string };
      if (!job_id) throw Object.assign(new Error("MISSING_PARAM: job_id required"), { status: 400 });

      // Stage 12: Rate limit — operator retries (5 per 10 min per operator)
      const retryRl = await enforceRateLimit("user", userId, "retry_job", 5, 10);
      if (!retryRl.allowed) {
        throw Object.assign(
          new Error(`RATE_LIMITED: Operator retry limit exceeded. Try again after ${retryRl.blocked_until ?? "next window"}.`),
          { status: 429 }
        );
      }

      const idempotencyKey = `retry_job:${job_id}:${userId}:${Math.floor(Date.now() / 3600000)}`;
      const idem = await checkIdempotency(idempotencyKey);
      if (idem.alreadyExecuted) {
        return new Response(
          JSON.stringify({ ok: true, idempotent: true, previous_result: idem.previousResult, trace_id: ctx.trace_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: job } = await adminClient
        .from("session_jobs")
        .select("id, office_id, status, job_type, attempt_count, side_effect_confirmed, config_json")
        .eq("id", job_id)
        .single();

      if (!job || job.office_id !== officeId) {
        await logOperatorAction({
          operatorId: userId, operatorRole: role, officeId,
          actionType: "retry_job", targetResourceType: "session_job", targetResourceId: job_id,
          justification: justification ?? null, idempotencyKey,
          executionResult: "rejected",
          rejectionReason: "Job not found or not in operator's office",
          traceId: ctx.trace_id,
        });
        throw Object.assign(new Error("FORBIDDEN: Job not in your office"), { status: 403 });
      }

      // Only failed, dead_lettered, or heartbeat_lost jobs can be retried
      if (!["failed", "dead_lettered", "heartbeat_lost"].includes(job.status)) {
        await logOperatorAction({
          operatorId: userId, operatorRole: role, officeId,
          actionType: "retry_job", targetResourceType: "session_job", targetResourceId: job_id,
          justification: justification ?? null, idempotencyKey,
          executionResult: "rejected",
          rejectionReason: `Job is in status "${job.status}" — only failed/dead_lettered/heartbeat_lost can be retried`,
          traceId: ctx.trace_id,
        });
        throw Object.assign(
          new Error(`REJECTED: Job status is "${job.status}" — only failed/dead_lettered/heartbeat_lost jobs can be retried`),
          { status: 422 }
        );
      }

      // Stage 11: If side effects were already confirmed, check whether
      // the output was actually generated before allowing retry.
      // This prevents duplicate output generation from a retry.
      if (job.side_effect_confirmed) {
        const config      = (job.config_json ?? {}) as Record<string, unknown>;
        const snapshotId  = config.snapshot_id as string | undefined;
        const jobTypeLower = (job.job_type as string).toLowerCase();

        // Determine which output table to check
        const outputTable =
          job.job_type === "ANALYZE_LEGAL"   ? "legal_session_outputs" :
          job.job_type === "ANALYZE_MEDICAL" ? "medical_session_outputs" : null;

        if (outputTable && snapshotId) {
          const { data: existingOutput } = await adminClient
            .from(outputTable)
            .select("id")
            .eq("snapshot_id", snapshotId)
            .limit(1)
            .maybeSingle();

          if (existingOutput) {
            await logOperatorAction({
              operatorId: userId, operatorRole: role, officeId,
              actionType: "retry_job", targetResourceType: "session_job", targetResourceId: job_id,
              justification: justification ?? null, idempotencyKey,
              executionResult: "rejected",
              rejectionReason: `Output already exists for snapshot ${snapshotId} — retry would duplicate. Use force_reprocess instead.`,
              traceId: ctx.trace_id,
            });
            throw Object.assign(
              new Error(`REJECTED: Output already generated for this job (snapshot ${snapshotId}). Use generate_${jobTypeLower.replace("analyze_", "")}_output with force_reprocess=true instead.`),
              { status: 422 }
            );
          }
        }
      }

      // Safe to retry — reset to queued
      // IDEMPOTENCY GUARD: conditional update on current status prevents
      // duplicate effects if two operator retries race concurrently.
      const { data: updatedJobs } = await adminClient.from("session_jobs").update({
        status:        "queued",
        last_error:    null,
        started_at:    null,
        finished_at:   null,
        attempt_count: (job.attempt_count as number ?? 0) + 1,
        updated_at:    new Date().toISOString(),
      }).eq("id", job_id).eq("status", job.status).select("id");

      // If 0 rows updated, a concurrent operator or worker changed the status
      if (!updatedJobs || updatedJobs.length === 0) {
        throw Object.assign(
          new Error(`CONCURRENCY_CONFLICT: Job ${job_id} status changed concurrently. Re-fetch job state before retrying.`),
          { status: 409 }
        );
      }

      await logOperatorAction({
        operatorId: userId, operatorRole: role, officeId,
        actionType: "retry_job", targetResourceType: "session_job", targetResourceId: job_id,
        justification: justification ?? null, idempotencyKey,
        executionResult: "success",
        traceId: ctx.trace_id,
      });

      return new Response(
        JSON.stringify({ ok: true, job_id, new_status: "queued", trace_id: ctx.trace_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================
    // ACTION: requeue_session — Stage 11 hardened
    // Now validates FSM status (only safe statuses allowed)
    // and checks session is not actively processing.
    // ========================================================
    if (action === "requeue_session") {
      const { session_id, justification } = body as { session_id: string; justification?: string };
      if (!session_id) throw Object.assign(new Error("MISSING_PARAM: session_id required"), { status: 400 });

      const idempotencyKey = `requeue_session:${session_id}:${userId}:${Math.floor(Date.now() / 3600000)}`;
      const idem = await checkIdempotency(idempotencyKey);
      if (idem.alreadyExecuted) {
        return new Response(
          JSON.stringify({ ok: true, idempotent: true, previous_result: idem.previousResult, trace_id: ctx.trace_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session } = await adminClient
        .from("sessions")
        .select("id, office_id, status, aggregate_session_hash, current_snapshot_id")
        .eq("id", session_id)
        .single();

      if (!session || session.office_id !== officeId) {
        await logOperatorAction({
          operatorId: userId, operatorRole: role, officeId,
          actionType: "requeue_session", targetResourceType: "session", targetResourceId: session_id,
          justification: justification ?? null, idempotencyKey,
          executionResult: "rejected", rejectionReason: "Session not found or not in operator's office",
          traceId: ctx.trace_id,
        });
        throw Object.assign(new Error("FORBIDDEN: Session not in your office"), { status: 403 });
      }

      // Stage 11: Strict safe status check — only allow requeue from terminal/recovery states
      const SAFE_REQUEUE_STATUSES = ["failed", "dead_lettered", "compensating", "transcribed", "outputs_generated"];
      if (!SAFE_REQUEUE_STATUSES.includes(session.status)) {
        await logOperatorAction({
          operatorId: userId, operatorRole: role, officeId,
          actionType: "requeue_session", targetResourceType: "session", targetResourceId: session_id,
          justification: justification ?? null, idempotencyKey,
          executionResult: "rejected",
          rejectionReason: `Cannot requeue session in status "${session.status}". Safe statuses: ${SAFE_REQUEUE_STATUSES.join(", ")}`,
          traceId: ctx.trace_id,
        });
        throw Object.assign(
          new Error(`REJECTED: Cannot requeue session in status "${session.status}". Use emergency_stop first if session is processing.`),
          { status: 422 }
        );
      }

      // Stage 11: Verify session has recording data to process (aggregate hash must exist)
      if (!session.aggregate_session_hash) {
        await logOperatorAction({
          operatorId: userId, operatorRole: role, officeId,
          actionType: "requeue_session", targetResourceType: "session", targetResourceId: session_id,
          justification: justification ?? null, idempotencyKey,
          executionResult: "rejected",
          rejectionReason: "Session has no aggregate_session_hash — no recording data to reprocess",
          traceId: ctx.trace_id,
        });
        throw Object.assign(
          new Error("REJECTED: Session has no recording data (aggregate_session_hash missing). Cannot requeue."),
          { status: 422 }
        );
      }

      // FSM gate: requeue → ready_for_transcription
      await operatorTransitionSession(session_id, "ready_for_transcription", `Operator requeue by ${userId}: ${justification ?? "no reason provided"}`, officeId);

      // Enqueue a new TRANSCRIBE job with stable idempotency key
      await adminClient.from("session_jobs").insert({
        session_id:      session_id,
        office_id:       officeId,
        job_type:        "TRANSCRIBE",
        idempotency_key: `transcribe:${session_id}:${session.aggregate_session_hash}:requeue:${Date.now()}`,
        config_json:     {},
        priority:        5,
        status:          "queued",
      }).select().single();

      // Resolve open stuck_session alerts
      await resolveSessionAlerts(session_id, userId, `Resolved by operator requeue: ${justification ?? "no reason"}`);

      await logOperatorAction({
        operatorId: userId, operatorRole: role, officeId,
        actionType: "requeue_session", targetResourceType: "session", targetResourceId: session_id,
        justification: justification ?? null, idempotencyKey,
        executionResult: "success", traceId: ctx.trace_id,
      });

      return new Response(
        JSON.stringify({ ok: true, session_id, new_status: "ready_for_transcription", trace_id: ctx.trace_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================
    // ACTION: cancel_session — with FSM reconciliation
    // ========================================================
    if (action === "cancel_session") {
      const { session_id, justification } = body as { session_id: string; justification: string };
      if (!session_id)    throw Object.assign(new Error("MISSING_PARAM: session_id required"), { status: 400 });
      if (!justification) throw Object.assign(new Error("MISSING_PARAM: justification required for destructive action"), { status: 400 });

      if (!hasOperatorConfirmation(req)) {
        throw Object.assign(
          new Error("CONFIRMATION_REQUIRED: Add header x-operator-confirm: CONFIRMED for cancel_session"),
          { status: 400 }
        );
      }

      const idempotencyKey = `cancel_session:${session_id}:${userId}`;
      const idem = await checkIdempotency(idempotencyKey);
      if (idem.alreadyExecuted) {
        return new Response(
          JSON.stringify({ ok: true, idempotent: true, previous_result: idem.previousResult, trace_id: ctx.trace_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session } = await adminClient
        .from("sessions")
        .select("id, office_id, status")
        .eq("id", session_id)
        .single();

      if (!session || session.office_id !== officeId) {
        await logOperatorAction({
          operatorId: userId, operatorRole: role, officeId,
          actionType: "cancel_session", targetResourceType: "session", targetResourceId: session_id,
          justification, idempotencyKey, executionResult: "rejected",
          rejectionReason: "Session not found or not in operator's office", traceId: ctx.trace_id,
        });
        throw Object.assign(new Error("FORBIDDEN: Session not in your office"), { status: 403 });
      }

      if (session.status === "approved") {
        await logOperatorAction({
          operatorId: userId, operatorRole: role, officeId,
          actionType: "cancel_session", targetResourceType: "session", targetResourceId: session_id,
          justification, idempotencyKey, executionResult: "rejected",
          rejectionReason: "Session is approved — cannot cancel a certified session",
          traceId: ctx.trace_id,
        });
        throw Object.assign(new Error("REJECTED: Cannot cancel an already approved/certified session"), { status: 422 });
      }

      // FSM gate: operator cancel → failed
      await operatorTransitionSession(session_id, "failed", `Operator cancel: ${justification}`, officeId);

      // Cancel all queued/running/heartbeat_lost jobs for this session
      await adminClient.from("session_jobs").update({
        status:    "cancelled",
        last_error: `Cancelled by operator ${userId}: ${justification}`,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", session_id)
      .in("status", ["queued", "running", "claimed", "heartbeat_lost"]);

      // Resolve open health alerts
      await resolveSessionAlerts(session_id, userId, `Resolved by operator cancel: ${justification}`);

      await logOperatorAction({
        operatorId: userId, operatorRole: role, officeId,
        actionType: "cancel_session", targetResourceType: "session", targetResourceId: session_id,
        justification, idempotencyKey, executionResult: "success", traceId: ctx.trace_id,
      });

      return new Response(
        JSON.stringify({ ok: true, session_id, new_status: "failed", trace_id: ctx.trace_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================
    // ACTION: emergency_stop — Stage 11 + FSM reconciliation
    // New: if session is in a processing state, transitions
    // FSM to 'failed' so session doesn't stay stuck.
    // ========================================================
    if (action === "emergency_stop") {
      if (role !== "OWNER") {
        throw Object.assign(new Error("FORBIDDEN: emergency_stop requires OWNER role"), { status: 403 });
      }

      const { session_id, justification } = body as { session_id: string; justification: string };
      if (!session_id)    throw Object.assign(new Error("MISSING_PARAM: session_id required"), { status: 400 });
      if (!justification) throw Object.assign(new Error("MISSING_PARAM: justification required for emergency_stop"), { status: 400 });

      if (!hasOperatorConfirmation(req)) {
        throw Object.assign(
          new Error("CONFIRMATION_REQUIRED: Add header x-operator-confirm: CONFIRMED for emergency_stop"),
          { status: 400 }
        );
      }

      const { data: session } = await adminClient
        .from("sessions")
        .select("id, office_id, status")
        .eq("id", session_id)
        .single();

      if (!session || session.office_id !== officeId) {
        throw Object.assign(new Error("FORBIDDEN: Session not in your office"), { status: 403 });
      }

      // Stop all active jobs
      const { data: stoppedJobs } = await adminClient
        .from("session_jobs")
        .update({
          status:    "cancelled",
          last_error: `EMERGENCY STOP by OWNER ${userId}: ${justification}`,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", session_id)
        .in("status", ["queued", "running", "claimed", "heartbeat_lost"])
        .select("id");

      // Stage 11: FSM reconciliation — prevent session from staying in stuck processing state
      const PROCESSING_STATES = ["processing", "transcribed", "context_ready", "snapshot_created", "analyzing", "compensating"];
      if (PROCESSING_STATES.includes(session.status)) {
        try {
          await operatorTransitionSession(
            session_id, "failed",
            `Emergency stop + FSM reconciliation by OWNER ${userId}: ${justification}`,
            officeId
          );
        } catch (fsmErr) {
          console.error(`[emergency_stop] Could not reconcile FSM: ${(fsmErr as Error).message}`);
        }
      }

      // Resolve all open health alerts for this session
      const resolvedCount = await resolveSessionAlerts(
        session_id, userId,
        `Resolved by emergency_stop: ${justification}`
      );

      await logOperatorAction({
        operatorId: userId, operatorRole: role, officeId,
        actionType: "emergency_stop", targetResourceType: "session", targetResourceId: session_id,
        justification,
        idempotencyKey: `emergency_stop:${session_id}:${userId}:${Date.now()}`,
        executionResult: "success", traceId: ctx.trace_id,
      });

      return new Response(
        JSON.stringify({
          ok:              true,
          session_id,
          jobs_stopped:    (stoppedJobs ?? []).length,
          fsm_reconciled:  PROCESSING_STATES.includes(session.status),
          alerts_resolved: resolvedCount,
          trace_id:        ctx.trace_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================
    // ACTION: resolve_stuck_session — Stage 11 NEW
    // Diagnoses a stuck session and attempts controlled recovery.
    // Options:
    //   - recovery_mode: 'requeue' — create a new TRANSCRIBE job
    //   - recovery_mode: 'cancel'  — transition to failed for manual requeue
    // ========================================================
    if (action === "resolve_stuck_session") {
      const { session_id, recovery_mode, justification } = body as {
        session_id:    string;
        recovery_mode: "requeue" | "cancel";
        justification?: string;
      };

      if (!session_id)     throw Object.assign(new Error("MISSING_PARAM: session_id required"), { status: 400 });
      if (!recovery_mode)  throw Object.assign(new Error("MISSING_PARAM: recovery_mode required (requeue|cancel)"), { status: 400 });
      if (!["requeue", "cancel"].includes(recovery_mode)) {
        throw Object.assign(new Error("INVALID_PARAM: recovery_mode must be 'requeue' or 'cancel'"), { status: 400 });
      }

      const idempotencyKey = `resolve_stuck:${session_id}:${userId}:${Math.floor(Date.now() / 3600000)}`;
      const idem = await checkIdempotency(idempotencyKey);
      if (idem.alreadyExecuted) {
        return new Response(
          JSON.stringify({ ok: true, idempotent: true, previous_result: idem.previousResult, trace_id: ctx.trace_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session } = await adminClient
        .from("sessions")
        .select("id, office_id, status, aggregate_session_hash, current_snapshot_id, processing_step")
        .eq("id", session_id)
        .single();

      if (!session || session.office_id !== officeId) {
        throw Object.assign(new Error("FORBIDDEN: Session not in your office"), { status: 403 });
      }

      // Verify session is actually stuck (not in a terminal state)
      const TERMINAL_STATES = ["approved", "archived", "cancelled"];
      if (TERMINAL_STATES.includes(session.status)) {
        throw Object.assign(
          new Error(`REJECTED: Session is in terminal status "${session.status}" — nothing to recover`),
          { status: 422 }
        );
      }

      // Diagnose: check live jobs
      const { data: liveJobs } = await adminClient
        .from("session_jobs")
        .select("id, job_type, status, attempt_count, last_error, side_effect_confirmed")
        .eq("session_id", session_id)
        .in("status", ["queued", "claimed", "running", "heartbeat_lost", "failed"])
        .order("created_at", { ascending: false })
        .limit(5);

      const diagnosis = {
        session_status:   session.status,
        processing_step:  session.processing_step,
        live_jobs_count:  (liveJobs ?? []).length,
        live_jobs:        liveJobs ?? [],
        has_snapshot:     !!session.current_snapshot_id,
        has_recording:    !!session.aggregate_session_hash,
      };

      let recoveryResult: Record<string, unknown> = {};

      if (recovery_mode === "cancel") {
        // Cancel all live jobs and transition session to failed
        await adminClient.from("session_jobs").update({
          status:    "cancelled",
          last_error: `Cancelled by resolve_stuck_session operator action (${userId})`,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", session_id)
        .in("status", ["queued", "claimed", "running", "heartbeat_lost"]);

        try {
          await operatorTransitionSession(
            session_id, "failed",
            `Resolved stuck session via cancel mode by ${userId}: ${justification ?? "no reason"}`,
            officeId
          );
        } catch (fsmErr) {
          console.error(`[resolve_stuck] FSM cancel failed: ${(fsmErr as Error).message}`);
        }

        recoveryResult = { action_taken: "session_cancelled", new_status: "failed" };

      } else if (recovery_mode === "requeue") {
        // Verify recording data exists
        if (!session.aggregate_session_hash) {
          throw Object.assign(
            new Error("REJECTED: Cannot requeue — session has no recording data (aggregate_session_hash missing)"),
            { status: 422 }
          );
        }

        // Cancel any stuck live jobs first
        await adminClient.from("session_jobs").update({
          status:    "cancelled",
          last_error: "Cancelled by resolve_stuck_session before requeue",
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", session_id)
        .in("status", ["heartbeat_lost", "failed"]);

        // Transition session to ready_for_transcription
        try {
          await operatorTransitionSession(
            session_id, "ready_for_transcription",
            `Resolved stuck session via requeue by ${userId}: ${justification ?? "no reason"}`,
            officeId
          );
        } catch (fsmErr) {
          // If FSM rejects this path, try failed first then retry
          console.error(`[resolve_stuck] FSM requeue failed: ${(fsmErr as Error).message}`);
          await operatorTransitionSession(session_id, "failed", "Intermediate failed for requeue recovery", officeId);
          await operatorTransitionSession(session_id, "ready_for_transcription", "Requeue after recovery", officeId);
        }

        // Create new TRANSCRIBE job
        const newJobKey = `transcribe:${session_id}:${session.aggregate_session_hash}:stuck_recovery:${Date.now()}`;
        const { data: newJob } = await adminClient.from("session_jobs").insert({
          session_id:      session_id,
          office_id:       officeId,
          job_type:        "TRANSCRIBE",
          idempotency_key: newJobKey,
          config_json:     {},
          priority:        10,
          status:          "queued",
        }).select("id").single();

        recoveryResult = {
          action_taken: "session_requeued",
          new_status:   "ready_for_transcription",
          new_job_id:   (newJob as Record<string, unknown>)?.id,
        };
      }

      // Resolve open stuck_session alerts
      const resolvedCount = await resolveSessionAlerts(
        session_id, userId,
        `Resolved by resolve_stuck_session (${recovery_mode}): ${justification ?? "no reason"}`
      );

      await logOperatorAction({
        operatorId: userId, operatorRole: role, officeId,
        actionType: "resolve_stuck_session", targetResourceType: "session", targetResourceId: session_id,
        justification: justification ?? null, idempotencyKey,
        executionResult: "success", traceId: ctx.trace_id,
      });

      return new Response(
        JSON.stringify({
          ok:              true,
          session_id,
          diagnosis,
          recovery:        recoveryResult,
          alerts_resolved: resolvedCount,
          trace_id:        ctx.trace_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================
    // ACTION: inspect_health_alerts — Stage 11 NEW
    // Returns open health alerts for operator's office.
    // Read-only — no FSM changes, no confirmation required.
    // ========================================================
    if (action === "inspect_health_alerts") {
      const { session_id, include_resolved, limit: reqLimit } = body as {
        session_id?:       string;
        include_resolved?: boolean;
        limit?:            number;
      };

      let query = adminClient
        .from("session_health_alerts")
        .select("id, session_id, alert_type, severity, detail, resolved_at, resolution_note, created_at")
        .eq("office_id", officeId)
        .order("created_at", { ascending: false })
        .limit(Math.min(reqLimit ?? 50, 100));

      if (session_id) {
        query = query.eq("session_id", session_id);
      }

      if (!include_resolved) {
        query = query.is("resolved_at", null);
      }

      const { data: alerts, error } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({
          ok:     true,
          alerts: alerts ?? [],
          total:  (alerts ?? []).length,
          trace_id: ctx.trace_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown action
    // ========================================================
    // ACTION: manage_kill_switch — Stage 12 NEW
    // Allows operators to activate/deactivate kill switches.
    // ========================================================
    if (action === "manage_kill_switch") {
      if (role !== "OWNER") {
        throw Object.assign(new Error("FORBIDDEN: manage_kill_switch requires OWNER role"), { status: 403 });
      }

      const { operation, switch_type, switch_id, confirmation_token, deactivation_reason, scope, scope_id: ksScope } = body as {
        operation:            string;
        switch_type?:         string;
        switch_id?:           string;
        confirmation_token?:  string;
        deactivation_reason?: string;
        scope?:               string;
        scope_id?:            string;
      };

      if (!operation) throw Object.assign(new Error("MISSING_PARAM: operation required (activate|confirm|deactivate|list)"), { status: 400 });

      if (operation === "activate") {
        if (!switch_type) throw Object.assign(new Error("MISSING_PARAM: switch_type required"), { status: 400 });
        const reason = (body as Record<string, string>).reason ?? "Operator activation via admin panel";
        const { data, error } = await adminClient.rpc("activate_kill_switch", {
          p_switch_type: switch_type,
          p_scope:       scope ?? "office",
          p_scope_id:    ksScope ?? officeId,
          p_reason:      reason,
        });
        if (error) throw new Error(`KILL_SWITCH_ERROR: ${error.message}`);
        return new Response(JSON.stringify({ ok: true, result: data, trace_id: ctx.trace_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (operation === "confirm") {
        if (!switch_id || !confirmation_token) throw Object.assign(new Error("MISSING_PARAM: switch_id and confirmation_token required"), { status: 400 });
        const { data, error } = await adminClient.rpc("confirm_kill_switch", {
          p_switch_id:          switch_id,
          p_confirmation_token: confirmation_token,
        });
        if (error) throw new Error(`KILL_SWITCH_ERROR: ${error.message}`);
        return new Response(JSON.stringify({ ok: true, result: data, trace_id: ctx.trace_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (operation === "deactivate") {
        if (!switch_id) throw Object.assign(new Error("MISSING_PARAM: switch_id required"), { status: 400 });
        if (!hasOperatorConfirmation(req)) {
          throw Object.assign(new Error("CONFIRMATION_REQUIRED: Add header x-operator-confirm: CONFIRMED to deactivate kill switch"), { status: 400 });
        }
        const { data, error } = await adminClient.rpc("deactivate_kill_switch", {
          p_switch_id: switch_id,
          p_reason:    deactivation_reason ?? "Operator deactivation via admin panel",
        });
        if (error) throw new Error(`KILL_SWITCH_ERROR: ${error.message}`);
        return new Response(JSON.stringify({ ok: true, result: data, trace_id: ctx.trace_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (operation === "list") {
        const { data: switches } = await adminClient
          .from("system_kill_switches")
          .select("id, switch_type, scope, scope_id, is_active, activated_by, activated_at, activation_reason, deactivated_at")
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: false });
        return new Response(JSON.stringify({ ok: true, switches: switches ?? [], trace_id: ctx.trace_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      throw Object.assign(new Error(`INVALID_PARAM: operation "${operation}" not recognized`), { status: 400 });
    }

    // ========================================================
    // ACTION: run_readiness_check — Stage 12 NEW
    // Runs the production readiness gates and returns results.
    // ========================================================
    if (action === "run_readiness_check") {
      const { data: readiness, error: readinessErr } = await adminClient.rpc("run_readiness_checks", {
        p_trigger: "manual",
      });
      if (readinessErr) throw new Error(`READINESS_ERROR: ${readinessErr.message}`);
      return new Response(
        JSON.stringify({ ok: true, readiness, trace_id: ctx.trace_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown action
    throw Object.assign(new Error(`UNKNOWN_ACTION: "${action}" is not a recognized operator action`), { status: 400 });

  } catch (error) {
    const err = error as Error & { status?: number };
    console.error(`[session-admin-actions] Failure [${action}]: ${err.message}`);
    const status = err.status ?? (
      err.message.includes("UNAUTHORIZED")          ? 401 :
      err.message.includes("FORBIDDEN")             ? 403 :
      err.message.includes("REJECTED")              ? 422 :
      err.message.includes("CONFIRMATION_REQUIRED") ? 400 : 500
    );
    return new Response(
      JSON.stringify({ error: err.message, trace_id: ctx?.trace_id }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
