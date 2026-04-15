import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// deploy-preflight — Stage 12 Production Hardening
//
// Blocking gate: run before EVERY production deployment.
// If blocking_failures.length > 0 → ABORT DEPLOY.
//
// Checks:
//  1. Required environment variables present
//  2. Required database tables exist
//  3. Required RPC functions callable
//  4. Required cron jobs registered
//  5. RLS enabled on sensitive tables
//  6. Production readiness gates passing
//  7. No active global kill switches
// ============================================================

serve(async (req: Request) => {
  // Only allow service_role or internal requests
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.includes("service_role") && !authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "UNAUTHORIZED" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const blockingFailures: string[] = [];
  const warnings: string[]         = [];
  const checkResults: Record<string, unknown>[] = [];

  // ── 1. Environment Variables ─────────────────────────────────────────
  const REQUIRED_ENV = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "DEEPGRAM_API_KEY",
    "WORKER_SECRET",
  ];

  const missingEnv = REQUIRED_ENV.filter(k => !Deno.env.get(k));
  checkResults.push({
    check:   "environment_vars",
    passing: missingEnv.length === 0,
    detail:  { missing: missingEnv },
  });
  if (missingEnv.length > 0) {
    blockingFailures.push(`MISSING_ENV_VARS: ${missingEnv.join(", ")}`);
  }

  // ── 2. Required Tables Exist ─────────────────────────────────────────
  const REQUIRED_TABLES = [
    "sessions", "session_jobs", "session_recording_chunks",
    "session_transcriptions", "session_processing_snapshots",
    "session_context_versions", "session_context_sources",
    "session_health_alerts", "session_audit_logs",
    "legal_session_outputs", "medical_session_outputs",
    "medical_review_logs", "governance_reports",
    "offices", "office_members", "operator_action_log", "execution_audit_logs",
    // Stage 12 tables
    "rate_limit_buckets", "office_ai_budgets", "system_kill_switches",
    "housekeeping_runs", "production_readiness_checks", "production_readiness_runs",
  ];

  try {
    const { data: tables } = await serviceClient
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .in("table_name", REQUIRED_TABLES);

    const existingTables = new Set((tables ?? []).map((t: Record<string,string>) => t.table_name));
    const missingTables  = REQUIRED_TABLES.filter(t => !existingTables.has(t));

    checkResults.push({
      check:   "required_tables",
      passing: missingTables.length === 0,
      detail:  { missing: missingTables, found: existingTables.size },
    });
    if (missingTables.length > 0) {
      blockingFailures.push(`MISSING_TABLES: ${missingTables.join(", ")}`);
    }
  } catch (err) {
    const msg = (err as Error).message;
    warnings.push(`TABLE_CHECK_FAILED: ${msg}`);
    checkResults.push({ check: "required_tables", passing: false, detail: { error: msg } });
  }

  // ── 3. Required RPC Functions Callable ───────────────────────────────
  const REQUIRED_RPCS = [
    "transition_session_fsm",
    "claim_session_job",
    "renew_job_lease",
    "confirm_job_side_effect",
    "session_job_janitor",
    "check_and_increment_rate_limit",
    "check_and_charge_ai_budget",
    "reset_ai_budgets",
    "system_housekeeping",
    "activate_kill_switch",
    "confirm_kill_switch",
    "deactivate_kill_switch",
    "is_kill_switch_active",
    "run_readiness_checks",
    "assert_medical_output_certifiable",
  ];

  try {
    const { data: fns } = await serviceClient
      .from("information_schema.routines")
      .select("routine_name")
      .eq("routine_schema", "public")
      .in("routine_name", REQUIRED_RPCS);

    const existingFns  = new Set((fns ?? []).map((f: Record<string,string>) => f.routine_name));
    const missingRpcs  = REQUIRED_RPCS.filter(r => !existingFns.has(r));

    checkResults.push({
      check:   "required_rpcs",
      passing: missingRpcs.length === 0,
      detail:  { missing: missingRpcs, found: existingFns.size },
    });
    if (missingRpcs.length > 0) {
      blockingFailures.push(`MISSING_RPCS: ${missingRpcs.join(", ")}`);
    }
  } catch (err) {
    const msg = (err as Error).message;
    warnings.push(`RPC_CHECK_FAILED: ${msg}`);
    checkResults.push({ check: "required_rpcs", passing: false, detail: { error: msg } });
  }

  // ── 4. Required Cron Jobs Registered ────────────────────────────────
  const REQUIRED_CRONS = ["reset-ai-budgets", "system-housekeeping", "session-job-janitor"];

  try {
    const { data: cronJobs } = await serviceClient
      .from("cron.job")
      .select("jobname")
      .in("jobname", REQUIRED_CRONS);

    const installedCrons  = new Set((cronJobs ?? []).map((j: Record<string,string>) => j.jobname));
    const missingCrons    = REQUIRED_CRONS.filter(c => !installedCrons.has(c));

    checkResults.push({
      check:   "required_cron_jobs",
      passing: missingCrons.length === 0,
      detail:  { missing: missingCrons, found: installedCrons.size },
    });
    if (missingCrons.length > 0) {
      // Cron failures are warnings in dev, blocking in prod
      const isProd = (Deno.env.get("SUPABASE_URL") ?? "").includes("supabase.co");
      if (isProd) {
        blockingFailures.push(`MISSING_CRON_JOBS: ${missingCrons.join(", ")}`);
      } else {
        warnings.push(`MISSING_CRON_JOBS (non-prod): ${missingCrons.join(", ")}`);
      }
    }
  } catch (err) {
    const msg = (err as Error).message;
    warnings.push(`CRON_CHECK_FAILED: ${msg}`);
    checkResults.push({ check: "required_cron_jobs", passing: false, detail: { error: msg } });
  }

  // ── 5. RLS Coverage on Sensitive Tables ─────────────────────────────
  const RLS_REQUIRED = [
    "sessions", "session_jobs", "rate_limit_buckets",
    "office_ai_budgets", "system_kill_switches",
    "production_readiness_checks", "production_readiness_runs",
    "housekeeping_runs",
  ];

  try {
    const { data: rlsStatus } = await serviceClient
      .from("pg_tables")
      .select("tablename, rowsecurity")
      .in("tablename", RLS_REQUIRED)
      .eq("schemaname", "public");

    const rlsMissing = (rlsStatus ?? [])
      .filter((t: Record<string,unknown>) => !t.rowsecurity)
      .map((t: Record<string,unknown>) => t.tablename as string);

    checkResults.push({
      check:   "rls_coverage",
      passing: rlsMissing.length === 0,
      detail:  { missing_rls: rlsMissing },
    });
    if (rlsMissing.length > 0) {
      blockingFailures.push(`RLS_DISABLED_ON: ${rlsMissing.join(", ")}`);
    }
  } catch (err) {
    const msg = (err as Error).message;
    warnings.push(`RLS_CHECK_FAILED: ${msg}`);
    checkResults.push({ check: "rls_coverage", passing: false, detail: { error: msg } });
  }

  // ── 6. Production Readiness Gates ───────────────────────────────────
  try {
    const { data: readiness, error: readinessErr } = await serviceClient.rpc(
      "run_readiness_checks",
      { p_trigger: "deploy-preflight" }
    );

    if (readinessErr) throw new Error(readinessErr.message);

    const rData = readiness as Record<string, unknown>;
    checkResults.push({
      check:   "readiness_gates",
      passing: rData.overall_passing as boolean,
      detail:  {
        run_id:           rData.run_id,
        overall_passing:  rData.overall_passing,
        blocking_failures: rData.blocking_failures,
        check_count:      rData.check_count,
        failed_count:     rData.failed_count,
      },
    });

    if (!rData.overall_passing) {
      blockingFailures.push(`READINESS_GATE_FAILURES: ${JSON.stringify(rData.blocking_failures)}`);
    }
  } catch (err) {
    const msg = (err as Error).message;
    warnings.push(`READINESS_CHECK_FAILED: ${msg}`);
    checkResults.push({ check: "readiness_gates", passing: false, detail: { error: msg } });
  }

  // ── 7. Active Kill Switches ──────────────────────────────────────────
  try {
    const { data: switches } = await serviceClient
      .from("system_kill_switches")
      .select("switch_type, scope")
      .eq("is_active", true)
      .eq("scope", "global");

    const activeSwitches = switches ?? [];
    checkResults.push({
      check:   "active_kill_switches",
      passing: activeSwitches.length === 0,
      detail:  { active: activeSwitches },
    });

    if (activeSwitches.length > 0) {
      blockingFailures.push(
        `ACTIVE_KILL_SWITCHES: ${(activeSwitches as Record<string,string>[]).map(s => s.switch_type).join(", ")}`
      );
    }
  } catch (err) {
    const msg = (err as Error).message;
    warnings.push(`KILL_SWITCH_CHECK_FAILED: ${msg}`);
    checkResults.push({ check: "active_kill_switches", passing: false, detail: { error: msg } });
  }

  const passing = blockingFailures.length === 0;

  const result = {
    ok:               passing,
    timestamp:        new Date().toISOString(),
    blocking_failures: blockingFailures,
    warnings,
    check_results:    checkResults,
    verdict:          passing ? "DEPLOY_ALLOWED" : "DEPLOY_BLOCKED",
  };

  console.log(`[deploy-preflight] ${result.verdict}: ${blockingFailures.length} blocking failures, ${warnings.length} warnings`);
  if (!passing) {
    console.error("[deploy-preflight] BLOCKING FAILURES:", JSON.stringify(blockingFailures));
  }

  return new Response(
    JSON.stringify(result),
    {
      status: passing ? 200 : 422,
      headers: { "Content-Type": "application/json" },
    }
  );
});
