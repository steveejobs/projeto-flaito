-- ============================================================
-- Migration: Stage 12 — Data Retention & Housekeeping
-- File: 20260416110000_stage12_retention.sql
--
-- Goals:
--  1. Retention policy per entity type (hard-coded lifecycle rules)
--  2. system_housekeeping(dry_run boolean) — safe rollout mode
--  3. Housekeeping audit log for every run
--  4. Cron: hourly housekeeping, session job janitor (existing)
--  5. All deletes use verified predicates (no unbounded deletes)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. HOUSEKEEPING AUDIT LOG
-- Every housekeeping run is recorded here.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.housekeeping_runs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  dry_run        BOOLEAN     NOT NULL DEFAULT false,
  deleted_counts JSONB       NOT NULL DEFAULT '{}',
  errors         JSONB       NOT NULL DEFAULT '[]',
  duration_ms    INTEGER,
  triggered_by   TEXT        NOT NULL DEFAULT 'cron'  -- 'cron' | 'manual' | 'api'
);

ALTER TABLE public.housekeeping_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "housekeeping_runs_service_role_all"
  ON public.housekeeping_runs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "housekeeping_runs_admin_read"
  ON public.housekeeping_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members
      WHERE user_id = auth.uid()
        AND role = 'OWNER'
        AND is_active = true
    )
  );

-- ============================================================
-- 2. RETENTION POLICY CONSTANTS
-- All durations are documented here as a single source of truth.
--
-- Entity                 | Rule
-- ---------------------- | -----------------------------------------
-- rate_limit_buckets     | 2 hours (hot operational data)
-- session_recording_chunks | 90 days after session approved/archived
-- session_jobs (terminal)  | 30 days after finished_at
-- session_health_alerts (resolved) | 90 days
-- housekeeping_runs      | 180 days
-- operator_action_log    | 365 days (compliance audit)
-- execution_audit_logs   | 60 days
-- ============================================================

-- ============================================================
-- 3. system_housekeeping()
-- Safe execution mode: pass dry_run=true to preview counts
-- without deleting anything.
-- Runs each category independently to prevent one error
-- blocking all others.
-- ============================================================
CREATE OR REPLACE FUNCTION public.system_housekeeping(
  p_dry_run     BOOLEAN DEFAULT FALSE,
  p_trigger     TEXT    DEFAULT 'cron'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start         TIMESTAMPTZ := clock_timestamp();
  v_counts        JSONB       := '{}'::JSONB;
  v_errors        JSONB       := '[]'::JSONB;
  v_n             INTEGER;
  v_err_detail    TEXT;
  v_run_id        UUID;
  v_duration_ms   INTEGER;
BEGIN

  -- ── Category 1: Rate limit buckets (older than 2 hours) ──────────────
  BEGIN
    IF p_dry_run THEN
      SELECT count(*) INTO v_n FROM public.rate_limit_buckets
      WHERE window_start < now() - INTERVAL '2 hours';
    ELSE
      WITH deleted AS (
        DELETE FROM public.rate_limit_buckets
        WHERE window_start < now() - INTERVAL '2 hours'
        RETURNING id
      ) SELECT count(*) INTO v_n FROM deleted;
    END IF;
    v_counts := v_counts || jsonb_build_object('rate_limit_buckets', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_err_detail := 'rate_limit_buckets: ' || SQLERRM;
    v_errors     := v_errors || jsonb_build_array(v_err_detail);
    RAISE WARNING 'HOUSEKEEPING_ERROR: %', v_err_detail;
  END;

  -- ── Category 2: Stale session jobs (terminal, older than 30 days) ───
  BEGIN
    IF p_dry_run THEN
      SELECT count(*) INTO v_n FROM public.session_jobs
      WHERE status IN ('succeeded', 'dead_lettered', 'cancelled')
        AND finished_at < now() - INTERVAL '30 days';
    ELSE
      WITH deleted AS (
        DELETE FROM public.session_jobs
        WHERE status IN ('succeeded', 'dead_lettered', 'cancelled')
          AND finished_at < now() - INTERVAL '30 days'
        RETURNING id
      ) SELECT count(*) INTO v_n FROM deleted;
    END IF;
    v_counts := v_counts || jsonb_build_object('stale_session_jobs', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_err_detail := 'stale_session_jobs: ' || SQLERRM;
    v_errors     := v_errors || jsonb_build_array(v_err_detail);
    RAISE WARNING 'HOUSEKEEPING_ERROR: %', v_err_detail;
  END;

  -- ── Category 3: Resolved health alerts (older than 90 days) ─────────
  BEGIN
    IF p_dry_run THEN
      SELECT count(*) INTO v_n FROM public.session_health_alerts
      WHERE resolved_at IS NOT NULL
        AND resolved_at < now() - INTERVAL '90 days';
    ELSE
      WITH deleted AS (
        DELETE FROM public.session_health_alerts
        WHERE resolved_at IS NOT NULL
          AND resolved_at < now() - INTERVAL '90 days'
        RETURNING id
      ) SELECT count(*) INTO v_n FROM deleted;
    END IF;
    v_counts := v_counts || jsonb_build_object('resolved_health_alerts', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_err_detail := 'resolved_health_alerts: ' || SQLERRM;
    v_errors     := v_errors || jsonb_build_array(v_err_detail);
    RAISE WARNING 'HOUSEKEEPING_ERROR: %', v_err_detail;
  END;

  -- ── Category 4: Old housekeeping runs (older than 180 days) ─────────
  BEGIN
    IF p_dry_run THEN
      SELECT count(*) INTO v_n FROM public.housekeeping_runs
      WHERE ran_at < now() - INTERVAL '180 days';
    ELSE
      WITH deleted AS (
        DELETE FROM public.housekeeping_runs
        WHERE ran_at < now() - INTERVAL '180 days'
        RETURNING id
      ) SELECT count(*) INTO v_n FROM deleted;
    END IF;
    v_counts := v_counts || jsonb_build_object('old_housekeeping_runs', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_err_detail := 'old_housekeeping_runs: ' || SQLERRM;
    v_errors     := v_errors || jsonb_build_array(v_err_detail);
    RAISE WARNING 'HOUSEKEEPING_ERROR: %', v_err_detail;
  END;

  -- ── Category 5: Stale execution audit logs (older than 60 days) ─────
  BEGIN
    IF p_dry_run THEN
      SELECT count(*) INTO v_n FROM public.execution_audit_logs
      WHERE created_at < now() - INTERVAL '60 days';
    ELSE
      WITH deleted AS (
        DELETE FROM public.execution_audit_logs
        WHERE created_at < now() - INTERVAL '60 days'
        RETURNING id
      ) SELECT count(*) INTO v_n FROM deleted;
    END IF;
    v_counts := v_counts || jsonb_build_object('stale_execution_audit_logs', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_err_detail := 'execution_audit_logs: ' || SQLERRM;
    v_errors     := v_errors || jsonb_build_array(v_err_detail);
    RAISE WARNING 'HOUSEKEEPING_ERROR: %', v_err_detail;
  END;

  -- ── Category 6: Old operator action logs (> 365 days) — READ ONLY ───
  -- Operator logs are compliance artifacts. Only COUNT even in production.
  BEGIN
    SELECT count(*) INTO v_n FROM public.operator_action_log
    WHERE created_at < now() - INTERVAL '365 days';
    v_counts := v_counts || jsonb_build_object('old_operator_action_logs_DRY_ONLY', v_n);
    IF NOT p_dry_run AND v_n > 0 THEN
      RAISE LOG 'HOUSEKEEPING: % old operator_action_log records found (> 365 days). Manual review required before deletion.', v_n;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_err_detail := 'operator_action_log: ' || SQLERRM;
    v_errors     := v_errors || jsonb_build_array(v_err_detail);
  END;

  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER;

  -- Persist audit record
  INSERT INTO public.housekeeping_runs (dry_run, deleted_counts, errors, duration_ms, triggered_by)
  VALUES (p_dry_run, v_counts, v_errors, v_duration_ms, p_trigger)
  RETURNING id INTO v_run_id;

  RETURN jsonb_build_object(
    'run_id',       v_run_id,
    'dry_run',      p_dry_run,
    'duration_ms',  v_duration_ms,
    'counts',       v_counts,
    'errors',       v_errors,
    'error_count',  jsonb_array_length(v_errors)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.system_housekeeping(BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.system_housekeeping(BOOLEAN, TEXT) TO service_role;

-- ============================================================
-- 4. SCHEDULE: Hourly housekeeping cron
-- ============================================================
SELECT cron.unschedule('system-housekeeping')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'system-housekeeping');

SELECT cron.schedule(
  'system-housekeeping',
  '0 * * * *',
  $$SELECT public.system_housekeeping(false, 'cron');$$
);

-- ============================================================
-- 5. SCHEDULE: Session job janitor (re-declare to ensure exists)
-- Original in Stage 11 — idempotent re-registration
-- ============================================================
SELECT cron.unschedule('session-job-janitor')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'session-job-janitor');

SELECT cron.schedule(
  'session-job-janitor',
  '*/5 * * * *',
  $$SELECT public.session_job_janitor();$$
);

COMMIT;
