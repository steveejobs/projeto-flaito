-- ============================================================
-- BLOCO B — CONVITES
-- Executar no: Supabase SQL Editor
-- Projeto: ccvbosbjtlxewqybvwqj
-- Objetos: get_office_invite_public, accept_office_invite
-- Dependências externas: office_invites, offices (existem)
-- ============================================================

BEGIN;

-- 1. RPC: get_office_invite_public
CREATE OR REPLACE FUNCTION public.get_office_invite_public(p_token text)
RETURNS TABLE (
  invite_id uuid,
  email text,
  role text,
  office_id uuid,
  office_name text,
  expires_at timestamptz,
  created_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oi.id AS invite_id,
    oi.email,
    oi.role::text,
    oi.office_id,
    o.name AS office_name,
    oi.expires_at,
    oi.invited_by::uuid AS created_by
  FROM public.office_invites oi
  JOIN public.offices o ON o.id = oi.office_id
  WHERE oi.token = p_token
    AND oi.accepted_at IS NULL
    AND oi.expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION public.get_office_invite_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_office_invite_public(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_office_invite_public(text) TO authenticated;

-- 2. RPC: accept_office_invite
CREATE OR REPLACE FUNCTION public.accept_office_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_user_id uuid := auth.uid();
BEGIN
  SELECT oi.* INTO v_invite
  FROM public.office_invites oi
  WHERE oi.token = p_token
    AND oi.accepted_at IS NULL
    AND oi.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite inválido ou expirado');
  END IF;

  IF v_invite.email IS NOT NULL THEN
    NULL;
  END IF;

  INSERT INTO public.office_members (office_id, user_id, role, is_active)
  VALUES (v_invite.office_id, v_user_id, v_invite.role, true)
  ON CONFLICT (office_id, user_id) DO NOTHING;

  UPDATE public.office_invites
  SET accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('success', true, 'office_id', v_invite.office_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_office_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_office_invite(text) TO authenticated;

COMMIT;

-- ============================================================
-- VALIDAÇÃO TÉCNICA — Bloco B
-- ============================================================

-- Deve retornar 0 linhas (token inexistente)
SELECT * FROM get_office_invite_public('token-inexistente');

-- Deve retornar {success: false, error: 'Convite inválido ou expirado'}
SELECT accept_office_invite('token-inexistente');

-- ============================================================
-- ROLLBACK — Bloco B (executar se necessário)
-- ============================================================
-- DROP FUNCTION IF EXISTS public.get_office_invite_public(text) CASCADE;
-- DROP FUNCTION IF EXISTS public.accept_office_invite(text) CASCADE;
