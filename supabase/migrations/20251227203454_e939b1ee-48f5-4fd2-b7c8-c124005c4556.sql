-- Avoid RLS recursion: remove policy that subqueries office_members within office_members policy
DROP POLICY IF EXISTS "office_members_select_same_office" ON public.office_members;