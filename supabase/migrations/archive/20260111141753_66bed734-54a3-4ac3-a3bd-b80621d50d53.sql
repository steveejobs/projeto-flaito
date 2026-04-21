-- Atualizar função RPC para incluir campos extras: subtype, judicialized_at
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
  v_cnj_clean text;
BEGIN
  -- Limpar CNJ removendo TODOS os caracteres que não são dígitos, pontos ou hífens
  v_cnj_clean := NULL;
  IF p_patch->>'cnj_number' IS NOT NULL THEN
    v_cnj_clean := regexp_replace(p_patch->>'cnj_number', '[^0-9.\-]', '', 'g');
  END IF;

  UPDATE public.cases
  SET
    cnj_number = COALESCE(v_cnj_clean, cnj_number),
    opponent_name = COALESCE((p_patch->>'opponent_name')::text, opponent_name),
    court_name = COALESCE((p_patch->>'court_name')::text, court_name),
    comarca = COALESCE((p_patch->>'comarca')::text, comarca),
    lawyer_name = COALESCE((p_patch->>'lawyer_name')::text, lawyer_name),
    oab_number = COALESCE((p_patch->>'oab_number')::text, oab_number),
    area = COALESCE((p_patch->>'area')::text, area),
    summary = COALESCE((p_patch->>'summary')::text, summary),
    subtype = COALESCE((p_patch->>'subtype')::text, subtype),
    judicialized_at = COALESCE((p_patch->>'judicialized_at')::timestamptz, judicialized_at),
    identified_docs = COALESCE((p_patch->'identified_docs')::jsonb, identified_docs),
    nija_full_analysis = COALESCE((p_patch->'nija_full_analysis')::jsonb, nija_full_analysis),
    nija_full_last_run_at = COALESCE((p_patch->>'nija_full_last_run_at')::timestamptz, nija_full_last_run_at),
    title = COALESCE((p_patch->>'title')::text, title),
    updated_at = NOW()
  WHERE id = p_case_id;
END;
$$;

-- Manter permissões
REVOKE ALL ON FUNCTION public.lexos_nija_update_case_metadata(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lexos_nija_update_case_metadata(uuid, jsonb) TO authenticated;