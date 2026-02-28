-- Ensure RLS is enabled on office_members
ALTER TABLE public.office_members ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own membership rows (needed for office context validation)
DROP POLICY IF EXISTS office_members_select_own ON public.office_members;
CREATE POLICY office_members_select_own
ON public.office_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
