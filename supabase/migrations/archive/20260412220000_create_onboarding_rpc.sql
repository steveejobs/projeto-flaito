-- Migration: 20260412220000_create_onboarding_rpc.sql
-- Objetivo: Criar a função RPC get_office_onboarding_status compatível com a tabela office_onboarding_steps

CREATE OR REPLACE FUNCTION public.get_office_onboarding_status()
RETURNS TABLE (
    step_key text,
    completed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_office_id uuid;
BEGIN
    -- 1. Obter o ID do escritório do usuário atual
    SELECT om.office_id INTO v_office_id
    FROM public.office_members om
    WHERE om.user_id = auth.uid()
      AND om.is_active = true
    LIMIT 1;

    IF v_office_id IS NULL THEN
        RETURN;
    END IF;

    -- 2. Garantir que os steps estejam inicializados para este escritório
    -- (Nota: Assumindo que init_office_onboarding_steps já usa a tabela correta)
    PERFORM public.init_office_onboarding_steps(v_office_id);

    -- 3. Retornar os steps
    RETURN QUERY
    SELECT 
        oos.step_key,
        oos.completed
    FROM public.office_onboarding_steps oos
    WHERE oos.office_id = v_office_id;
END;
$$;

-- Garantir permissões para usuários autenticados
GRANT EXECUTE ON FUNCTION public.get_office_onboarding_status() TO authenticated;

COMMENT ON FUNCTION public.get_office_onboarding_status() IS 'Retorna o progresso do onboarding para o escritório do usuário logado usando a tabela office_onboarding_steps.';
