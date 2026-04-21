-- Fix: allow insert triggers to call log_document_event during generated_docs_legacy inserts
GRANT EXECUTE ON FUNCTION public.log_document_event(uuid, text, text, jsonb) TO authenticated, service_role;
