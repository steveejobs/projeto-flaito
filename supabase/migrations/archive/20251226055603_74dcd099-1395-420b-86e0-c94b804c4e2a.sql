-- RPC genérica para enfileirar jobs de sincronização por court/kind
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
  -- Insert SYNC_SOURCE jobs for matching sources (ignores enabled flag for first load)
  FOR v_source IN
    SELECT s.id
    FROM legal_precedent_sources s
    WHERE s.court = p_court
      AND s.kind = p_kind
      AND NOT EXISTS (
        SELECT 1 FROM legal_precedent_jobs j
        WHERE j.source_id = s.id
          AND j.job_type = 'SYNC_SOURCE'
          AND j.status IN ('PENDING', 'RUNNING')
      )
    LIMIT p_limit
  LOOP
    INSERT INTO legal_precedent_jobs (source_id, job_type, status, payload)
    VALUES (v_source.id, 'SYNC_SOURCE', 'PENDING', '{}');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_sync_source_jobs(text, text, integer) TO authenticated;