-- Corrige a função hard_delete_client que referenciava tabela inexistente 'client_signatures'
-- A tabela correta é 'e_signatures'

DROP FUNCTION IF EXISTS public.hard_delete_client(uuid);

CREATE OR REPLACE FUNCTION public.hard_delete_client(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id uuid;
  v_user_role text;
  v_deleted_counts jsonb := '{}';
  v_count int;
BEGIN
  -- 1. Verifica se o cliente existe e pega o office_id
  SELECT office_id INTO v_office_id
  FROM clients
  WHERE id = p_client_id;

  IF v_office_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  -- 2. Verifica permissão do usuário
  SELECT role INTO v_user_role
  FROM office_members
  WHERE office_id = v_office_id AND user_id = auth.uid();

  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para excluir cliente');
  END IF;

  -- 3. Remove case_tasks (via cases)
  DELETE FROM case_tasks WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('case_tasks', v_count);

  -- 4. Remove case_deadlines
  DELETE FROM case_deadlines WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('case_deadlines', v_count);

  -- 5. Remove case_events
  DELETE FROM case_events WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('case_events', v_count);

  -- 6. Remove documents
  DELETE FROM documents WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('documents', v_count);

  -- 7. Remove cases
  DELETE FROM cases WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('cases', v_count);

  -- 8. Remove client_files
  DELETE FROM client_files WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('client_files', v_count);

  -- 9. Remove e_signatures (CORRIGIDO - era client_signatures)
  DELETE FROM e_signatures WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('e_signatures', v_count);

  -- 10. Remove client_kit_items
  DELETE FROM client_kit_items WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('client_kit_items', v_count);

  -- 11. Remove client_kit_requirements
  DELETE FROM client_kit_requirements WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('client_kit_requirements', v_count);

  -- 12. Remove client_contract_terms
  DELETE FROM client_contract_terms WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('client_contract_terms', v_count);

  -- 13. Remove client_events
  DELETE FROM client_events WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('client_events', v_count);

  -- 14. Finalmente, remove o cliente
  DELETE FROM clients WHERE id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('clients', v_count);

  RETURN jsonb_build_object('success', true, 'deleted', v_deleted_counts);
END;
$$;