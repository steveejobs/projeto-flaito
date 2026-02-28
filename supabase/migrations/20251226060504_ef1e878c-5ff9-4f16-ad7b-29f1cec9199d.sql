-- Drop and recreate the function with proper enum casting
DROP FUNCTION IF EXISTS public.enqueue_sync_source_jobs(text, text, integer);

CREATE OR REPLACE FUNCTION public.enqueue_sync_source_jobs(
  p_court text,
  p_kind text,
  p_limit integer DEFAULT 500
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
    SELECT id FROM legal_precedent_sources
    WHERE enabled = true
      AND court = p_court
      AND kind = p_kind::precedent_kind
    LIMIT p_limit
  LOOP
    INSERT INTO legal_precedent_jobs (source_id, job_type, status)
    VALUES (v_source.id, 'SYNC_SOURCE', 'PENDING');
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_sync_source_jobs(text, text, integer) TO authenticated;