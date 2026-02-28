-- Criar função RPC para atualizar metadados do caso com SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.lexos_nija_update_case_metadata(
  p_case_id uuid,
  p_patch jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cases
  SET
    cnj_number = COALESCE((p_patch->>'cnj_number')::text, cnj_number),
    opponent_name = COALESCE((p_patch->>'opponent_name')::text, opponent_name),
    court_name = COALESCE((p_patch->>'court_name')::text, court_name),
    comarca = COALESCE((p_patch->>'comarca')::text, comarca),
    lawyer_name = COALESCE((p_patch->>'lawyer_name')::text, lawyer_name),
    oab_number = COALESCE((p_patch->>'oab_number')::text, oab_number),
    area = COALESCE((p_patch->>'area')::text, area),
    summary = COALESCE((p_patch->>'summary')::text, summary),
    identified_docs = COALESCE((p_patch->'identified_docs')::jsonb, identified_docs),
    nija_full_analysis = COALESCE((p_patch->'nija_full_analysis')::jsonb, nija_full_analysis),
    nija_full_last_run_at = COALESCE((p_patch->>'nija_full_last_run_at')::timestamptz, nija_full_last_run_at),
    title = COALESCE((p_patch->>'title')::text, title),
    updated_at = NOW()
  WHERE id = p_case_id;
END;
$$;

-- Conceder permissão de execução para usuários autenticados
REVOKE ALL ON FUNCTION public.lexos_nija_update_case_metadata(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lexos_nija_update_case_metadata(uuid, jsonb) TO authenticated;