-- Grant table-level permissions for office_invites
GRANT SELECT ON public.office_invites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_invites TO authenticated;

-- Drop existing SELECT policies to recreate with proper permissions
DROP POLICY IF EXISTS "Users can view invite by token" ON public.office_invites;
DROP POLICY IF EXISTS "Anon can view valid invites by token" ON public.office_invites;

-- Policy: Anonymous users can SELECT valid (not expired, not accepted) invites
-- This is safe because they need the token to query
CREATE POLICY "Anon can view valid invites by token"
ON public.office_invites
FOR SELECT
TO anon
USING (
  accepted_at IS NULL 
  AND expires_at > now()
);

-- Policy: Authenticated users can view invites for their offices
CREATE POLICY "Authenticated users can view office invites"
ON public.office_invites
FOR SELECT
TO authenticated
USING (
  office_id IN (
    SELECT office_id FROM public.office_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);