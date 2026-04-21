-- Recria funções de sessão/roles como SECURITY DEFINER para evitar bloqueios por RLS

CREATE OR REPLACE FUNCTION public.lexos_healthcheck_session()
RETURNS TABLE(ok boolean, office_id uuid, role text, reason text, auth_uid uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_office uuid;
  v_role text;
BEGIN
  auth_uid := v_uid;

  IF v_uid IS NULL THEN
    ok := false;
    office_id := NULL;
    role := NULL;
    reason := 'auth.uid() is null';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT om.office_id, om.role::text
    INTO v_office, v_role
  FROM public.office_members om
  WHERE om.user_id = v_uid
    AND coalesce(om.is_active, true) = true
  ORDER BY (lower(om.role) = 'owner') DESC,
           (lower(om.role) = 'admin') DESC,
           om.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_office IS NULL THEN
    ok := false;
    office_id := NULL;
    role := NULL;
    reason := 'no active office for user';
    RETURN NEXT;
    RETURN;
  END IF;

  ok := true;
  office_id := v_office;
  role := coalesce(v_role, 'MEMBER');
  reason := NULL;
  RETURN NEXT;
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_active_office()
RETURNS TABLE(office_id uuid, office_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT om.office_id, o.name as office_name
  FROM public.office_members om
  JOIN public.offices o ON o.id = om.office_id
  WHERE om.user_id = auth.uid()
    AND coalesce(om.is_active, true) = true
  ORDER BY (lower(om.role) = 'owner') DESC,
           (lower(om.role) = 'admin') DESC,
           om.created_at DESC NULLS LAST
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.has_office_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT exists (
    SELECT 1
    FROM public.office_members om
    WHERE om.user_id = auth.uid()
      AND coalesce(om.is_active, true) = true
      AND (
        om.role::text = required_role
        OR lower(om.role::text) = 'owner'
        OR (lower(required_role) = 'member' AND lower(om.role::text) IN ('admin','owner'))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_office_role(p_office_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT exists (
    SELECT 1
    FROM public.office_members om
    WHERE om.office_id = p_office_id
      AND om.user_id = auth.uid()
      AND lower(om.role::text) = any(
        SELECT lower(x) FROM unnest(p_roles) AS t(x)
      )
      AND coalesce(om.is_active, true) = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_office_member(p_office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT exists (
    SELECT 1
    FROM public.office_members om
    WHERE om.office_id = p_office_id
      AND om.user_id = auth.uid()
      AND coalesce(om.is_active, true) = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_office_admin(p_office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT public.has_office_role(p_office_id, ARRAY['owner','admin']::text[]);
$function$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.lexos_healthcheck_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_active_office() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_office_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_office_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_office_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_office_admin(uuid) TO authenticated;

-- (opcional) revoga de público
REVOKE EXECUTE ON FUNCTION public.lexos_healthcheck_session() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_my_active_office() FROM public;
REVOKE EXECUTE ON FUNCTION public.has_office_role(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.has_office_role(uuid, text[]) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_office_member(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_office_admin(uuid) FROM public;
