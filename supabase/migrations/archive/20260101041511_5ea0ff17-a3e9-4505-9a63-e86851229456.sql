-- Grant base table permissions to authenticated role
-- (RLS policies only work if the role has underlying table permissions)

GRANT SELECT, INSERT ON public.frontend_audit_snapshots TO authenticated;
GRANT SELECT, INSERT ON public.rebuild_jobs TO authenticated;
GRANT SELECT, INSERT ON public.system_telemetry TO authenticated;

-- Also grant to service_role for Edge Functions
GRANT ALL ON public.frontend_audit_snapshots TO service_role;
GRANT ALL ON public.rebuild_jobs TO service_role;
GRANT ALL ON public.system_telemetry TO service_role;