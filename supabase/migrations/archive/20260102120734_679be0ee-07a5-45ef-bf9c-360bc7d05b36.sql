-- Drop e recria hard_delete_client com limpeza de documentos órfãos do kit inicial
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
  -- 1. Busca office_id do cliente
  SELECT office_id INTO v_office_id
  FROM clients
  WHERE id = p_client_id;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado: %', p_client_id;
  END IF;

  -- 2. Verifica permissão OWNER/ADMIN
  SELECT lower(role::text) INTO v_user_role
  FROM office_members
  WHERE office_id = v_office_id
    AND user_id = auth.uid()
    AND is_active = true;

  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permissão negada: apenas OWNER ou ADMIN podem executar hard delete';
  END IF;

  -- 3. Desabilita triggers de soft-delete temporariamente
  ALTER TABLE clients DISABLE TRIGGER trg_clients_soft_delete;
  ALTER TABLE documents DISABLE TRIGGER trg_documents_versions;
  ALTER TABLE documents DISABLE TRIGGER trg_audit_documents;
  ALTER TABLE documents DISABLE TRIGGER lexos_audit_documents;

  -- 4. Remove document_versions dos documentos do kit inicial (via metadata.client_id)
  DELETE FROM document_versions
  WHERE document_id IN (
    SELECT id FROM documents 
    WHERE metadata->>'client_id' = p_client_id::text
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('document_versions_kit', v_count);

  -- 5. Remove documents do kit inicial (scope=CLIENT_KIT com metadata.client_id)
  DELETE FROM documents
  WHERE metadata->>'client_id' = p_client_id::text;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('documents_kit', v_count);

  -- 6. Remove client_kit_items
  DELETE FROM client_kit_items WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('client_kit_items', v_count);

  -- 7. Remove client_files
  DELETE FROM client_files WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('client_files', v_count);

  -- 8. Remove client_contract_terms
  DELETE FROM client_contract_terms WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('client_contract_terms', v_count);

  -- 9. Remove client_signatures
  DELETE FROM client_signatures WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('client_signatures', v_count);

  -- 10. Remove generated_docs_legacy
  DELETE FROM generated_docs_legacy WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('generated_docs_legacy', v_count);

  -- 11. Remove cases e dependências (cascata natural via FKs)
  -- Primeiro remove documentos dos casos
  DELETE FROM document_versions
  WHERE document_id IN (
    SELECT d.id FROM documents d
    JOIN cases c ON d.case_id = c.id
    WHERE c.client_id = p_client_id
  );
  
  DELETE FROM documents
  WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('documents_cases', v_count);

  -- Remove casos
  DELETE FROM cases WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('cases', v_count);

  -- 12. Remove o cliente
  DELETE FROM clients WHERE id = p_client_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('clients', v_count);

  -- 13. Reabilita triggers
  ALTER TABLE clients ENABLE TRIGGER trg_clients_soft_delete;
  ALTER TABLE documents ENABLE TRIGGER trg_documents_versions;
  ALTER TABLE documents ENABLE TRIGGER trg_audit_documents;
  ALTER TABLE documents ENABLE TRIGGER lexos_audit_documents;

  RETURN jsonb_build_object(
    'success', true,
    'client_id', p_client_id,
    'deleted_counts', v_deleted_counts
  );
END;
$$;

-- Mantém permissões
GRANT EXECUTE ON FUNCTION public.hard_delete_client(uuid) TO authenticated;

COMMENT ON FUNCTION public.hard_delete_client IS 'Remove permanentemente um cliente e todos os dados relacionados, incluindo documentos do kit inicial (via metadata.client_id). Requer OWNER/ADMIN.';