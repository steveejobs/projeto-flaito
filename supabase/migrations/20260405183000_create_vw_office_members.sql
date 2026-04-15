-- Migration: 20260405_create_vw_office_members.sql
-- Objetivo: Criar uma view segura para listar membros com email e nome vindos do auth.users.

DROP VIEW IF EXISTS public.vw_office_members;

CREATE OR REPLACE VIEW public.vw_office_members AS
SELECT 
    om.id,
    om.id as member_id, -- alias para compatibilidade
    om.office_id,
    om.user_id,
    om.role,
    om.is_active,
    om.created_at,
    u.email as email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email, 'Usuário sem nome') as full_name,
    om.phone,
    om.profession,
    om.oab_number,
    om.oab_uf
FROM public.office_members om
LEFT JOIN auth.users u ON u.id = om.user_id;

-- Ajustar permissões
ALTER VIEW public.vw_office_members OWNER TO postgres;
GRANT SELECT ON public.vw_office_members TO authenticated;
GRANT SELECT ON public.vw_office_members TO service_role;

-- Comentário para documentação do sistema
COMMENT ON VIEW public.vw_office_members IS 'View segura que une dados de membros com informações de e-mail e nome da tabela auth.users.';
