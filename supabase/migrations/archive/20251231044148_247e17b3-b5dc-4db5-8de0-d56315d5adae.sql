-- Corrigir hard_delete_client para incluir generated_docs_legacy
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
  SELECT EXISTS(SELECT 1 FROM clients WHERE id = p_client_id) INTO v_client_exists;
  IF NOT v_client_exists THEN
    RAISE EXCEPTION 'Cliente não encontrado: %', p_client_id;
  END IF;

  SELECT array_agg(id) INTO v_case_ids
  FROM cases
  WHERE client_id = p_client_id;

  -- Desabilitar triggers
  ALTER TABLE public.clients DISABLE TRIGGER trg_clients_soft_delete;
  ALTER TABLE public.clients DISABLE TRIGGER trg_block_client_delete_if_cases;
  ALTER TABLE public.documents DISABLE TRIGGER trg_documents_versions;

  BEGIN
    -- 1) Documentos gerados do cliente (ambas as tabelas)
    DELETE FROM public.client_kit_items WHERE client_id = p_client_id;
    DELETE FROM public.client_contract_terms WHERE client_id = p_client_id;
    DELETE FROM public.client_files WHERE client_id = p_client_id;
    DELETE FROM public.generated_docs WHERE client_id = p_client_id;
    DELETE FROM public.generated_docs_legacy WHERE client_id = p_client_id;

    -- 2) Casos + dependências
    IF v_case_ids IS NOT NULL AND array_length(v_case_ids, 1) > 0 THEN
      -- Requests de assinatura (tabela varia por ambiente)
      IF to_regclass('public.document_sign_requests') IS NOT NULL THEN
        EXECUTE 'DELETE FROM public.document_sign_requests WHERE document_id IN (SELECT id FROM public.documents WHERE case_id = ANY($1))'
        USING v_case_ids;
      END IF;

      IF to_regclass('public.sign_requests') IS NOT NULL THEN
        EXECUTE 'DELETE FROM public.sign_requests WHERE document_id IN (SELECT id FROM public.documents WHERE case_id = ANY($1))'
        USING v_case_ids;
      END IF;

      -- Versões e documentos
      DELETE FROM public.document_versions
      WHERE document_id IN (SELECT id FROM public.documents WHERE case_id = ANY(v_case_ids));

      DELETE FROM public.documents WHERE case_id = ANY(v_case_ids);

      -- Demais vínculos do caso
      DELETE FROM public.case_event_segments WHERE case_id = ANY(v_case_ids);
      DELETE FROM public.case_events WHERE case_id = ANY(v_case_ids);
      DELETE FROM public.case_deadlines WHERE case_id = ANY(v_case_ids);
      DELETE FROM public.case_expenses WHERE case_id = ANY(v_case_ids);
      DELETE FROM public.case_tasks WHERE case_id = ANY(v_case_ids);
      DELETE FROM public.case_permissions WHERE case_id = ANY(v_case_ids);
      DELETE FROM public.case_stage_logs WHERE case_id = ANY(v_case_ids);
      DELETE FROM public.case_status_logs WHERE case_id = ANY(v_case_ids);
      DELETE FROM public.case_status_transitions WHERE case_id = ANY(v_case_ids);
      DELETE FROM public.case_cnj_snapshots WHERE case_id = ANY(v_case_ids);
      DELETE FROM public.case_knowledge_snapshots WHERE case_id = ANY(v_case_ids);
      DELETE FROM public.agenda_items WHERE case_id = ANY(v_case_ids);

      DELETE FROM public.chat_messages WHERE thread_id IN (
        SELECT id FROM public.chat_threads WHERE case_id = ANY(v_case_ids)
      );
      DELETE FROM public.chat_threads WHERE case_id = ANY(v_case_ids);

      DELETE FROM public.cases WHERE id = ANY(v_case_ids);
    END IF;

    -- 3) Itens do cliente que não dependem do case_id
    DELETE FROM public.agenda_items WHERE client_id = p_client_id;

    DELETE FROM public.chat_messages WHERE thread_id IN (
      SELECT id FROM public.chat_threads WHERE client_id = p_client_id
    );
    DELETE FROM public.chat_threads WHERE client_id = p_client_id;

    -- 4) Cliente
    DELETE FROM public.clients WHERE id = p_client_id;

  EXCEPTION WHEN OTHERS THEN
    -- Garantir que triggers voltem mesmo com erro
    ALTER TABLE public.clients ENABLE TRIGGER trg_clients_soft_delete;
    ALTER TABLE public.clients ENABLE TRIGGER trg_block_client_delete_if_cases;
    ALTER TABLE public.documents ENABLE TRIGGER trg_documents_versions;
    RAISE;
  END;

  -- Reabilitar triggers (caminho feliz)
  ALTER TABLE public.clients ENABLE TRIGGER trg_clients_soft_delete;
  ALTER TABLE public.clients ENABLE TRIGGER trg_block_client_delete_if_cases;
  ALTER TABLE public.documents ENABLE TRIGGER trg_documents_versions;
END;
$$;