-- Drop recursive triggers on audit tables to prevent infinite recursion
DROP TRIGGER IF EXISTS lexos_audit_audit_events ON public.audit_events;
DROP TRIGGER IF EXISTS lexos_audit_document_access_logs ON public.document_access_logs;