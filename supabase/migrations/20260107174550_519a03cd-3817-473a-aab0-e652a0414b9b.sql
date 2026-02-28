-- Fix RLS policies so office members can see all members of their office

-- Drop existing restrictive SELECT policy on office_members
DROP POLICY IF EXISTS "Users can view their own office membership" ON public.office_members;
DROP POLICY IF EXISTS "office_members_select_own" ON public.office_members;
DROP POLICY IF EXISTS "office_members_select_same_office" ON public.office_members;

-- Create new SELECT policy that allows viewing all members of the same office
CREATE POLICY "office_members_select_same_office" 
ON public.office_members
FOR SELECT
TO authenticated
USING (
  office_id IN (
    SELECT om.office_id 
    FROM public.office_members om 
    WHERE om.user_id = auth.uid() 
      AND om.is_active = true
  )
);

-- Also fix office_invites SELECT policy to allow viewing invites for same office
DROP POLICY IF EXISTS "Users can view invites for their office" ON public.office_invites;
DROP POLICY IF EXISTS "office_invites_select_same_office" ON public.office_invites;

CREATE POLICY "office_invites_select_same_office"
ON public.office_invites
FOR SELECT
TO authenticated
USING (
  office_id IN (
    SELECT om.office_id 
    FROM public.office_members om 
    WHERE om.user_id = auth.uid() 
      AND om.is_active = true
  )
);