-- ============================================================
-- BLOCO C — SESSÃO
-- Executar no: Supabase SQL Editor
-- Projeto: ccvbosbjtlxewqybvwqj
-- Objetos: lexos_healthcheck_session, ensure_personal_office
-- Dependências externas: office_members, offices (existem)
-- ============================================================

BEGIN;

-- 1. RPC: lexos_healthcheck_session
CREATE OR REPLACE FUNCTION public.lexos_healthcheck_session()
RETURNS TABLE (office_id uuid, user_id uuid, role text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    om.office_id,
    om.user_id,
    om.role::text
  FROM public.office_members om
  WHERE om.user_id = auth.uid()
    AND om.is_active = true
  ORDER BY om.created_at ASC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.lexos_healthcheck_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lexos_healthcheck_session() TO authenticated;

-- 2. RPC: ensure_personal_office
CREATE OR REPLACE FUNCTION public.ensure_personal_office()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_office_id uuid;
BEGIN
  SELECT om.office_id INTO v_office_id
  FROM public.office_members om
  WHERE om.user_id = v_user_id
    AND om.is_active = true
  LIMIT 1;

  IF v_office_id IS NOT NULL THEN
    RETURN v_office_id;
  END IF;

  INSERT INTO public.offices (name, metadata)
  VALUES ('Uso Pessoal', '{"is_personal": true}'::jsonb)
  RETURNING id INTO v_office_id;

  INSERT INTO public.office_members (office_id, user_id, role, is_active)
  VALUES (v_office_id, v_user_id, 'OWNER', true);

  RETURN v_office_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_personal_office() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_personal_office() TO authenticated;

COMMIT;

-- ============================================================
-- VALIDAÇÃO TÉCNICA — Bloco C
-- ============================================================

-- Deve retornar 1 linha se o usuário logado tem office ativo
SELECT * FROM lexos_healthcheck_session();

-- Deve retornar uuid (existente ou novo)
SELECT ensure_personal_office();

-- ============================================================
-- ROLLBACK — Bloco C (executar se necessário)
-- ============================================================
-- DROP FUNCTION IF EXISTS public.lexos_healthcheck_session() CASCADE;
-- DROP FUNCTION IF EXISTS public.ensure_personal_office() CASCADE;
