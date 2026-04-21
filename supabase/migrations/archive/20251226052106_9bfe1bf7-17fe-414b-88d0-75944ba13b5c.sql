-- Create a safe wrapper function for the precedents worker cron
CREATE OR REPLACE FUNCTION public.lexos_process_precedents_worker_cron_safe()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_count int;
BEGIN
  -- Count pending jobs
  SELECT count(*) INTO v_pending_count
  FROM legal_precedent_jobs
  WHERE status = 'PENDING';
  
  -- Only proceed if there are pending jobs
  IF v_pending_count > 0 THEN
    -- Create jobs for enabled sources that need checking (CHECK_SOURCE)
    INSERT INTO legal_precedent_jobs (source_id, job_type, status, payload)
    SELECT 
      s.id,
      'CHECK_SOURCE',
      'PENDING',
      jsonb_build_object('source_url', s.source_url, 'court', s.court, 'kind', s.kind)
    FROM legal_precedent_sources s
    WHERE s.enabled = true
      AND (s.last_checked_at IS NULL OR s.last_checked_at < now() - interval '1 hour' * s.check_interval_hours)
      AND NOT EXISTS (
        SELECT 1 FROM legal_precedent_jobs j 
        WHERE j.source_id = s.id 
        AND j.status IN ('PENDING', 'RUNNING')
        AND j.job_type = 'CHECK_SOURCE'
      );
  END IF;
  
  -- Log execution
  INSERT INTO audit_events (action, entity, metadata)
  VALUES ('CRON_PRECEDENTS_WORKER', 'legal_precedent_jobs', jsonb_build_object('pending_before', v_pending_count));
  
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.lexos_process_precedents_worker_cron_safe() TO authenticated;

-- Schedule the cron job to run every 30 minutes
SELECT cron.schedule(
  'lexos-precedents-worker-every-30min',
  '*/30 * * * *',
  'SELECT public.lexos_process_precedents_worker_cron_safe();'
);