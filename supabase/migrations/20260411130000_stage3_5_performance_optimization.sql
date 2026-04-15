-- Migration: Stage 3.5 — Performance & Cost Optimization
-- Description: Evolves the job queue into a specialized execution system with priority weighting and AI cost control.

-- 1. Enums and Schema Evolution
DO $$ BEGIN
    CREATE TYPE public.session_worker_type AS ENUM ('IO', 'CPU', 'AI');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Update session_jobs with new governance fields
ALTER TABLE public.session_jobs 
ADD COLUMN IF NOT EXISTS worker_type public.session_worker_type,
ADD COLUMN IF NOT EXISTS execution_duration_ms BIGINT,
ADD COLUMN IF NOT EXISTS token_estimate INTEGER;

-- 2. Strict Routing Logic (Fail-Fast)
CREATE OR REPLACE FUNCTION public.resolve_session_job_worker(p_job_type public.session_job_type)
RETURNS public.session_worker_type
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN CASE p_job_type
        WHEN 'TRANSCRIBE'      THEN 'CPU'::public.session_worker_type
        WHEN 'INGEST'          THEN 'IO'::public.session_worker_type
        WHEN 'SNAPSHOT'        THEN 'CPU'::public.session_worker_type
        WHEN 'ANALYZE_LEGAL'   THEN 'AI'::public.session_worker_type
        WHEN 'ANALYZE_MEDICAL' THEN 'AI'::public.session_worker_type
        WHEN 'FULL_PROCESS'    THEN 'CPU'::public.session_worker_type
        ELSE NULL -- Strictly return NULL to trigger constraint failure
    END;
END;
$$;

-- Enforce Strict Routing via Constraint
-- Temporarily backfill existing jobs
UPDATE public.session_jobs SET worker_type = public.resolve_session_job_worker(job_type) WHERE worker_type IS NULL;

ALTER TABLE public.session_jobs 
ALTER COLUMN worker_type SET NOT NULL,
ADD CONSTRAINT check_valid_worker_type CHECK (worker_type IS NOT NULL);

-- 3. Advanced Job Claiming (Concurrency, Fairness & Anti-Starvation)
CREATE OR REPLACE FUNCTION public.claim_session_job(
    p_worker_id TEXT,
    p_worker_type public.session_worker_type,
    p_max_jobs INTEGER DEFAULT 1,
    p_lease_duration INTERVAL DEFAULT '5 minutes',
    p_ai_per_office_limit INTEGER DEFAULT 1
)
RETURNS SETOF public.session_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH target_jobs AS (
        SELECT j.id
        FROM public.session_jobs j
        WHERE 
            j.worker_type = p_worker_type
            AND (j.status = 'queued' OR (j.status = 'failed' AND j.scheduled_at <= NOW()))
            AND (j.lease_expires_at IS NULL OR j.lease_expires_at <= NOW())
            -- AI Fairness Check (Per Office)
            AND (
                p_worker_type != 'AI' OR NOT EXISTS (
                    SELECT 1 FROM public.session_jobs run
                    WHERE run.office_id = j.office_id 
                    AND run.status = 'running' 
                    AND run.worker_type = 'AI'
                )
            )
        -- Anti-Starvation Formula: Base Priority + 1 point for every minute waiting
        ORDER BY 
            (j.priority + EXTRACT(EPOCH FROM (NOW() - j.created_at)) / 60) DESC, 
            j.scheduled_at ASC
        LIMIT p_max_jobs
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.session_jobs
    SET 
        status = 'claimed',
        worker_id = p_worker_id,
        claimed_at = NOW(),
        lease_expires_at = NOW() + p_lease_duration,
        attempt_count = attempt_count + 1,
        updated_at = NOW()
    FROM target_jobs
    WHERE public.session_jobs.id = target_jobs.id
    RETURNING public.session_jobs.*;
END;
$$;

-- 4. Optimized Routing Index
CREATE INDEX IF NOT EXISTS idx_session_jobs_governance 
    ON public.session_jobs (worker_type, status, priority, scheduled_at) 
    WHERE status IN ('queued', 'failed');

-- 5. Auto-assign worker_type on Enqueue
CREATE OR REPLACE FUNCTION public.tr_session_job_auto_route()
RETURNS TRIGGER AS $$
BEGIN
    NEW.worker_type := public.resolve_session_job_worker(NEW.job_type);
    IF NEW.worker_type IS NULL THEN
        RAISE EXCEPTION 'FATAL_ROUTING_ERROR: Job type % has no valid worker assignment.', NEW.job_type;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_session_job_auto_route ON public.session_jobs;
CREATE TRIGGER tr_session_job_auto_route
    BEFORE INSERT ON public.session_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.tr_session_job_auto_route();

-- 6. Performance Metrics View
CREATE OR REPLACE VIEW public.session_performance_metrics AS
SELECT 
    worker_type,
    status,
    count(*),
    avg(execution_duration_ms) as avg_duration_ms,
    sum(token_estimate) as total_tokens,
    count(*) FILTER (WHERE attempt_count > 1) as retry_count
FROM public.session_jobs
GROUP BY worker_type, status;
