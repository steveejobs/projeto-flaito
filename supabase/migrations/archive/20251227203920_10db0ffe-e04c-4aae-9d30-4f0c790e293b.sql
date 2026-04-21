-- Emergency fix to restore app access: disable RLS on office_members
-- NOTE: This is temporary; we will re-enable with corrected non-recursive policies after confirming the app works.
ALTER TABLE public.office_members DISABLE ROW LEVEL SECURITY;