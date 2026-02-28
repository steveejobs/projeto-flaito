-- RPC to re-enable all disabled sources
CREATE OR REPLACE FUNCTION public.reenable_all_sources()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int := 0;
BEGIN
  UPDATE legal_precedent_sources
  SET enabled = true
  WHERE enabled = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;