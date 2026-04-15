-- ============================================================
-- BLOCO D — TEMPLATES / DOCUMENTOS
-- Executar no: Supabase SQL Editor
-- Projeto: ccvbosbjtlxewqybvwqj
-- Objetos: render_template_preview, vw_client_signatures,
--          hard_delete_client
-- Dependências externas: document_templates, clients,
--          e_signatures, office_members (existem)
-- ============================================================

BEGIN;

-- 1. VIEW: vw_client_signatures
CREATE OR REPLACE VIEW public.vw_client_signatures AS
SELECT
  cl.id AS client_id,
  cl.office_id,
  cl.full_name,
  cl.cpf,
  es.id AS signature_id,
  es.signature_base64,
  es.created_at AS signed_at,
  es.created_by AS signed_by
FROM public.clients cl
LEFT JOIN public.e_signatures es ON es.client_id = cl.id
WHERE cl.deleted_at IS NULL;

-- 2. RPC: render_template_preview
CREATE OR REPLACE FUNCTION public.render_template_preview(
  p_template_id uuid,
  p_data jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template_content text;
  v_result text;
  v_key text;
  v_value text;
BEGIN
  SELECT content INTO v_template_content
  FROM public.document_templates
  WHERE id = p_template_id
  LIMIT 1;

  IF v_template_content IS NULL THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;

  v_result := v_template_content;

  FOR v_key, v_value IN
    SELECT key, value::text
    FROM jsonb_each_text(p_data)
  LOOP
    v_result := replace(v_result, '{{' || v_key || '}}', v_value);
  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.render_template_preview(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.render_template_preview(uuid, jsonb) TO authenticated;

-- 3. RPC: hard_delete_client
CREATE OR REPLACE FUNCTION public.hard_delete_client(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_office_id uuid;
  v_user_id uuid := auth.uid();
  v_role text;
BEGIN
  SELECT office_id INTO v_office_id
  FROM public.clients
  WHERE id = p_client_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  SELECT role::text INTO v_role
  FROM public.office_members
  WHERE user_id = v_user_id AND office_id = v_office_id AND is_active = true;

  IF v_role NOT IN ('OWNER', 'ADMIN') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permissão negada');
  END IF;

  DELETE FROM public.clients WHERE id = p_client_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.hard_delete_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hard_delete_client(uuid) TO authenticated;

COMMIT;

-- ============================================================
-- VALIDAÇÃO TÉCNICA — Bloco D
-- ============================================================

-- Deve funcionar (retorna 0 ou mais linhas)
SELECT * FROM vw_client_signatures LIMIT 1;

-- Deve lançar exceção (template inexistente) — comportamento esperado
-- SELECT render_template_preview('00000000-0000-0000-0000-000000000000', '{}'::jsonb);

-- ============================================================
-- ROLLBACK — Bloco D (executar se necessário)
-- ============================================================
-- DROP FUNCTION IF EXISTS public.hard_delete_client(uuid) CASCADE;
-- DROP FUNCTION IF EXISTS public.render_template_preview(uuid, jsonb) CASCADE;
-- DROP VIEW IF EXISTS public.vw_client_signatures CASCADE;
