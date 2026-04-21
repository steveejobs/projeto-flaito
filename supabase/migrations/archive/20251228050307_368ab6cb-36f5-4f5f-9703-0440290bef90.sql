-- Fix: allow Edge Functions / authenticated users to execute template helper functions
-- These functions are required by lexos-create-client-docs during template rendering.

GRANT EXECUTE ON FUNCTION public.template_missing_vars(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.template_vars(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.render_template_preview(uuid, jsonb) TO authenticated, service_role;
