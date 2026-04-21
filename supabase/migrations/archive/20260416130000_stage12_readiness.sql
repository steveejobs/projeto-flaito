-- ============================================================
-- Migration: Stage 12 — Production Readiness Gates
-- File: 20260416130000_stage12_readiness.sql
--
-- Goals:
--  1. production_readiness_checks — defines SLO thresholds per check
--  2. production_readiness_runs   — persists every run (trend analysis)
--  3. run_readiness_checks()      — executes all checks atomically
-- ============================================================

BEGIN;

-- ============================================================
-- 1. READINESS CHECK DEFINITIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.production_readiness_checks (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name      TEXT    NOT NULL UNIQUE,
  description     TEXT    NOT NULL,
  -- category: 'dead_letter' | 'stuck_session' | 'budget' | 'kill_switch' | 'cron' | 'rate_limit'
  category        TEXT    NOT NULL,
  -- threshold: numeric threshold for the check (depends on category)
  threshold       NUMERIC,
  threshold_unit  TEXT,
  is_blocking     BOOLEAN NOT NULL DEFAULT true,   -- blocks go-live if failing
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.production_readiness_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "readiness_checks_service_role_all"
  ON public.production_readiness_checks FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "readiness_checks_admin_read"
  ON public.production_readiness_checks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND is_active = true
    )
  );

-- ============================================================
-- 2. PRODUCTION READINESS RUNS TABLE
-- Persists every run for trend analysis and incident review.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.production_readiness_runs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  overall_passing   BOOLEAN     NOT NULL,
  blocking_failures JSONB       NOT NULL DEFAULT '[]',
  warning_failures  JSONB       NOT NULL DEFAULT '[]',
  all_results       JSONB       NOT NULL DEFAULT '[]',
  check_count       INTEGER     NOT NULL DEFAULT 0,
  failed_count      INTEGER     NOT NULL DEFAULT 0,
  triggered_by      TEXT        NOT NULL DEFAULT 'manual'  -- 'manual' | 'deploy-preflight' | 'cron'
);

ALTER TABLE public.production_readiness_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "readiness_runs_service_role_all"
  ON public.production_readiness_runs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "readiness_runs_admin_read"
  ON public.production_readiness_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_readiness_runs_time
  ON public.production_readiness_runs(ran_at DESC);

CREATE INDEX IF NOT EXISTS idx_readiness_runs_failing
  ON public.production_readiness_runs(overall_passing, ran_at DESC)
  WHERE overall_passing = false;

-- ============================================================
-- 3. SEED: Canonical readiness check definitions
-- ============================================================
INSERT INTO public.production_readiness_checks (check_name, description, category, threshold, threshold_unit, is_blocking)
VALUES
  -- Dead-letter checks
  ('dead_letter_rate',         'Dead-lettered jobs in last 1h < 5% of total',          'dead_letter',  5,   'percent',   true),
  ('dead_letter_absolute',     'Absolute dead-lettered jobs in last 24h < 50',          'dead_letter',  50,  'count',     true),
  -- Stuck session checks
  ('stuck_session_age',        'No sessions in processing state > 60 minutes',          'stuck_session', 60, 'minutes',   true),
  ('stuck_sessions_count',     'Active stuck sessions (> 30 min) < 3',                 'stuck_session', 3,  'count',     false),
  -- Budget checks
  ('budget_pct_remaining',     'At least one office with > 20% daily budget remaining', 'budget',       20,  'percent',   false),
  ('active_kill_switches',     'No global kill switches currently active',               'kill_switch',  0,   'count',     true),
  -- Cron health checks
  ('housekeeping_last_run',    'system_housekeeping ran within last 2 hours',           'cron',         2,   'hours',     false),
  ('budget_reset_last_run',    'reset_ai_budgets ran within last 25 hours',             'cron',         25,  'hours',     false),
  -- Rate limit checks
  ('rate_limit_blocked_pct',   'Rate limit block rate in last 1h < 10% of calls',       'rate_limit',   10,  'percent',   false),
  -- Health alerts
  ('open_critical_alerts',     'Unresolved critical health alerts < 5',                 'health',       5,   'count',     true)
ON CONFLICT (check_name) DO UPDATE
SET description = EXCLUDED.description,
    threshold   = EXCLUDED.threshold,
    is_blocking = EXCLUDED.is_blocking;

-- ============================================================
-- 4. run_readiness_checks()
-- Executes all active checks, persists the run, returns summary.
-- ============================================================
CREATE OR REPLACE FUNCTION public.run_readiness_checks(
  p_trigger TEXT DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results          JSONB  := '[]'::JSONB;
  v_blocking_fail    JSONB  := '[]'::JSONB;
  v_warning_fail     JSONB  := '[]'::JSONB;
  v_overall          BOOLEAN := true;
  v_check_count      INTEGER := 0;
  v_failed_count     INTEGER := 0;
  v_run_id           UUID;

  -- Variables for individual checks
  v_dead_letter_1h      BIGINT;
  v_total_jobs_1h       BIGINT;
  v_dead_letter_pct     NUMERIC;
  v_dead_letter_24h     BIGINT;
  v_max_stuck_minutes   NUMERIC;
  v_stuck_count_30m     BIGINT;
  v_active_global_ks    BIGINT;
  v_hk_last_min_ago     NUMERIC;
  v_budget_last_min_ago NUMERIC;
  v_rate_blocked        BIGINT;
  v_rate_total          BIGINT;
  v_rate_block_pct      NUMERIC;
  v_open_crit_alerts    BIGINT;

  v_passing BOOLEAN;
  v_detail  JSONB;

  -- Helper to append check result
BEGIN

  /* ── 1. Dead-letter rate last 1h ───────────────────────────────────── */
  BEGIN
    SELECT
      COUNT(*) FILTER (WHERE status = 'dead_lettered' AND updated_at >= now() - INTERVAL '1 hour'),
      COUNT(*) FILTER (WHERE updated_at >= now() - INTERVAL '1 hour')
    INTO v_dead_letter_1h, v_total_jobs_1h
    FROM public.session_jobs;

    v_dead_letter_pct := CASE WHEN v_total_jobs_1h = 0 THEN 0
                              ELSE (v_dead_letter_1h::NUMERIC / v_total_jobs_1h) * 100 END;

    v_passing := v_dead_letter_pct < 5;
    v_detail  := jsonb_build_object('dead_lettered_1h', v_dead_letter_1h, 'total_1h', v_total_jobs_1h, 'pct', ROUND(v_dead_letter_pct, 1));

    v_check_count := v_check_count + 1;
    IF NOT v_passing THEN
      v_failed_count := v_failed_count + 1;
      v_blocking_fail := v_blocking_fail || jsonb_build_array(jsonb_build_object('check', 'dead_letter_rate', 'detail', v_detail));
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object('check', 'dead_letter_rate', 'passing', v_passing, 'is_blocking', true, 'detail', v_detail));
  END;

  /* ── 2. Absolute dead-letter last 24h ─────────────────────────────── */
  BEGIN
    SELECT COUNT(*) INTO v_dead_letter_24h FROM public.session_jobs
    WHERE status = 'dead_lettered' AND updated_at >= now() - INTERVAL '24 hours';

    v_passing := v_dead_letter_24h < 50;
    v_detail  := jsonb_build_object('count_24h', v_dead_letter_24h);

    v_check_count := v_check_count + 1;
    IF NOT v_passing THEN
      v_failed_count := v_failed_count + 1;
      v_blocking_fail := v_blocking_fail || jsonb_build_array(jsonb_build_object('check', 'dead_letter_absolute', 'detail', v_detail));
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object('check', 'dead_letter_absolute', 'passing', v_passing, 'is_blocking', true, 'detail', v_detail));
  END;

  /* ── 3. Stuck session age (max > 60 min in processing) ────────────── */
  BEGIN
    SELECT COALESCE(MAX(EXTRACT(EPOCH FROM (now() - updated_at)) / 60), 0)
    INTO v_max_stuck_minutes
    FROM public.sessions
    WHERE status IN ('processing', 'transcribed', 'context_ready', 'snapshot_created', 'compensating');

    v_passing := v_max_stuck_minutes < 60;
    v_detail  := jsonb_build_object('max_stuck_minutes', ROUND(v_max_stuck_minutes, 1));

    v_check_count := v_check_count + 1;
    IF NOT v_passing THEN
      v_failed_count := v_failed_count + 1;
      v_blocking_fail := v_blocking_fail || jsonb_build_array(jsonb_build_object('check', 'stuck_session_age', 'detail', v_detail));
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object('check', 'stuck_session_age', 'passing', v_passing, 'is_blocking', true, 'detail', v_detail));
  END;

  /* ── 4. Stuck sessions count (> 30 min, < 3) ──────────────────────── */
  BEGIN
    SELECT COUNT(*) INTO v_stuck_count_30m
    FROM public.sessions
    WHERE status IN ('processing', 'compensating')
      AND updated_at < now() - INTERVAL '30 minutes';

    v_passing := v_stuck_count_30m < 3;
    v_detail  := jsonb_build_object('stuck_count_30m', v_stuck_count_30m);

    v_check_count := v_check_count + 1;
    IF NOT v_passing THEN
      v_failed_count := v_failed_count + 1;
      v_warning_fail := v_warning_fail || jsonb_build_array(jsonb_build_object('check', 'stuck_sessions_count', 'detail', v_detail));
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object('check', 'stuck_sessions_count', 'passing', v_passing, 'is_blocking', false, 'detail', v_detail));
  END;

  /* ── 5. Active global kill switches ───────────────────────────────── */
  BEGIN
    SELECT COUNT(*) INTO v_active_global_ks
    FROM public.system_kill_switches
    WHERE is_active = true AND scope = 'global';

    v_passing := v_active_global_ks = 0;
    v_detail  := jsonb_build_object('active_global_kill_switches', v_active_global_ks);

    v_check_count := v_check_count + 1;
    IF NOT v_passing THEN
      v_failed_count := v_failed_count + 1;
      v_blocking_fail := v_blocking_fail || jsonb_build_array(jsonb_build_object('check', 'active_kill_switches', 'detail', v_detail));
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object('check', 'active_kill_switches', 'passing', v_passing, 'is_blocking', true, 'detail', v_detail));
  END;

  /* ── 6. Housekeeping last run ──────────────────────────────────────── */
  BEGIN
    SELECT EXTRACT(EPOCH FROM (now() - MAX(ran_at))) / 60
    INTO v_hk_last_min_ago
    FROM public.housekeeping_runs
    WHERE dry_run = false;

    v_passing := v_hk_last_min_ago IS NOT NULL AND v_hk_last_min_ago < 120;  -- < 2 hours
    v_detail  := jsonb_build_object('minutes_since_last_run', ROUND(COALESCE(v_hk_last_min_ago, 999), 1));

    v_check_count := v_check_count + 1;
    IF NOT v_passing THEN
      v_failed_count := v_failed_count + 1;
      v_warning_fail := v_warning_fail || jsonb_build_array(jsonb_build_object('check', 'housekeeping_last_run', 'detail', v_detail));
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object('check', 'housekeeping_last_run', 'passing', v_passing, 'is_blocking', false, 'detail', v_detail));
  END;

  /* ── 7. Rate-limit block rate last 1h ─────────────────────────────── */
  BEGIN
    SELECT
      COUNT(*) FILTER (WHERE blocked_at IS NOT NULL),
      COUNT(*)
    INTO v_rate_blocked, v_rate_total
    FROM public.rate_limit_buckets
    WHERE window_start >= now() - INTERVAL '1 hour';

    v_rate_block_pct := CASE WHEN v_rate_total = 0 THEN 0
                             ELSE (v_rate_blocked::NUMERIC / v_rate_total) * 100 END;
    v_passing := v_rate_block_pct < 10;
    v_detail  := jsonb_build_object('blocked_buckets', v_rate_blocked, 'total_buckets', v_rate_total, 'block_pct', ROUND(v_rate_block_pct, 1));

    v_check_count := v_check_count + 1;
    IF NOT v_passing THEN
      v_failed_count := v_failed_count + 1;
      v_warning_fail := v_warning_fail || jsonb_build_array(jsonb_build_object('check', 'rate_limit_blocked_pct', 'detail', v_detail));
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object('check', 'rate_limit_blocked_pct', 'passing', v_passing, 'is_blocking', false, 'detail', v_detail));
  END;

  /* ── 8. Open critical health alerts ───────────────────────────────── */
  BEGIN
    SELECT COUNT(*) INTO v_open_crit_alerts
    FROM public.session_health_alerts
    WHERE severity = 'critical' AND resolved_at IS NULL;

    v_passing := v_open_crit_alerts < 5;
    v_detail  := jsonb_build_object('open_critical_alerts', v_open_crit_alerts);

    v_check_count := v_check_count + 1;
    IF NOT v_passing THEN
      v_failed_count := v_failed_count + 1;
      v_blocking_fail := v_blocking_fail || jsonb_build_array(jsonb_build_object('check', 'open_critical_alerts', 'detail', v_detail));
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object('check', 'open_critical_alerts', 'passing', v_passing, 'is_blocking', true, 'detail', v_detail));
  END;

  -- Determine overall passing: only BLOCKING failures affect overall
  v_overall := jsonb_array_length(v_blocking_fail) = 0;

  -- Persist this run to history
  INSERT INTO public.production_readiness_runs (
    overall_passing, blocking_failures, warning_failures, all_results,
    check_count, failed_count, triggered_by
  ) VALUES (
    v_overall, v_blocking_fail, v_warning_fail, v_results,
    v_check_count, v_failed_count, p_trigger
  )
  RETURNING id INTO v_run_id;

  RETURN jsonb_build_object(
    'run_id',           v_run_id,
    'overall_passing',  v_overall,
    'check_count',      v_check_count,
    'failed_count',     v_failed_count,
    'blocking_failures', v_blocking_fail,
    'warning_failures',  v_warning_fail,
    'all_results',       v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_readiness_checks(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_readiness_checks(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_readiness_checks(TEXT) TO authenticated;

COMMIT;
