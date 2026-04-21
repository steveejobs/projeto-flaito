-- Make get_active_office_for_user bypass RLS safely (used by onboarding RPCs)
CREATE OR REPLACE FUNCTION public.get_active_office_for_user()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
SET row_security TO 'off'
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

GRANT EXECUTE ON FUNCTION public.get_active_office_for_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_office_for_user() TO anon;

-- Ensure onboarding functions can be executed
GRANT EXECUTE ON FUNCTION public.get_office_onboarding_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_actions_if_not_onboarded() TO authenticated;