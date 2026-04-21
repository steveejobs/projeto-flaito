-- Fix lexos_assert_admin to accept both 'admin' and 'owner' roles
CREATE OR REPLACE FUNCTION public.lexos_assert_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  -- MODO SQL EDITOR / SUPERUSER: sem JWT, libera apenas para postgres/service_role
  if auth.uid() is null then
    if current_user in ('postgres', 'service_role') then
      return;
    end if;
    raise exception 'UNAUTHORIZED';
  end if;

  -- MODO NORMAL (APP): exige admin OU owner em office_members
  if not exists (
    select 1
    from public.office_members om
    where om.user_id = auth.uid()
      and coalesce(om.is_active, true) = true
      and lower(coalesce(om.role,'')) in ('admin', 'owner')
    limit 1
  ) then
    raise exception 'FORBIDDEN';
  end if;
end;
$function$;