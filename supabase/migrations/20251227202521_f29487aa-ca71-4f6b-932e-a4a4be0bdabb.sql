-- Remove políticas antigas que ainda estão causando recursão
DROP POLICY IF EXISTS "office_members_read_self" ON public.office_members;
DROP POLICY IF EXISTS "office_members_read_current_office" ON public.office_members;
DROP POLICY IF EXISTS "office_members_insert_admin" ON public.office_members;
DROP POLICY IF EXISTS "office_members_update_admin" ON public.office_members;
DROP POLICY IF EXISTS "office_members_delete_admin" ON public.office_members;