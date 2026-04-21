-- FIX: Erro de foreign key ao excluir cliente
-- O trigger trg_documents_versions é acionado durante DELETE em documents
-- e tenta inserir em document_versions, causando violação de FK

CREATE OR REPLACE FUNCTION public.hard_delete_client(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_ids uuid[];
  v_client_exists boolean;
BEGIN
  -- Verificar se o cliente existe
  SELECT EXISTS(SELECT 1 FROM clients WHERE id = p_client_id) INTO v_client_exists;
  
  IF NOT v_client_exists THEN
    RAISE EXCEPTION 'Cliente não encontrado: %', p_client_id;
  END IF;

  -- Coletar IDs dos casos do cliente
  SELECT array_agg(id) INTO v_case_ids
  FROM cases
  WHERE client_id = p_client_id;

  -- ========================================
  -- DESABILITAR TRIGGERS ANTES DAS DELEÇÕES
  -- ========================================
  ALTER TABLE public.clients DISABLE TRIGGER trg_clients_soft_delete;
  ALTER TABLE public.clients DISABLE TRIGGER trg_block_client_delete_if_cases;
  ALTER TABLE public.documents DISABLE TRIGGER trg_documents_versions;

  -- ========================================
  -- DELETAR REGISTROS EM ORDEM DE DEPENDÊNCIA
  -- ========================================

  -- 1. Deletar itens de kit do cliente
  DELETE FROM public.client_kit_items WHERE client_id = p_client_id;

  -- 2. Deletar termos de contrato
  DELETE FROM public.client_contract_terms WHERE client_id = p_client_id;

  -- 3. Deletar arquivos do cliente (client_files)
  DELETE FROM public.client_files WHERE client_id = p_client_id;

  -- 4. Deletar documentos gerados (generated_docs)
  DELETE FROM public.generated_docs WHERE client_id = p_client_id;

  -- 5. Se houver casos, deletar registros vinculados aos casos
  IF v_case_ids IS NOT NULL AND array_length(v_case_ids, 1) > 0 THEN
    -- 5.1. Deletar sign_requests dos documentos dos casos
    DELETE FROM public.sign_requests 
    WHERE document_id IN (SELECT id FROM public.documents WHERE case_id = ANY(v_case_ids));

    -- 5.2. Deletar document_versions dos documentos dos casos
    DELETE FROM public.document_versions 
    WHERE document_id IN (SELECT id FROM public.documents WHERE case_id = ANY(v_case_ids));

    -- 5.3. Deletar documentos dos casos
    DELETE FROM public.documents WHERE case_id = ANY(v_case_ids);

    -- 5.4. Deletar eventos dos casos
    DELETE FROM public.case_event_segments WHERE case_id = ANY(v_case_ids);
    DELETE FROM public.case_events WHERE case_id = ANY(v_case_ids);

    -- 5.5. Deletar deadlines dos casos
    DELETE FROM public.case_deadlines WHERE case_id = ANY(v_case_ids);

    -- 5.6. Deletar despesas dos casos
    DELETE FROM public.case_expenses WHERE case_id = ANY(v_case_ids);

    -- 5.7. Deletar tarefas dos casos
    DELETE FROM public.case_tasks WHERE case_id = ANY(v_case_ids);

    -- 5.8. Deletar permissões dos casos
    DELETE FROM public.case_permissions WHERE case_id = ANY(v_case_ids);

    -- 5.9. Deletar logs de stage e status
    DELETE FROM public.case_stage_logs WHERE case_id = ANY(v_case_ids);
    DELETE FROM public.case_status_logs WHERE case_id = ANY(v_case_ids);
    DELETE FROM public.case_status_transitions WHERE case_id = ANY(v_case_ids);

    -- 5.10. Deletar snapshots CNJ
    DELETE FROM public.case_cnj_snapshots WHERE case_id = ANY(v_case_ids);

    -- 5.11. Deletar knowledge snapshots
    DELETE FROM public.case_knowledge_snapshots WHERE case_id = ANY(v_case_ids);

    -- 5.12. Deletar agenda items vinculados aos casos
    DELETE FROM public.agenda_items WHERE case_id = ANY(v_case_ids);

    -- 5.13. Deletar chat threads vinculados aos casos
    DELETE FROM public.chat_messages WHERE thread_id IN (
      SELECT id FROM public.chat_threads WHERE case_id = ANY(v_case_ids)
    );
    DELETE FROM public.chat_threads WHERE case_id = ANY(v_case_ids);

    -- 5.14. Deletar os casos
    DELETE FROM public.cases WHERE id = ANY(v_case_ids);
  END IF;

  -- 6. Deletar agenda items do cliente (sem caso)
  DELETE FROM public.agenda_items WHERE client_id = p_client_id;

  -- 7. Deletar chat threads do cliente (sem caso)
  DELETE FROM public.chat_messages WHERE thread_id IN (
    SELECT id FROM public.chat_threads WHERE client_id = p_client_id
  );
  DELETE FROM public.chat_threads WHERE client_id = p_client_id;

  -- 8. Finalmente, deletar o cliente
  DELETE FROM public.clients WHERE id = p_client_id;

  -- ========================================
  -- REABILITAR TRIGGERS APÓS DELEÇÕES
  -- ========================================
  ALTER TABLE public.clients ENABLE TRIGGER trg_clients_soft_delete;
  ALTER TABLE public.clients ENABLE TRIGGER trg_block_client_delete_if_cases;
  ALTER TABLE public.documents ENABLE TRIGGER trg_documents_versions;

END;
$$;