-- 1) Remove políticas problemáticas da office_members
DROP POLICY IF EXISTS "office_members_select_admin" ON public.office_members;
DROP POLICY IF EXISTS "office_members_insert_owner_admin" ON public.office_members;
DROP POLICY IF EXISTS "office_members_update_owner_admin" ON public.office_members;
DROP POLICY IF EXISTS "office_members_insert_owner" ON public.office_members;
DROP POLICY IF EXISTS "office_members_update_owner" ON public.office_members;
DROP POLICY IF EXISTS "owners_admins_can_insert" ON public.office_members;
DROP POLICY IF EXISTS "owners_admins_can_update" ON public.office_members;
DROP POLICY IF EXISTS "owners_admins_can_delete" ON public.office_members;
DROP POLICY IF EXISTS "members_insert_admin" ON public.office_members;
DROP POLICY IF EXISTS "members_update_admin" ON public.office_members;
DROP POLICY IF EXISTS "office_members_select_same_office" ON public.office_members;
DROP POLICY IF EXISTS "office_members_insert_by_owner_admin" ON public.office_members;
DROP POLICY IF EXISTS "office_members_update_by_owner_admin" ON public.office_members;
DROP POLICY IF EXISTS "office_members_delete_by_owner_admin" ON public.office_members;

-- 2) Cria função helper SECURITY DEFINER para obter office_ids do usuário
CREATE OR REPLACE FUNCTION public.lexos_user_office_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT office_id FROM public.office_members WHERE user_id = auth.uid();
$$;

-- 3) Grant execute para authenticated e anon
GRANT EXECUTE ON FUNCTION public.lexos_user_office_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_user_office_ids() TO anon;

-- 4) Cria função para verificar se usuário é owner/admin em um office específico
CREATE OR REPLACE FUNCTION public.lexos_is_owner_or_admin(p_office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.office_members
    WHERE user_id = auth.uid()
      AND office_id = p_office_id
      AND role IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.lexos_is_owner_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_is_owner_or_admin(uuid) TO anon;

-- 5) Cria novas políticas simples para office_members

-- SELECT: usuário vê membros dos escritórios onde ele é membro
CREATE POLICY "office_members_select_policy"
ON public.office_members
FOR SELECT
USING (office_id IN (SELECT public.lexos_user_office_ids()));

-- INSERT: apenas owner/admin pode inserir no mesmo office
CREATE POLICY "office_members_insert_policy"
ON public.office_members
FOR INSERT
WITH CHECK (public.lexos_is_owner_or_admin(office_id));

-- UPDATE: apenas owner/admin pode atualizar no mesmo office
CREATE POLICY "office_members_update_policy"
ON public.office_members
FOR UPDATE
USING (public.lexos_is_owner_or_admin(office_id));

-- DELETE: apenas owner/admin pode deletar no mesmo office
CREATE POLICY "office_members_delete_policy"
ON public.office_members
FOR DELETE
USING (public.lexos_is_owner_or_admin(office_id));

-- 6) Garante permissão na função get_active_office_for_user se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_active_office_for_user') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_active_office_for_user TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_active_office_for_user TO anon';
  END IF;
END
$$;