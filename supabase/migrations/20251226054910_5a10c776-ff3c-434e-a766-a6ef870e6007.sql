-- Corrigir RPC: usar 'court' em vez de 'tribunal'
CREATE OR REPLACE FUNCTION public.enqueue_sync_stj_sumulas_jobs(p_limit integer DEFAULT 5000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_source record;
BEGIN
  -- Insert jobs for STJ sumulas sources that are enabled and don't have active jobs
  FOR v_source IN
    SELECT s.id
    FROM legal_precedent_sources s
    WHERE s.enabled = true
      AND s.court = 'STJ'
      AND s.kind = 'SUMULA'
      AND NOT EXISTS (
        SELECT 1 FROM legal_precedent_jobs j
        WHERE j.source_id = s.id
          AND j.status IN ('PENDING', 'RUNNING')
      )
    LIMIT p_limit
  LOOP
    INSERT INTO legal_precedent_jobs (source_id, job_type, status, payload)
    VALUES (v_source.id, 'CHECK_SOURCE', 'PENDING', '{}');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;