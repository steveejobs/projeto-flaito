-- Add policy to allow members to update their OWN profile
-- This complements the existing policy that allows OWNER/ADMIN to update any member

CREATE POLICY "office_members_update_own_profile"
ON public.office_members
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);