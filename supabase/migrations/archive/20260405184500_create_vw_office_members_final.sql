-- Migration: 20260405184500_create_vw_office_members_final.sql
-- Objetivo: Criar view segura e funções auxiliares para visibilidade de membros.

-- 1. Função para obter o nome do usuário de forma segura
CREATE OR REPLACE FUNCTION public.get_auth_user_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT COALESCE(raw_user_meta_data->>'full_name', email, 'Usuário sem nome') 
  FROM auth.users 
  WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_user_name(uuid) TO authenticated;

-- 2. Recriar a view vw_office_members usando as funções de segurança
DROP VIEW IF EXISTS public.vw_office_members;

CREATE OR REPLACE VIEW public.vw_office_members AS
SELECT 
    om.id,
    om.id as member_id,
    om.office_id,
    om.user_id,
    om.role,
    om.is_active,
    om.created_at,
    public.get_auth_user_email(om.user_id) as email,
    public.get_auth_user_name(om.user_id) as full_name,
    om.phone,
    om.profession,
    om.oab_number,
    om.oab_uf
FROM public.office_members om;

-- Permissões
ALTER VIEW public.vw_office_members OWNER TO postgres;
GRANT SELECT ON public.vw_office_members TO authenticated;
GRANT SELECT ON public.vw_office_members TO service_role;

COMMENT ON VIEW public.vw_office_members IS 'View segura que utiliza funções SECURITY DEFINER para expor email e nome dos membros sem join direto com auth.users.';
