-- Disable FORCE RLS on office_members so SECURITY DEFINER functions can work as intended
ALTER TABLE public.office_members NO FORCE ROW LEVEL SECURITY;

-- Also harden helper functions to bypass RLS explicitly
CREATE OR REPLACE FUNCTION public.lexos_user_office_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = 'off'
AS $$
  SELECT office_id FROM public.office_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.lexos_is_owner_or_admin(p_office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.office_members
    WHERE user_id = auth.uid()
      AND office_id = p_office_id
      AND lower(role) IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.lexos_user_office_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_is_owner_or_admin(uuid) TO authenticated;