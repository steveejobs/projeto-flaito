-- Migration: Setup Scheduler and Worker Cron Jobs
-- This migration enables pg_net extension and schedules the messaging functions.

-- 1. Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Function to invoke notifications-scheduler
-- Note: Replace project_ref and service_role_key placeholders or use vault
CREATE OR REPLACE FUNCTION public.invoke_notifications_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://' || (SELECT value FROM vault.secrets WHERE name = 'supabase_project_ref' LIMIT 1) || '.supabase.co/functions/v1/notifications-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- 3. Function to invoke notifications-worker
CREATE OR REPLACE FUNCTION public.invoke_notifications_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://' || (SELECT value FROM vault.secrets WHERE name = 'supabase_project_ref' LIMIT 1) || '.supabase.co/functions/v1/notifications-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- 4. Schedule Jobs using pg_cron
-- 4.1 Scheduler: Runs every 2 minutes
SELECT cron.schedule(
  'notifications-scheduler-job',
  '*/2 * * * *',
  'SELECT public.invoke_notifications_scheduler();'
);

-- 4.2 Worker: Runs every 1 minute
SELECT cron.schedule(
  'notifications-worker-job',
  '* * * * *',
  'SELECT public.invoke_notifications_worker();'
);

-- 5. Helper table for manual triggers if needed
COMMENT ON FUNCTION public.invoke_notifications_scheduler() IS 'Manually trigger the message rule engine';
COMMENT ON FUNCTION public.invoke_notifications_worker() IS 'Manually trigger the message queue processor';
