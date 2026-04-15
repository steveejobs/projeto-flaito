-- Migration: Stage 3 — Distributed Processing & Scale
-- Description: Implements a durable, PostgreSQL-backed job queue for asynchronous session processing.

-- 1. Enums and Types
DO $$ BEGIN
    CREATE TYPE public.session_job_status AS ENUM (
        'queued',           -- Job created, waiting for worker
        'claimed',          -- Job reserved by a specific worker instance
        'running',          -- Execution in progress
        'succeeded',        -- Terminal success
        'failed',           -- Transient failure, pending retry
        'dead_lettered',    -- Terminal failure after max retries
        'cancelled'         -- Job aborted manually or by system
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.session_job_type AS ENUM (
        'TRANSCRIBE',       -- Audio -> Text
        'INGEST',           -- Source -> Context Version
        'SNAPSHOT',         -- Transcription + Context -> snapshot_id
        'ANALYZE_LEGAL',    -- snapshot_id -> legal_output
        'ANALYZE_MEDICAL',  -- snapshot_id -> medical_output
        'FULL_PROCESS'      -- Orchestration job that triggers sub-stages
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Jobs Table
CREATE TABLE IF NOT EXISTS public.session_jobs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    office_id         UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    job_type          public.session_job_type NOT NULL,
    status            public.session_job_status NOT NULL DEFAULT 'queued',
    
    -- Idempotency and Deduplication
    idempotency_key   TEXT NOT NULL UNIQUE, -- e.g., 'analyze:snapshot_uuid'
    
    -- Concurrency and Leases
    worker_id         TEXT,                 -- Unique identifier for the claiming worker
    claimed_at        TIMESTAMPTZ,
    lease_expires_at  TIMESTAMPTZ,
    
    -- Control and Retries
    attempt_count     INTEGER NOT NULL DEFAULT 0,
    max_attempts      INTEGER NOT NULL DEFAULT 3,
    priority          INTEGER NOT NULL DEFAULT 0, -- Higher is more urgent
    
    -- Metadata and Tracing
    config_json       JSONB NOT NULL DEFAULT '{}', -- Job specific parameters
    last_error        TEXT,
    trace_id          TEXT,
    created_by        UUID REFERENCES auth.users(id),
    
    scheduled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at        TIMESTAMPTZ,
    finished_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_session_jobs_polling 
    ON public.session_jobs (status, scheduled_at) 
    WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_session_jobs_lease 
    ON public.session_jobs (lease_expires_at) 
    WHERE status IN ('claimed', 'running');

CREATE INDEX IF NOT EXISTS idx_session_jobs_session 
    ON public.session_jobs (session_id);

-- 3. Stored Procedure for Worker Claiming (The "SKIP LOCKED" Heart)
CREATE OR REPLACE FUNCTION public.claim_session_job(
    p_worker_id TEXT,
    p_max_jobs INTEGER DEFAULT 1,
    p_lease_duration INTERVAL DEFAULT '5 minutes'
)
RETURNS SETOF public.session_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH target_jobs AS (
        SELECT id
        FROM public.session_jobs
        WHERE 
            (status = 'queued' OR (status = 'failed' AND scheduled_at <= NOW()))
            AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
        ORDER BY priority DESC, scheduled_at ASC
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

-- 4. Audit Integration (Stage 3 Observability)
CREATE OR REPLACE FUNCTION public.log_session_job_event()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.session_audit_logs (
            session_id,
            office_id,
            action_type,
            previous_status,
            current_status,
            metadata,
            performed_by
        ) VALUES (
            NEW.session_id,
            NEW.office_id,
            'JOB_STATUS_CHANGE',
            OLD.status::text,
            NEW.status::text,
            jsonb_build_object(
                'job_id', NEW.id,
                'job_type', NEW.job_type,
                'attempt', NEW.attempt_count,
                'error', NEW.last_error
            ),
            NEW.created_by
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_audit_session_job_status
    AFTER UPDATE ON public.session_jobs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.log_session_job_event();

-- 5. RLS (Stage 3 Security)
ALTER TABLE public.session_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role full access to jobs"
    ON public.session_jobs
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view jobs for their sessions"
    ON public.session_jobs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.sessions s
            WHERE s.id = session_jobs.session_id
            AND s.office_id IN (SELECT auth_utils.get_user_offices())
        )
    );

-- 6. Trigger for Worker Invocation (Fast Path)
-- Note: This requires net extension and vault secrets from Stage 0.5
CREATE OR REPLACE FUNCTION public.trigger_worker_on_job()
RETURNS TRIGGER AS $$
DECLARE
  v_project_ref text;
  v_service_key text;
  v_url text;
BEGIN
    -- Only trigger for NEW jobs or specifically rescheduled ones
    SELECT value INTO v_project_ref FROM vault.secrets WHERE name = 'supabase_project_ref' LIMIT 1;
    SELECT value INTO v_service_key FROM vault.secrets WHERE name = 'service_role_key' LIMIT 1;

    IF v_project_ref IS NOT NULL AND v_service_key IS NOT NULL THEN
        v_url := 'https://' || v_project_ref || '.supabase.co/functions/v1/session-processor';
        
        PERFORM net.http_post(
            url := v_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_service_key
            ),
            body := jsonb_build_object(
                'action', 'process_job',
                'job_id', NEW.id
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_trigger_worker_on_job
    AFTER INSERT ON public.session_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_worker_on_job();

-- 7. Janitor Cron (Stage 3 Resilience)
-- Detecta jobs 'running' ou 'claimed' com lease expirado e marca como 'failed' para reagendamento.
CREATE OR REPLACE FUNCTION public.session_job_janitor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Resgatar jobs zumbis
    UPDATE public.session_jobs
    SET 
        status = 'failed',
        last_error = 'Lease expired (Worker timeout)',
        worker_id = NULL,
        lease_expires_at = NULL,
        updated_at = NOW()
    WHERE 
        status IN ('claimed', 'running')
        AND lease_expires_at <= NOW();

    -- 2. Tentar invocar worker se houver jobs em 'queued' or 'failed' (pendentes)
    -- Isso garante que a fila não pare se um webhook falhar.
    IF EXISTS (
        SELECT 1 FROM public.session_jobs 
        WHERE status IN ('queued', 'failed') AND scheduled_at <= NOW()
    ) THEN
        PERFORM public.invoke_notifications_worker(); -- Reusando o padrão de trigger do notifications se aplicável, ou similar.
        -- Nota: Na verdade chamaremos o trigger_worker_on_job genérico ou similar.
    END IF;
END;
$$;

-- Agendar Janitor a cada 1 minuto (pg_cron)
SELECT cron.schedule(
  'session-job-janitor',
  '* * * * *',
  'SELECT public.session_job_janitor();'
);
