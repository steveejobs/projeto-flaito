-- Fix infinite recursion in office_members RLS by using SECURITY DEFINER function

-- 1. Create helper function that bypasses RLS
CREATE OR REPLACE FUNCTION public.lexos_is_active_member(p_office_id uuid)
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
      AND is_active = true
  )
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.lexos_is_active_member(uuid) TO authenticated;

-- 2. Fix office_members SELECT policy (remove recursive subquery)
DROP POLICY IF EXISTS "office_members_select_same_office" ON public.office_members;
DROP POLICY IF EXISTS "Users can view their own office membership" ON public.office_members;
DROP POLICY IF EXISTS "office_members_select_own" ON public.office_members;

CREATE POLICY "office_members_select_same_office" 
ON public.office_members
FOR SELECT
TO authenticated
USING (public.lexos_is_active_member(office_id));

-- 3. Fix office_invites SELECT policy
DROP POLICY IF EXISTS "office_invites_select_same_office" ON public.office_invites;
DROP POLICY IF EXISTS "Users can view invites for their office" ON public.office_invites;

CREATE POLICY "office_invites_select_same_office"
ON public.office_invites
FOR SELECT
TO authenticated
USING (public.lexos_is_active_member(office_id));