-- Recria current_office_id() como SECURITY DEFINER para evitar bloqueio por RLS em office_members

CREATE OR REPLACE FUNCTION public.current_office_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT om.office_id
  FROM public.office_members om
  WHERE om.user_id = auth.uid()
    AND coalesce(om.is_active, true) = true
  ORDER BY 
    (lower(om.role) = 'owner') DESC,
    (lower(om.role) = 'admin') DESC,
    om.created_at DESC NULLS LAST
  LIMIT 1;
$function$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.current_office_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_office_id() FROM public;