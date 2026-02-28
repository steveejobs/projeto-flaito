-- Step 1: Disable all blocking triggers
ALTER TABLE public.documents DISABLE TRIGGER trg_documents_versions;
ALTER TABLE public.documents DISABLE TRIGGER trg_audit_documents;
ALTER TABLE public.documents DISABLE TRIGGER lexos_audit_documents;
ALTER TABLE public.generated_docs_legacy DISABLE TRIGGER trg_block_generated_doc_after_materialized;

-- Step 2: Clear generated_docs_legacy references to soft-deleted documents
UPDATE public.generated_docs_legacy
SET document_id = NULL
WHERE document_id IN (
  SELECT id FROM public.documents
  WHERE deleted_at IS NOT NULL
);

-- Step 3: Delete document_versions for soft-deleted documents
DELETE FROM public.document_versions
WHERE document_id IN (
  SELECT id FROM public.documents
  WHERE deleted_at IS NOT NULL
);

-- Step 4: Hard-delete the soft-deleted documents
DELETE FROM public.documents
WHERE deleted_at IS NOT NULL;

-- Step 5: Re-enable all triggers
ALTER TABLE public.documents ENABLE TRIGGER trg_documents_versions;
ALTER TABLE public.documents ENABLE TRIGGER trg_audit_documents;
ALTER TABLE public.documents ENABLE TRIGGER lexos_audit_documents;
ALTER TABLE public.generated_docs_legacy ENABLE TRIGGER trg_block_generated_doc_after_materialized;