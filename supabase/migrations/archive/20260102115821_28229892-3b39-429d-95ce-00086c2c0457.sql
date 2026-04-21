-- Create administrative function to hard delete orphan documents
-- This bypasses triggers and cleans up all dependencies
CREATE OR REPLACE FUNCTION public.admin_hard_delete_orphan_documents()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_versions int;
  v_deleted_docs int;
  v_doc_ids uuid[];
BEGIN
  -- Get the IDs of orphan documents
  SELECT array_agg(id) INTO v_doc_ids
  FROM documents 
  WHERE deleted_at IS NULL AND case_id IS NULL;
  
  IF v_doc_ids IS NULL OR array_length(v_doc_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', true, 'deleted_versions', 0, 'deleted_documents', 0, 'message', 'No orphan documents found');
  END IF;

  -- Disable the trigger temporarily
  ALTER TABLE documents DISABLE TRIGGER trg_document_versions;
  
  -- Delete from document_versions first
  DELETE FROM document_versions WHERE document_id = ANY(v_doc_ids);
  GET DIAGNOSTICS v_deleted_versions = ROW_COUNT;
  
  -- Delete the orphan documents
  DELETE FROM documents WHERE id = ANY(v_doc_ids);
  GET DIAGNOSTICS v_deleted_docs = ROW_COUNT;
  
  -- Re-enable the trigger
  ALTER TABLE documents ENABLE TRIGGER trg_document_versions;
  
  RETURN jsonb_build_object(
    'success', true,
    'deleted_versions', v_deleted_versions,
    'deleted_documents', v_deleted_docs,
    'message', format('Deleted %s versions and %s documents', v_deleted_versions, v_deleted_docs)
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Re-enable trigger in case of error
  ALTER TABLE documents ENABLE TRIGGER trg_document_versions;
  RAISE;
END;
$$;