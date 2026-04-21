-- Add source column to cases table to distinguish process origin
ALTER TABLE cases ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- Add comment explaining valid values
COMMENT ON COLUMN cases.source IS 'Origin of the case: manual (user-created), escavador (imported from Escavador API), import (bulk imported)';

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_cases_source ON cases (source) WHERE source IS NOT NULL;

-- Update RPC to allow setting source field
CREATE OR REPLACE FUNCTION public.lexos_nija_update_case_metadata(
  p_case_id uuid,
  p_patch jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT c.office_id
    INTO v_office_id
  FROM public.cases c
  WHERE c.id = p_case_id;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'case_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.office_members om
    WHERE om.user_id = auth.uid()
      AND om.office_id = v_office_id
      AND om.is_active = true
  ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  UPDATE public.cases
  SET
    cnj_number = COALESCE(p_patch->>'cnj_number', cnj_number),
    opponent_name = COALESCE(p_patch->>'opponent_name', opponent_name),
    court_name = COALESCE(p_patch->>'court_name', court_name),
    comarca = COALESCE(p_patch->>'comarca', comarca),
    lawyer_name = COALESCE(p_patch->>'lawyer_name', lawyer_name),
    oab_number = COALESCE(p_patch->>'oab_number', oab_number),
    identified_docs = COALESCE(p_patch->'identified_docs', identified_docs),
    area = COALESCE(p_patch->>'area', area),
    nija_full_analysis = COALESCE(p_patch->'nija_full_analysis', nija_full_analysis),
    nija_full_last_run_at = COALESCE((p_patch->>'nija_full_last_run_at')::timestamptz, nija_full_last_run_at),
    summary = COALESCE(p_patch->>'summary', summary),
    source = COALESCE(p_patch->>'source', source),
    updated_at = now()
  WHERE id = p_case_id;
END;
$$;

