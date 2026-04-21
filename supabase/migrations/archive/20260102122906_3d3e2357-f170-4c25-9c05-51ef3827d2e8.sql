-- =============================================================================
-- FIX: Update FK constraints to prevent orphan records
-- =============================================================================

-- 1. generated_docs_legacy.client_id: NO ACTION → CASCADE
ALTER TABLE public.generated_docs_legacy
DROP CONSTRAINT IF EXISTS generated_docs_client_id_fkey;

ALTER TABLE public.generated_docs_legacy
ADD CONSTRAINT generated_docs_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- 2. generated_documents.case_id: NO ACTION → CASCADE
ALTER TABLE public.generated_documents
DROP CONSTRAINT IF EXISTS generated_documents_case_id_fkey;

ALTER TABLE public.generated_documents
ADD CONSTRAINT generated_documents_case_id_fkey 
FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

-- 3. template_usage_logs.case_id: NO ACTION → SET NULL (preserva histórico)
ALTER TABLE public.template_usage_logs
DROP CONSTRAINT IF EXISTS template_usage_logs_case_id_fkey;

ALTER TABLE public.template_usage_logs
ADD CONSTRAINT template_usage_logs_case_id_fkey 
FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;