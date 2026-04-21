-- RPC para exclusão em cascata de um caso e todos os seus dados dependentes
-- Retorna JSON { ok: true } ou lança exceção com mensagem detalhada

CREATE OR REPLACE FUNCTION public.delete_case_cascade(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id uuid;
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Get case office_id and verify it exists
  SELECT office_id INTO v_office_id
  FROM cases
  WHERE id = p_case_id;
  
  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Caso não encontrado: %', p_case_id;
  END IF;
  
  -- Check if user belongs to the same office
  SELECT EXISTS(
    SELECT 1 FROM profiles 
    WHERE user_id = v_user_id AND office_id = v_office_id
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Sem permissão para excluir este caso';
  END IF;
  
  -- Delete all dependent records (order matters for FK constraints)
  -- These tables have case_id column referencing cases
  
  DELETE FROM nija_generated_pieces WHERE case_id = p_case_id;
  DELETE FROM nija_case_analysis WHERE case_id = p_case_id;
  DELETE FROM nija_usage WHERE case_id = p_case_id;
  DELETE FROM nija_sessions WHERE case_id = p_case_id;
  
  DELETE FROM template_usage_logs WHERE case_id = p_case_id;
  DELETE FROM template_ai_jobs WHERE case_id = p_case_id;
  
  DELETE FROM legal_precedent_suggestions WHERE case_id = p_case_id;
  DELETE FROM knowledge_usage_stats WHERE case_id = p_case_id;
  DELETE FROM knowledge_run_logs WHERE case_id = p_case_id;
  DELETE FROM knowledge_cache WHERE case_id = p_case_id;
  
  DELETE FROM generated_docs_legacy WHERE case_id = p_case_id;
  DELETE FROM generated_documents WHERE case_id = p_case_id;
  DELETE FROM generated_docs WHERE case_id = p_case_id;
  
  DELETE FROM e_signatures WHERE case_id = p_case_id;
  DELETE FROM document_render_jobs WHERE case_id = p_case_id;
  DELETE FROM document_events WHERE case_id = p_case_id;
  DELETE FROM documents WHERE case_id = p_case_id;
  
  DELETE FROM client_files WHERE case_id = p_case_id;
  
  DELETE FROM chat_messages WHERE thread_id IN (
    SELECT id FROM chat_threads WHERE case_id = p_case_id
  );
  DELETE FROM chat_threads WHERE case_id = p_case_id;
  DELETE FROM chat_ai_logs WHERE case_id = p_case_id;
  
  DELETE FROM case_tasks WHERE case_id = p_case_id;
  DELETE FROM case_status_transitions WHERE case_id = p_case_id;
  DELETE FROM case_status_logs WHERE case_id = p_case_id;
  DELETE FROM case_stage_logs WHERE case_id = p_case_id;
  DELETE FROM case_permissions WHERE case_id = p_case_id;
  DELETE FROM case_knowledge_snapshots WHERE case_id = p_case_id;
  DELETE FROM case_expenses WHERE case_id = p_case_id;
  DELETE FROM case_event_segments WHERE case_id = p_case_id;
  DELETE FROM case_events WHERE case_id = p_case_id;
  DELETE FROM case_deadlines WHERE case_id = p_case_id;
  DELETE FROM case_cnj_snapshots WHERE case_id = p_case_id;
  
  DELETE FROM analysis_subjects WHERE case_id = p_case_id;
  DELETE FROM agenda_items WHERE case_id = p_case_id;
  
  DELETE FROM lexos_case_notifications WHERE case_id = p_case_id;
  DELETE FROM lexos_case_state_history WHERE case_id = p_case_id;
  DELETE FROM lexos_case_deadlines WHERE case_id = p_case_id;
  
  -- Finally delete the case itself
  DELETE FROM cases WHERE id = p_case_id;
  
  RETURN jsonb_build_object('ok', true, 'deleted_case_id', p_case_id);
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao excluir caso: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_case_cascade(uuid) TO authenticated;