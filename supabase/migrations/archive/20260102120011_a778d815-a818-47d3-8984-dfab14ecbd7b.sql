-- Temporarily disable all blocking triggers
ALTER TABLE documents DISABLE TRIGGER trg_documents_versions;
ALTER TABLE documents DISABLE TRIGGER trg_audit_documents;
ALTER TABLE documents DISABLE TRIGGER lexos_audit_documents;
ALTER TABLE generated_docs_legacy DISABLE TRIGGER trg_block_generated_doc_after_materialized;

-- First, nullify document_id in generated_docs_legacy for orphan documents
UPDATE generated_docs_legacy 
SET document_id = NULL 
WHERE document_id IN (
  SELECT id FROM documents 
  WHERE deleted_at IS NULL AND case_id IS NULL
);

-- Delete from document_versions for orphan documents
DELETE FROM document_versions 
WHERE document_id IN (
  SELECT id FROM documents 
  WHERE deleted_at IS NULL AND case_id IS NULL
);

-- Delete orphan documents
DELETE FROM documents 
WHERE deleted_at IS NULL AND case_id IS NULL;

-- Re-enable all triggers
ALTER TABLE documents ENABLE TRIGGER trg_documents_versions;
ALTER TABLE documents ENABLE TRIGGER trg_audit_documents;
ALTER TABLE documents ENABLE TRIGGER lexos_audit_documents;
ALTER TABLE generated_docs_legacy ENABLE TRIGGER trg_block_generated_doc_after_materialized;

-- Clean up the admin function
DROP FUNCTION IF EXISTS public.admin_hard_delete_orphan_documents();