-- Drop the recursive trigger on audit_logs table to prevent infinite recursion
DROP TRIGGER IF EXISTS lexos_audit_audit_logs ON public.audit_logs;