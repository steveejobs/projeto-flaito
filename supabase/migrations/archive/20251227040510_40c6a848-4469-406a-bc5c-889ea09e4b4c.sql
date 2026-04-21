CREATE OR REPLACE FUNCTION public.lexos_healthcheck_session()
 RETURNS TABLE(ok boolean, office_id uuid, role text, reason text, auth_uid uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    declare
      v_uid uuid := auth.uid();
      v_office uuid;
      v_role text;
    begin
      auth_uid := v_uid;

      if v_uid is null then
        ok := false;
        office_id := null;
        role := null;
        reason := 'auth.uid() is null';
        return next;
        return;
      end if;

      select om.office_id, om.role::text
        into v_office, v_role
      from public.office_members om
      where om.user_id = v_uid
        and coalesce(om.is_active, true) = true
      order by om.created_at desc nulls last
      limit 1;

      if v_office is null then
        ok := false;
        office_id := null;
        role := null;
        reason := 'no active office for user';
        return next;
        return;
      end if;

      ok := true;
      office_id := v_office;
      role := coalesce(v_role, 'MEMBER');
      reason := null;
      return next;
      return;
    end;
    $function$;