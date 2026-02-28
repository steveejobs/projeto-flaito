-- Fix hard_delete_client: DISABLE TRIGGER ALL fails for non-superuser because it includes system RI triggers
-- Use DISABLE/ENABLE TRIGGER USER instead (still bypasses app triggers like versioning/audit)

CREATE OR REPLACE FUNCTION public.hard_delete_client(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_office_id uuid;
  v_count int;
  v_case_ids uuid[];
  v_doc_ids uuid[];
BEGIN
  SELECT office_id INTO v_office_id FROM clients WHERE id = p_client_id;

  IF v_office_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente nao encontrado');
  END IF;

  -- Verificar apenas se e membro ativo (sem restricao de role)
  IF NOT EXISTS (
    SELECT 1 FROM office_members
    WHERE office_id = v_office_id AND user_id = auth.uid() AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voce nao e membro deste escritorio');
  END IF;

  -- Coletar IDs dos casos do cliente
  SELECT array_agg(id) INTO v_case_ids FROM cases WHERE client_id = p_client_id;

  -- Coletar IDs dos documentos dos casos E do kit inicial (via client_id direto ou metadata)
  IF v_case_ids IS NOT NULL THEN
    SELECT array_agg(id) INTO v_doc_ids 
    FROM documents 
    WHERE case_id = ANY(v_case_ids) 
       OR client_id = p_client_id
       OR (metadata->>'client_id')::uuid = p_client_id;
  ELSE
    SELECT array_agg(id) INTO v_doc_ids 
    FROM documents 
    WHERE client_id = p_client_id
       OR (metadata->>'client_id')::uuid = p_client_id;
  END IF;

  -- CRITICO: Desabilitar triggers de versao e auditoria antes de deletar documents
  -- NUNCA usar DISABLE TRIGGER ALL aqui: inclui triggers de sistema (RI_ConstraintTrigger_*) e falha sem superuser.
  ALTER TABLE documents DISABLE TRIGGER USER;

  BEGIN
    -- Deletar dependencias de documents primeiro
    IF v_doc_ids IS NOT NULL THEN
      DELETE FROM document_versions WHERE document_id = ANY(v_doc_ids);
      DELETE FROM document_sign_requests WHERE document_id = ANY(v_doc_ids);
    END IF;

    -- Deletar registros relacionados aos casos (ordem importa para FKs)
    IF v_case_ids IS NOT NULL THEN
      DELETE FROM case_tasks WHERE case_id = ANY(v_case_ids);
      DELETE FROM case_deadlines WHERE case_id = ANY(v_case_ids);
      DELETE FROM case_events WHERE case_id = ANY(v_case_ids);
      DELETE FROM case_event_segments WHERE case_id = ANY(v_case_ids);
      DELETE FROM case_expenses WHERE case_id = ANY(v_case_ids);
      DELETE FROM case_permissions WHERE case_id = ANY(v_case_ids);
      DELETE FROM case_status_logs WHERE case_id = ANY(v_case_ids);
      DELETE FROM case_stage_logs WHERE case_id = ANY(v_case_ids);
      DELETE FROM case_status_transitions WHERE case_id = ANY(v_case_ids);
      DELETE FROM case_cnj_snapshots WHERE case_id = ANY(v_case_ids);
      DELETE FROM case_knowledge_snapshots WHERE case_id = ANY(v_case_ids);
      DELETE FROM nija_sessions WHERE case_id = ANY(v_case_ids);
    END IF;

    -- Agora deletar documents (trigger de USUARIO desabilitado)
    IF v_doc_ids IS NOT NULL THEN
      DELETE FROM documents WHERE id = ANY(v_doc_ids);
    END IF;

    -- Deletar cases
    IF v_case_ids IS NOT NULL THEN
      DELETE FROM cases WHERE id = ANY(v_case_ids);
    END IF;
    
    -- Deletar dados diretos do cliente
    DELETE FROM client_files WHERE client_id = p_client_id;
    DELETE FROM e_signatures WHERE client_id = p_client_id;
    DELETE FROM client_kit_items WHERE client_id = p_client_id;
    DELETE FROM client_kit_requirements WHERE client_id = p_client_id;
    DELETE FROM client_contract_terms WHERE client_id = p_client_id;
    DELETE FROM client_events WHERE client_id = p_client_id;
    DELETE FROM generated_docs_legacy WHERE client_id = p_client_id;
    DELETE FROM chat_threads WHERE client_id = p_client_id;
    DELETE FROM agenda_items WHERE client_id = p_client_id;
    DELETE FROM client_assigned_lawyers WHERE client_id = p_client_id;

    -- CRITICO: Desabilitar trigger de soft-delete antes do DELETE do cliente
    ALTER TABLE clients DISABLE TRIGGER trg_clients_soft_delete;
    
    DELETE FROM clients WHERE id = p_client_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
  EXCEPTION WHEN OTHERS THEN
    -- Sempre reabilitar triggers mesmo em erro
    ALTER TABLE documents ENABLE TRIGGER USER;
    ALTER TABLE clients ENABLE TRIGGER trg_clients_soft_delete;
    RAISE;
  END;

  -- Reabilitar triggers apos exclusao
  ALTER TABLE documents ENABLE TRIGGER USER;
  ALTER TABLE clients ENABLE TRIGGER trg_clients_soft_delete;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma linha removida');
  END IF;

  RETURN jsonb_build_object('success', true, 'deleted_client_id', p_client_id);
END;
$function$;