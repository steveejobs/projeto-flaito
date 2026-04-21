-- Robust fix: avoid direct client SELECT on office_members (RLS can break app load)
-- Provide a SECURITY DEFINER RPC that returns only the current user's active office.

CREATE OR REPLACE FUNCTION public.get_my_active_office()
RETURNS TABLE(office_id uuid, office_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.office_id, o.name as office_name
  FROM public.office_members om
  JOIN public.offices o ON o.id = om.office_id
  WHERE om.user_id = auth.uid()
    AND coalesce(om.is_active, true) = true
  ORDER BY (lower(om.role) = 'owner') DESC,
           (lower(om.role) = 'admin') DESC,
           om.created_at DESC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_active_office() TO anon, authenticated;
