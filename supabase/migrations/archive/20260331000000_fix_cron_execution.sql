-- Migration: Fix Cron Execution Observability
-- Description: Introduces explicit logging for pg_cron to avoid silent failures when Vault secrets are missing.
-- Alters invoke_notifications_scheduler and invoke_notifications_worker to validate secrets.

-- 1. Create table for cron execution logs
CREATE TABLE IF NOT EXISTS public.cron_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('TRIGGERED', 'FAILED')),
    message TEXT,
    error_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Admin only)
ALTER TABLE public.cron_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin read cron_execution_logs" 
    ON public.cron_execution_logs 
    FOR SELECT 
    USING (auth.jwt() ->> 'role' = 'service_role');

-- 2. Update invoke_notifications_scheduler
CREATE OR REPLACE FUNCTION public.invoke_notifications_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_ref text;
  v_service_key text;
  v_url text;
BEGIN
  SELECT value INTO v_project_ref FROM vault.secrets WHERE name = 'supabase_project_ref' LIMIT 1;
  SELECT value INTO v_service_key FROM vault.secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_project_ref IS NULL OR TRIM(v_project_ref) = '' OR v_service_key IS NULL OR TRIM(v_service_key) = '' THEN
    INSERT INTO public.cron_execution_logs (job_name, status, message, error_details) 
    VALUES (
      'notifications-scheduler', 
      'FAILED', 
      'Execution aborted: Missing or empty Vault Secrets', 
      jsonb_build_object('missing', 'supabase_project_ref or service_role_key is not configured in Vault')
    );
    RETURN;
  END IF;

  v_url := 'https://' || v_project_ref || '.supabase.co/functions/v1/notifications-scheduler';

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := '{}'::jsonb
  );
  
  INSERT INTO public.cron_execution_logs (job_name, status, message) 
  VALUES ('notifications-scheduler', 'TRIGGERED', 'HTTP POST requested via pg_net');
END;
$$;

-- 3. Update invoke_notifications_worker
CREATE OR REPLACE FUNCTION public.invoke_notifications_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_ref text;
  v_service_key text;
  v_url text;
BEGIN
  SELECT value INTO v_project_ref FROM vault.secrets WHERE name = 'supabase_project_ref' LIMIT 1;
  SELECT value INTO v_service_key FROM vault.secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_project_ref IS NULL OR TRIM(v_project_ref) = '' OR v_service_key IS NULL OR TRIM(v_service_key) = '' THEN
    INSERT INTO public.cron_execution_logs (job_name, status, message, error_details) 
    VALUES (
      'notifications-worker', 
      'FAILED', 
      'Execution aborted: Missing or empty Vault Secrets', 
      jsonb_build_object('missing', 'supabase_project_ref or service_role_key is not configured in Vault')
    );
    RETURN;
  END IF;

  v_url := 'https://' || v_project_ref || '.supabase.co/functions/v1/notifications-worker';

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := '{}'::jsonb
  );
  
  INSERT INTO public.cron_execution_logs (job_name, status, message) 
  VALUES ('notifications-worker', 'TRIGGERED', 'HTTP POST requested via pg_net');
END;
$$;

-- 4. Unschedule and Reschedule to ensure accurate frequency (Scheduler 5m, Worker 1m)
SELECT cron.unschedule('notifications-scheduler-job');
SELECT cron.unschedule('notifications-worker-job');

-- Scheduler runs every 5 minutes (reduced load, still fast enough for events)
SELECT cron.schedule(
  'notifications-scheduler-job',
  '*/5 * * * *',
  'SELECT public.invoke_notifications_scheduler();'
);

-- Worker runs every 1 minute (drain queue as fast as possible)
SELECT cron.schedule(
  'notifications-worker-job',
  '* * * * *',
  'SELECT public.invoke_notifications_worker();'
);
