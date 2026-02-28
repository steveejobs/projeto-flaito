-- Fix: remove row_security=off from SECURITY DEFINER functions (it causes 42501 "query would be affected by RLS")

CREATE OR REPLACE FUNCTION public.get_active_office_for_user()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT office_id
  FROM public.office_members
  WHERE user_id = auth.uid()
    AND coalesce(is_active, true) = true
  ORDER BY (lower(role) = 'owner') DESC,
           (lower(role) = 'admin') DESC,
           created_at DESC NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.lexos_user_office_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT office_id
  FROM public.office_members
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.lexos_is_owner_or_admin(p_office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.office_members
    WHERE user_id = auth.uid()
      AND office_id = p_office_id
      AND lower(role) IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_active_office_for_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_user_office_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_is_owner_or_admin(uuid) TO authenticated;

-- Remove anon access (not needed and reduces exposure)
REVOKE EXECUTE ON FUNCTION public.get_active_office_for_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.lexos_user_office_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.lexos_is_owner_or_admin(uuid) FROM anon;