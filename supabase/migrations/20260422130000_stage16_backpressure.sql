-- Migration: Stage 16 — Scaling & Backpressure
-- Description: Hardens the job orchestration layer with global concurrency limits and fairness-based burst protection.

-- 1. Configuration Table (Stage 16 Globals)
CREATE TABLE IF NOT EXISTS public.system_scaling_config (
    id TEXT PRIMARY KEY DEFAULT 'global_config',
    max_global_concurrency INTEGER DEFAULT 50,
    max_office_burst INTEGER DEFAULT 5,
    backpressure_active BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.system_scaling_config (id, max_global_concurrency, max_office_burst)
VALUES ('global_config', 50, 5)
ON CONFLICT (id) DO NOTHING;

-- 2. Enhanced claim_session_job with Backpressure and Fairness
CREATE OR REPLACE FUNCTION public.claim_session_job(
  p_worker_id      TEXT,
  p_worker_type    TEXT    DEFAULT 'CPU',
  p_max_jobs       INTEGER DEFAULT 1,
  p_lease_duration INTERVAL DEFAULT '5 minutes'
)
RETURNS SETOF public.session_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_global_running INTEGER;
    v_max_global INTEGER;
    v_max_burst INTEGER;
BEGIN
    -- 1. Get scaling config
    SELECT max_global_concurrency, max_office_burst
    INTO v_max_global, v_max_burst
    FROM public.system_scaling_config
    WHERE id = 'global_config';

    -- 2. Check global backpressure
    SELECT count(*) INTO v_global_running
    FROM public.session_jobs
    WHERE status = 'running';

    IF v_global_running >= v_max_global THEN
        RETURN;
    END IF;

    -- 3. Claim jobs with per-office burst limits
    RETURN QUERY
    WITH eligible_jobs AS (
        SELECT j.id, j.office_id,
               count(*) OVER (PARTITION BY j.office_id) as office_queued_count
        FROM public.session_jobs j
        JOIN public.sessions s ON j.session_id = s.id
        WHERE
          (j.status = 'queued' OR (j.status = 'failed' AND j.scheduled_at <= NOW()))
          AND (j.lease_expires_at IS NULL OR j.lease_expires_at <= NOW())
          AND s.status NOT IN ('failed', 'dead_lettered') -- Do not process jobs for broken sessions
        ORDER BY j.priority DESC, j.scheduled_at ASC
    ),
    filtered_jobs AS (
        SELECT ej.id
        FROM eligible_jobs ej
        WHERE (
            SELECT count(*) 
            FROM public.session_jobs sj 
            WHERE sj.office_id = ej.office_id AND sj.status = 'running'
        ) < v_max_burst
        LIMIT p_max_jobs
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.session_jobs
    SET
      status           = 'claimed',
      worker_id        = p_worker_id,
      claimed_at       = NOW(),
      lease_expires_at = NOW() + p_lease_duration,
      attempt_count    = attempt_count + 1,
      updated_at       = NOW()
    FROM filtered_jobs
    WHERE public.session_jobs.id = filtered_jobs.id
    RETURNING public.session_jobs.*;
END;
$$;
