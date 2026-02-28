-- Create idempotent enqueue_check_source_jobs RPC
CREATE OR REPLACE FUNCTION public.enqueue_check_source_jobs(p_limit int DEFAULT 50)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count int := 0;
BEGIN
  -- Insert CHECK_SOURCE jobs only for enabled sources with URL
  -- and only if no active job (PENDING/RUNNING) exists for that source
  WITH eligible_sources AS (
    SELECT s.id
    FROM legal_precedent_sources s
    WHERE s.enabled = true
      AND s.source_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM legal_precedent_jobs j
        WHERE j.source_id = s.id
          AND j.job_type = 'CHECK_SOURCE'
          AND j.status IN ('PENDING', 'RUNNING')
      )
    LIMIT p_limit
  )
  INSERT INTO legal_precedent_jobs (source_id, job_type, status)
  SELECT id, 'CHECK_SOURCE', 'PENDING'
  FROM eligible_sources;
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- Create idempotent retry_failed_check_source_jobs RPC
CREATE OR REPLACE FUNCTION public.retry_failed_check_source_jobs(p_limit int DEFAULT 50)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retried_count int := 0;
BEGIN
  -- Update FAILED jobs to PENDING only if no active job exists for same source
  WITH eligible_jobs AS (
    SELECT j.id
    FROM legal_precedent_jobs j
    WHERE j.status = 'FAILED'
      AND j.job_type = 'CHECK_SOURCE'
      AND NOT EXISTS (
        SELECT 1 FROM legal_precedent_jobs j2
        WHERE j2.source_id = j.source_id
          AND j2.job_type = 'CHECK_SOURCE'
          AND j2.status IN ('PENDING', 'RUNNING')
          AND j2.id != j.id
      )
    ORDER BY j.created_at DESC
    LIMIT p_limit
  )
  UPDATE legal_precedent_jobs
  SET status = 'PENDING',
      started_at = NULL,
      finished_at = NULL,
      last_error = NULL
  WHERE id IN (SELECT id FROM eligible_jobs);
  
  GET DIAGNOSTICS retried_count = ROW_COUNT;
  RETURN retried_count;
END;
$$;

-- Create retry_single_job RPC
CREATE OR REPLACE FUNCTION public.retry_single_job(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_record RECORD;
BEGIN
  -- Get the job
  SELECT * INTO job_record
  FROM legal_precedent_jobs
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Only retry FAILED jobs
  IF job_record.status != 'FAILED' THEN
    RETURN false;
  END IF;
  
  -- Check if there's already an active job for this source
  IF job_record.source_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM legal_precedent_jobs
      WHERE source_id = job_record.source_id
        AND job_type = job_record.job_type
        AND status IN ('PENDING', 'RUNNING')
        AND id != p_job_id
    ) THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Reset the job to PENDING
  UPDATE legal_precedent_jobs
  SET status = 'PENDING',
      started_at = NULL,
      finished_at = NULL,
      last_error = NULL
  WHERE id = p_job_id;
  
  RETURN true;
END;
$$;

-- Create cancel_job RPC
CREATE OR REPLACE FUNCTION public.cancel_job(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only cancel PENDING jobs
  UPDATE legal_precedent_jobs
  SET status = 'CANCELLED',
      finished_at = NOW()
  WHERE id = p_job_id
    AND status = 'PENDING';
  
  RETURN FOUND;
END;
$$;

-- Create worker lock/unlock RPCs for concurrency control
CREATE OR REPLACE FUNCTION public.worker_lock_try()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Try to acquire advisory lock with key 123456
  RETURN pg_try_advisory_lock(123456);
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_lock_release()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Release advisory lock with key 123456
  PERFORM pg_advisory_unlock(123456);
END;
$$;

-- Create function to get pending jobs count
CREATE OR REPLACE FUNCTION public.get_pending_jobs_count()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM legal_precedent_jobs
  WHERE status = 'PENDING';
$$;