-- Migration: 20260412230000_restore_session_rpc.sql
-- Objetivo: Corrigir o RPC lexos_healthcheck_session para retornar o campo 'ok' esperado pelo frontend

CREATE OR REPLACE FUNCTION public.lexos_healthcheck_session()
RETURNS TABLE (
    ok boolean,
    office_id uuid,
    role text,
    reason text,
    auth_uid uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_member record;
BEGIN
    -- Se não houver UID na sessão do Supabase, retorna falha
    IF v_uid IS NULL THEN
        RETURN QUERY SELECT false, null::uuid, null::text, 'No session'::text, null::uuid;
        RETURN;
    END IF;

    -- Busca o escritório principal/ativo do usuário
    SELECT om.office_id, om.role::text as member_role
    INTO v_member
    FROM public.office_members om
    WHERE om.user_id = v_uid
      AND om.is_active = true
    ORDER BY om.created_at ASC
    LIMIT 1;

    -- Se não encontrar vínculo, retorna ok=false informando que não tem escritório
    IF v_member.office_id IS NULL THEN
        RETURN QUERY SELECT false, null::uuid, null::text, 'No active office'::text, v_uid;
    ELSE
        -- Retorno de sucesso (ok: true) que o useOfficeRole.ts espera
        RETURN QUERY SELECT true, v_member.office_id, v_member.member_role, 'Success'::text, v_uid;
    END IF;
END;
$$;

-- Segurança: Resetar permissões e garantir apenas para usuários autenticados
REVOKE ALL ON FUNCTION public.lexos_healthcheck_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lexos_healthcheck_session() TO authenticated;

COMMENT ON FUNCTION public.lexos_healthcheck_session() IS 'RPC de validação de sessão que retorna o vínculo office/role do usuário atual.';
