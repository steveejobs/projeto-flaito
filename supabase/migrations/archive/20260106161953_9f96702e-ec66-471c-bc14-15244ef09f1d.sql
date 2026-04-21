-- Fix archive_client: remove OWNER/ADMIN restriction, allow any active office member
CREATE OR REPLACE FUNCTION public.archive_client(p_client_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id uuid;
BEGIN
  SELECT office_id INTO v_office_id FROM clients WHERE id = p_client_id;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Cliente nao encontrado';
  END IF;

  -- Verificar apenas se e membro ativo (sem restricao de role)
  IF NOT EXISTS (
    SELECT 1 FROM office_members
    WHERE office_id = v_office_id AND user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Voce nao e membro deste escritorio';
  END IF;

  UPDATE clients SET status = 'archived', updated_at = now() WHERE id = p_client_id;

  -- Log the action
  INSERT INTO public.audit_logs (
    actor_user_id,
    office_id,
    entity,
    entity_id,
    action,
    details
  ) VALUES (
    auth.uid(),
    v_office_id,
    'client',
    p_client_id,
    'archive',
    jsonb_build_object('reason', p_reason)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_client(uuid, text) TO authenticated;

-- Fix hard_delete_client: remove OWNER/ADMIN restriction + disable soft-delete trigger
DROP FUNCTION IF EXISTS public.hard_delete_client(uuid);

CREATE OR REPLACE FUNCTION public.hard_delete_client(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id uuid;
  v_count int;
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

  -- Deletar registros relacionados primeiro (ordem importa para FKs)
  DELETE FROM case_tasks WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  DELETE FROM case_deadlines WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  DELETE FROM case_events WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  DELETE FROM case_event_segments WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  DELETE FROM case_expenses WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  DELETE FROM case_permissions WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  DELETE FROM case_status_logs WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  DELETE FROM case_stage_logs WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  DELETE FROM case_status_transitions WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  DELETE FROM case_cnj_snapshots WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  DELETE FROM case_knowledge_snapshots WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  DELETE FROM documents WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  DELETE FROM cases WHERE client_id = p_client_id;
  
  DELETE FROM client_files WHERE client_id = p_client_id;
  DELETE FROM e_signatures WHERE client_id = p_client_id;
  DELETE FROM client_kit_items WHERE client_id = p_client_id;
  DELETE FROM client_kit_requirements WHERE client_id = p_client_id;
  DELETE FROM client_contract_terms WHERE client_id = p_client_id;
  DELETE FROM client_events WHERE client_id = p_client_id;
  DELETE FROM generated_docs_legacy WHERE client_id = p_client_id;
  DELETE FROM chat_threads WHERE client_id = p_client_id;
  DELETE FROM agenda_items WHERE client_id = p_client_id;

  -- CRITICO: Desabilitar trigger de soft-delete antes do DELETE
  ALTER TABLE clients DISABLE TRIGGER trg_clients_soft_delete;
  
  BEGIN
    DELETE FROM clients WHERE id = p_client_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    -- Sempre reabilitar trigger mesmo em erro
    ALTER TABLE clients ENABLE TRIGGER trg_clients_soft_delete;
    RAISE;
  END;

  -- Reabilitar trigger apos exclusao
  ALTER TABLE clients ENABLE TRIGGER trg_clients_soft_delete;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma linha removida');
  END IF;

  RETURN jsonb_build_object('success', true, 'deleted_client_id', p_client_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.hard_delete_client(uuid) TO authenticated;