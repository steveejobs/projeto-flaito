-- ============================================================
-- Migration: CRM Evolution — Lifecycle & Auditing
-- File: 20260424000000_crm_evolution.sql
-- ============================================================

BEGIN;

-- 1. Evolução da Tabela crm_leads
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS purge_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS restored_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS previous_pipeline_stage TEXT,
ADD COLUMN IF NOT EXISTS last_automation_run_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_automation_source TEXT,
ADD COLUMN IF NOT EXISTS last_automation_reason TEXT,
ADD COLUMN IF NOT EXISTS last_automation_evidence JSONB DEFAULT '{}'::jsonb;

-- 2. Evolução da Tabela crm_activities
ALTER TABLE public.crm_activities
ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rule_id TEXT,
ADD COLUMN IF NOT EXISTS trigger_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS action_origin TEXT DEFAULT 'manual'; -- 'manual', 'automation', 'system'

-- 3. Trigger para calcular purge_at automaticamente
CREATE OR REPLACE FUNCTION public.tr_crm_leads_calc_purge()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        NEW.purge_at := NEW.deleted_at + INTERVAL '30 days';
    ELSIF NEW.deleted_at IS NULL THEN
        NEW.purge_at := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_crm_leads_calc_purge_trigger ON public.crm_leads;
CREATE TRIGGER tr_crm_leads_calc_purge_trigger
    BEFORE UPDATE ON public.crm_leads
    FOR EACH ROW
    EXECUTE FUNCTION public.tr_crm_leads_calc_purge();

-- 4. Atualização do Housekeeping para incluir CRM Leads
-- Nota: Estamos estendendo a função system_housekeeping existente
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
    v_err_detail := 'rate_limit_buckets: ' || SQLERRM;
    v_errors     := v_errors || jsonb_build_array(v_err_detail);
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
    v_err_detail := 'stale_session_jobs: ' || SQLERRM;
    v_errors     := v_errors || jsonb_build_array(v_err_detail);
  END;

  -- ── Categoria 3: CRM Leads Trashed (older than 30 days) ─────────────
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
    v_err_detail := 'purged_crm_leads: ' || SQLERRM;
    v_errors     := v_errors || jsonb_build_array(v_err_detail);
  END;

  -- ── Categoria 4: Housekeeping Audit Logs (older than 180 days) ──────
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

COMMIT;
