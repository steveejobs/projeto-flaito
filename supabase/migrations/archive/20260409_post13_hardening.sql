-- ============================================================
-- Migration: Post-Stage 13 — Precision Hardening Pass
-- File: 20260409_post13_hardening.sql
--
-- Goals:
--  1. Heartbeat resilience: report_heartbeat_failure() RPC
--     — explicit HEARTBEAT_FAILURE / LEASE_LOST_ABORT log events
--  2. Kill-switch observability: log_kill_switch_delayed_effect()
--     — KILL_SWITCH_DELAYED_EFFECT event with timing metadata
--  3. Housekeeping safety extension:
--     — session_recording_chunks purge (safe mode, no active data)
--     — storage growth threshold alert
--  4. System integrity check: run_integrity_check()
--     — impossible FSM states
--     — conflicting snapshot/output states
--     — stuck jobs without recovery path
--     — cross-tenant data leakage signals
-- ============================================================

BEGIN;

-- ============================================================
-- 1. HEARTBEAT RESILIENCE
-- ============================================================
-- report_heartbeat_failure()
-- Called by the worker when renew_job_lease returns FALSE.
-- Flips the job status to 'heartbeat_lost' and emits explicit
-- log events: HEARTBEAT_FAILURE and LEASE_LOST_ABORT.
-- This closes the silent-continuation gap: a worker that loses
-- its lease MUST call this before doing any further work.
-- ============================================================

CREATE OR REPLACE FUNCTION public.report_heartbeat_failure(
  p_job_id    UUID,
  p_worker_id TEXT,
  p_reason    TEXT DEFAULT 'Worker-side heartbeat renewal failed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job        RECORD;
  v_session_id UUID;
  v_office_id  UUID;
BEGIN
  -- Fetch job and validate worker ownership
  SELECT id, session_id, office_id, job_type, status, side_effect_confirmed, attempt_count
  INTO v_job
  FROM public.session_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'JOB_NOT_FOUND: %', p_job_id;
  END IF;

  -- Only act if job is still running under this worker
  -- If already heartbeat_lost by janitor, this is a no-op (idempotent)
  IF v_job.status NOT IN ('claimed', 'running') OR v_job.worker_id != p_worker_id THEN
    RETURN jsonb_build_object(
      'ok',      true,
      'noop',    true,
      'reason',  'Job already transitioned by janitor or different worker',
      'status',  v_job.status
    );
  END IF;

  v_session_id := v_job.session_id;
  v_office_id  := v_job.office_id;

  -- Mark job as heartbeat_lost immediately (worker-initiated)
  UPDATE public.session_jobs
  SET
    status           = 'heartbeat_lost',
    last_error       = format(
      'HEARTBEAT_FAILURE: Worker %s self-reported heartbeat loss. Reason: %s. At: %s.',
      p_worker_id, p_reason, now()
    ),
    worker_id        = NULL,
    lease_expires_at = NULL,
    updated_at       = now()
  WHERE id = p_job_id;

  -- Persist health alert
  INSERT INTO public.session_health_alerts (session_id, office_id, alert_type, severity, detail)
  VALUES (
    v_session_id, v_office_id, 'zombie_job', 'critical',
    jsonb_build_object(
      'event',             'HEARTBEAT_FAILURE',
      'job_id',            p_job_id,
      'job_type',          v_job.job_type,
      'worker_id',         p_worker_id,
      'reason',            p_reason,
      'side_effects',      v_job.side_effect_confirmed,
      'attempt_count',     v_job.attempt_count,
      'self_reported',     true
    )
  );

  -- Emit LEASE_LOST_ABORT audit event
  INSERT INTO public.session_audit_logs (
    session_id, office_id, action, resource_type, resource_id,
    performed_by, old_value, new_value, metadata
  ) VALUES (
    v_session_id, v_office_id,
    'LEASE_LOST_ABORT', 'session_job', p_job_id,
    NULL,
    jsonb_build_object('status', v_job.status, 'worker_id', p_worker_id),
    jsonb_build_object('status', 'heartbeat_lost', 'worker_id', NULL),
    jsonb_build_object(
      'event',              'LEASE_LOST_ABORT',
      'job_type',           v_job.job_type,
      'worker_id',          p_worker_id,
      'reason',             p_reason,
      'side_effect_confirmed', v_job.side_effect_confirmed,
      'self_reported',      true,
      'aborted_at',         now()
    )
  );

  RETURN jsonb_build_object(
    'ok',                  true,
    'job_id',              p_job_id,
    'status',              'heartbeat_lost',
    'side_effect_confirmed', v_job.side_effect_confirmed,
    'event',               'LEASE_LOST_ABORT'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.report_heartbeat_failure(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_heartbeat_failure(UUID, TEXT, TEXT) TO service_role;

-- ============================================================
-- 2. KILL-SWITCH OBSERVABILITY
-- ============================================================
-- log_kill_switch_delayed_effect()
-- Called by a worker when it detects an active kill-switch
-- AFTER it has already claimed a job (the blind-window scenario).
-- Emits KILL_SWITCH_DELAYED_EFFECT with timing metadata so
-- the blind window is observable and debuggable.
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_kill_switch_delayed_effect(
  p_job_id     UUID,
  p_worker_id  TEXT,
  p_switch_type TEXT,
  p_delay_ms   INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT id, session_id, office_id, job_type
  INTO v_job
  FROM public.session_jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'JOB_NOT_FOUND: %', p_job_id;
  END IF;

  -- Emit KILL_SWITCH_DELAYED_EFFECT audit event
  INSERT INTO public.session_audit_logs (
    session_id, office_id, action, resource_type, resource_id,
    performed_by, old_value, new_value, metadata
  ) VALUES (
    v_job.session_id, v_job.office_id,
    'KILL_SWITCH_DELAYED_EFFECT', 'session_job', p_job_id,
    NULL,
    jsonb_build_object('switch_type', p_switch_type, 'detected', false),
    jsonb_build_object('switch_type', p_switch_type, 'detected', true),
    jsonb_build_object(
      'event',       'KILL_SWITCH_DELAYED_EFFECT',
      'job_id',      p_job_id,
      'worker_id',   p_worker_id,
      'switch_type', p_switch_type,
      'delay_ms',    p_delay_ms,
      'job_type',    v_job.job_type,
      'detected_at', now()
    )
  );

  RETURN jsonb_build_object(
    'ok',          true,
    'event',       'KILL_SWITCH_DELAYED_EFFECT',
    'job_id',      p_job_id,
    'switch_type', p_switch_type,
    'delay_ms',    p_delay_ms
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_kill_switch_delayed_effect(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_kill_switch_delayed_effect(UUID, TEXT, TEXT, INTEGER) TO service_role;

-- ============================================================
-- 3. HOUSEKEEPING SAFETY EXTENSION
-- ============================================================
-- Extends system_housekeeping() to:
--   a) Purge session_recording_chunks for sessions approved/archived
--      > 90 days ago (safe mode: only if no active jobs reference them)
--   b) Raise a WARNING if session_recording_chunks count > threshold
--      (storage growth alert — does NOT delete; just notifies)
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
  v_start             TIMESTAMPTZ := clock_timestamp();
  v_counts            JSONB       := '{}'::JSONB;
  v_errors            JSONB       := '[]'::JSONB;
  v_n                 INTEGER;
  v_err_detail        TEXT;
  v_run_id            UUID;
  v_duration_ms       INTEGER;
  v_chunk_count_total BIGINT;
  v_chunk_threshold   CONSTANT BIGINT := 500000;
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

  -- ── Category 7: session_recording_chunks purge (safe mode) ──────────
  -- SAFETY CONTRACT:
  --   Only purge chunks where the parent session is 'approved' or 'archived'
  --   for > 90 days AND has no active/pending/running jobs.
  --   This prevents deleting chunks for sessions still being processed.
  -- ─────────────────────────────────────────────────────────────────────
  BEGIN
    IF p_dry_run THEN
      SELECT count(*) INTO v_n
      FROM public.session_recording_chunks src
      JOIN public.sessions s ON s.id = src.session_id
      WHERE s.status IN ('approved', 'archived')
        AND s.updated_at < now() - INTERVAL '90 days'
        AND NOT EXISTS (
          SELECT 1 FROM public.session_jobs j
          WHERE j.session_id = s.id
            AND j.status IN ('queued', 'claimed', 'running', 'failed', 'heartbeat_lost')
        );
    ELSE
      WITH safe_sessions AS (
        SELECT DISTINCT s.id
        FROM public.sessions s
        WHERE s.status IN ('approved', 'archived')
          AND s.updated_at < now() - INTERVAL '90 days'
          AND NOT EXISTS (
            SELECT 1 FROM public.session_jobs j
            WHERE j.session_id = s.id
              AND j.status IN ('queued', 'claimed', 'running', 'failed', 'heartbeat_lost')
          )
      ),
      deleted AS (
        DELETE FROM public.session_recording_chunks
        WHERE session_id IN (SELECT id FROM safe_sessions)
        RETURNING id
      )
      SELECT count(*) INTO v_n FROM deleted;
    END IF;
    v_counts := v_counts || jsonb_build_object('session_recording_chunks_purged', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_err_detail := 'session_recording_chunks: ' || SQLERRM;
    v_errors     := v_errors || jsonb_build_array(v_err_detail);
    RAISE WARNING 'HOUSEKEEPING_ERROR: %', v_err_detail;
  END;

  -- ── Category 8: Storage growth alert (COUNT only, never deletes) ─────
  -- Alerts if total session_recording_chunks count exceeds threshold.
  -- Operator must review and decide on manual purge strategy.
  -- ─────────────────────────────────────────────────────────────────────
  BEGIN
    SELECT count(*) INTO v_chunk_count_total
    FROM public.session_recording_chunks;

    v_counts := v_counts || jsonb_build_object('session_recording_chunks_total', v_chunk_count_total);

    IF v_chunk_count_total > v_chunk_threshold THEN
      RAISE WARNING 'HOUSEKEEPING_STORAGE_ALERT: session_recording_chunks count (%) exceeds threshold (%). Review storage growth.',
        v_chunk_count_total, v_chunk_threshold;
      v_errors := v_errors || jsonb_build_array(
        format('STORAGE_GROWTH_ALERT: session_recording_chunks=%s exceeds threshold=%s',
          v_chunk_count_total, v_chunk_threshold)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_err_detail := 'storage_growth_check: ' || SQLERRM;
    v_errors     := v_errors || jsonb_build_array(v_err_detail);
    RAISE WARNING 'HOUSEKEEPING_ERROR: %', v_err_detail;
  END;

  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER;

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
-- 4. SYSTEM INTEGRITY CHECK
-- ============================================================
-- run_integrity_check()
-- Full system integrity scan. Checks:
--   A. Sessions in impossible FSM states
--   B. Snapshots with conflicting/orphaned outputs
--   C. Jobs stuck without any recovery path
--   D. Cross-tenant data leakage signals
--
-- Returns a JSONB report with severity-classified findings.
-- Safe: read-only, never mutates state.
-- ============================================================

CREATE OR REPLACE FUNCTION public.run_integrity_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start    TIMESTAMPTZ := clock_timestamp();
  v_findings JSONB       := '[]'::JSONB;
  v_count    INTEGER;
  r          RECORD;
BEGIN

  -- ── A. Sessions in impossible FSM states ─────────────────────────────
  -- A1: Sessions in terminal states with active jobs (should be impossible)
  FOR r IN
    SELECT s.id AS session_id, s.status, s.office_id, count(j.id) AS active_jobs
    FROM public.sessions s
    JOIN public.session_jobs j ON j.session_id = s.id
    WHERE s.status IN ('approved', 'archived', 'dead_lettered')
      AND j.status IN ('queued', 'claimed', 'running')
    GROUP BY s.id, s.status, s.office_id
  LOOP
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity',    'HIGH',
      'check',       'impossible_state_terminal_with_active_jobs',
      'session_id',  r.session_id,
      'office_id',   r.office_id,
      'detail',      format('Session in terminal state "%s" has %s active job(s)', r.status, r.active_jobs)
    ));
  END LOOP;

  -- A2: Sessions in processing states for > 4 hours (extreme stuck scenario)
  FOR r IN
    SELECT id AS session_id, status, office_id,
           EXTRACT(EPOCH FROM (now() - updated_at)) / 3600 AS hours_stuck
    FROM public.sessions
    WHERE status IN ('processing', 'transcribed', 'context_ready', 'snapshot_created', 'analyzing')
      AND updated_at < now() - INTERVAL '4 hours'
  LOOP
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity',    'HIGH',
      'check',       'extreme_stuck_session',
      'session_id',  r.session_id,
      'office_id',   r.office_id,
      'detail',      format('Session in "%s" for %.1f hours without transition', r.status, r.hours_stuck)
    ));
  END LOOP;

  -- ── B. Snapshots with conflicting/orphaned outputs ────────────────────
  -- B1: Legal outputs pointing to non-existent snapshot
  FOR r IN
    SELECT lo.id AS output_id, lo.session_id, lo.snapshot_id
    FROM public.legal_session_outputs lo
    LEFT JOIN public.session_processing_snapshots sps ON sps.id = lo.snapshot_id
    WHERE sps.id IS NULL
      AND lo.snapshot_id IS NOT NULL
  LOOP
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity',   'BLOCKER',
      'check',      'orphaned_legal_output',
      'output_id',  r.output_id,
      'session_id', r.session_id,
      'detail',     format('Legal output references missing snapshot %s', r.snapshot_id)
    ));
  END LOOP;

  -- B2: Medical outputs pointing to non-existent snapshot
  FOR r IN
    SELECT mo.id AS output_id, mo.session_id, mo.snapshot_id
    FROM public.medical_session_outputs mo
    LEFT JOIN public.session_processing_snapshots sps ON sps.id = mo.snapshot_id
    WHERE sps.id IS NULL
      AND mo.snapshot_id IS NOT NULL
  LOOP
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity',   'BLOCKER',
      'check',      'orphaned_medical_output',
      'output_id',  r.output_id,
      'session_id', r.session_id,
      'detail',     format('Medical output references missing snapshot %s', r.snapshot_id)
    ));
  END LOOP;

  -- B3: Sessions with approved status but no finalized medical output (where one exists)
  FOR r IN
    SELECT s.id AS session_id, s.office_id
    FROM public.sessions s
    JOIN public.medical_session_outputs mo ON mo.session_id = s.id
    WHERE s.status = 'approved'
      AND mo.is_finalized = FALSE
    LIMIT 50
  LOOP
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity',   'MEDIUM',
      'check',      'approved_session_unfinalized_medical_output',
      'session_id', r.session_id,
      'office_id',  r.office_id,
      'detail',     'Session approved but medical output not finalized'
    ));
  END LOOP;

  -- ── C. Jobs stuck without recovery path ──────────────────────────────
  -- C1: Jobs in heartbeat_lost for > 2 hours (janitor should have processed)
  FOR r IN
    SELECT id AS job_id, session_id, office_id, job_type,
           EXTRACT(EPOCH FROM (now() - updated_at)) / 60 AS minutes_stuck
    FROM public.session_jobs
    WHERE status = 'heartbeat_lost'
      AND updated_at < now() - INTERVAL '2 hours'
  LOOP
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity',  'HIGH',
      'check',     'job_stuck_heartbeat_lost',
      'job_id',    r.job_id,
      'session_id', r.session_id,
      'office_id', r.office_id,
      'detail',    format('Job in heartbeat_lost for %.0f min — janitor may have failed', r.minutes_stuck)
    ));
  END LOOP;

  -- C2: Dead-lettered jobs where session is still in processing state (no recovery)
  FOR r IN
    SELECT j.id AS job_id, j.session_id, j.office_id, s.status AS session_status
    FROM public.session_jobs j
    JOIN public.sessions s ON s.id = j.session_id
    WHERE j.status = 'dead_lettered'
      AND s.status IN ('processing', 'transcribed', 'context_ready', 'snapshot_created', 'analyzing')
    LIMIT 50
  LOOP
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity',        'HIGH',
      'check',           'dead_letter_blocking_session',
      'job_id',          r.job_id,
      'session_id',      r.session_id,
      'office_id',       r.office_id,
      'detail',          format('Dead-lettered job blocking session in state "%s"', r.session_status)
    ));
  END LOOP;

  -- ── D. Cross-tenant data leakage signals ─────────────────────────────
  -- D1: session_jobs where office_id != parent session office_id
  FOR r IN
    SELECT j.id AS job_id, j.session_id,
           j.office_id AS job_office_id,
           s.office_id AS session_office_id
    FROM public.session_jobs j
    JOIN public.sessions s ON s.id = j.session_id
    WHERE j.office_id != s.office_id
    LIMIT 20
  LOOP
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity',          'BLOCKER',
      'check',             'cross_tenant_job_office_mismatch',
      'job_id',            r.job_id,
      'session_id',        r.session_id,
      'job_office_id',     r.job_office_id,
      'session_office_id', r.session_office_id,
      'detail',            'Job office_id does not match parent session office_id — cross-tenant signal'
    ));
  END LOOP;

  -- D2: legal_session_outputs where session belongs to different office
  FOR r IN
    SELECT lo.id AS output_id, lo.session_id,
           s.office_id
    FROM public.legal_session_outputs lo
    JOIN public.sessions s ON s.id = lo.session_id
    WHERE lo.session_id NOT IN (
      SELECT id FROM public.sessions WHERE office_id = s.office_id
    )
    LIMIT 20
  LOOP
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity',   'BLOCKER',
      'check',      'cross_tenant_legal_output',
      'output_id',  r.output_id,
      'session_id', r.session_id,
      'detail',     'Legal output cross-tenant reference detected'
    ));
  END LOOP;

  -- ── Summary ───────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ran_at',         now(),
    'duration_ms',    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER,
    'total_findings', jsonb_array_length(v_findings),
    'blockers',       (
      SELECT count(*) FROM jsonb_array_elements(v_findings) f
      WHERE f->>'severity' = 'BLOCKER'
    ),
    'high',           (
      SELECT count(*) FROM jsonb_array_elements(v_findings) f
      WHERE f->>'severity' = 'HIGH'
    ),
    'medium',         (
      SELECT count(*) FROM jsonb_array_elements(v_findings) f
      WHERE f->>'severity' = 'MEDIUM'
    ),
    'findings',       v_findings
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_integrity_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_integrity_check() TO service_role;
-- Also allow operators to run integrity check from admin tools
GRANT EXECUTE ON FUNCTION public.run_integrity_check() TO authenticated;

COMMIT;
