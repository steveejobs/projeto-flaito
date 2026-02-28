-- STEP 1: Drop all existing SELECT policies from office_members
DROP POLICY IF EXISTS "office_members_select_policy" ON public.office_members;

-- STEP 2: Create a simple SELECT policy that uses auth.uid() directly (NO function calls)
CREATE POLICY "office_members_select_own"
ON public.office_members
FOR SELECT
USING (user_id = auth.uid());

-- This allows users to see their own membership rows
-- Then, for seeing other members of the same office, we need a second policy using a subquery

CREATE POLICY "office_members_select_same_office"
ON public.office_members
FOR SELECT
USING (
  office_id IN (
    SELECT om.office_id 
    FROM public.office_members om 
    WHERE om.user_id = auth.uid()
  )
);