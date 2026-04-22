-- ============================================================
-- Migration: CRM Housekeeping Repair & Backfill
-- File: 20260424000002_crm_housekeeping_repair.sql
-- ============================================================

BEGIN;

-- 1. BACKFILL: Garantir que todos os leads na lixeira tenham purge_at
UPDATE public.crm_leads 
SET purge_at = deleted_at + INTERVAL '30 days'
WHERE deleted_at IS NOT NULL 
  AND purge_at IS NULL;

-- 2. REPAIR: Restaurar system_housekeeping completa (Merge de Stage 12 + CRM Evolution)
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

  -- ── Categoria 1: Rate limit buckets (older than 2 hours) ──────────────
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
    v_errors := v_errors || jsonb_build_array('rate_limit_buckets: ' || SQLERRM);
  END;

  -- ── Categoria 2: Stale session jobs (terminal, older than 30 days) ───
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
    v_errors := v_errors || jsonb_build_array('stale_session_jobs: ' || SQLERRM);
  END;

  -- ── Categoria 3: Resolved health alerts (older than 90 days) ─────────
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
    v_errors := v_errors || jsonb_build_array('resolved_health_alerts: ' || SQLERRM);
  END;

  -- ── Categoria 4: CRM Leads Trashed (older than 30 days) ─────────────
  BEGIN
    IF p_dry_run THEN
      SELECT count(*) INTO v_n FROM public.crm_leads
      WHERE deleted_at IS NOT NULL
        AND purge_at < now();
    ELSE
      WITH deleted AS (
        DELETE FROM public.crm_leads
        WHERE deleted_at IS NOT NULL
          AND purge_at < now()
        RETURNING id
      ) SELECT count(*) INTO v_n FROM deleted;
    END IF;
    v_counts := v_counts || jsonb_build_object('purged_crm_leads', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_array('purged_crm_leads: ' || SQLERRM);
  END;

  -- ── Categoria 5: Housekeeping Audit Logs (older than 180 days) ──────
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
    v_errors := v_errors || jsonb_build_array('old_housekeeping_runs: ' || SQLERRM);
  END;

  -- ── Categoria 6: Stale execution audit logs (older than 60 days) ─────
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
    v_errors := v_errors || jsonb_build_array('execution_audit_logs: ' || SQLERRM);
  END;

  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER;

  -- Persistência do log de auditoria
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

COMMIT;
