-- Drop existing function to recreate with correct signature
DROP FUNCTION IF EXISTS public.enqueue_sync_source_jobs(text, text, integer);

-- Create improved enqueue_sync_source_jobs RPC
-- Creates SYNC_SOURCE jobs for eligible sources (STJ/SUMULA by default)
-- Respects "one active job per source" rule
CREATE OR REPLACE FUNCTION public.enqueue_sync_source_jobs(
  p_court text DEFAULT 'STJ',
  p_kind text DEFAULT 'SUMULA',
  p_limit integer DEFAULT 50
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_source record;
BEGIN
  FOR v_source IN
    SELECT s.id 
    FROM legal_precedent_sources s
    WHERE s.enabled = true
      AND s.court = p_court
      AND s.kind = p_kind::precedent_kind
      -- Ensure no active job exists for this source
      AND NOT EXISTS (
        SELECT 1 FROM legal_precedent_jobs j
        WHERE j.source_id = s.id
          AND j.job_type = 'SYNC_SOURCE'
          AND j.status IN ('PENDING', 'RUNNING')
      )
    LIMIT p_limit
  LOOP
    INSERT INTO legal_precedent_jobs (source_id, job_type, status, payload)
    VALUES (v_source.id, 'SYNC_SOURCE', 'PENDING', '{}'::jsonb);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_sync_source_jobs(text, text, integer) TO authenticated;

-- Create retry_failed_sync_source_jobs RPC
-- Moves FAILED SYNC_SOURCE jobs back to PENDING
CREATE OR REPLACE FUNCTION public.retry_failed_sync_source_jobs(
  p_limit integer DEFAULT 50
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH updated AS (
    UPDATE legal_precedent_jobs
    SET 
      status = 'PENDING',
      started_at = NULL,
      finished_at = NULL,
      last_error = NULL
    WHERE id IN (
      SELECT id FROM legal_precedent_jobs
      WHERE job_type = 'SYNC_SOURCE'
        AND status = 'FAILED'
      ORDER BY created_at DESC
      LIMIT p_limit
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.retry_failed_sync_source_jobs(integer) TO authenticated;