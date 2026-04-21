-- Migration: 20260413004500_fix_rpc_is_personal.sql
-- Objetivo: Resolver o Erro 400 definitivo removendo a referência à coluna inexistente 'is_personal'

CREATE OR REPLACE FUNCTION public.ensure_personal_office()
RETURNS uuid 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_office_id uuid;
  v_slug text;
BEGIN
  -- 1. Verifica se o usuário está autenticado
  IF v_user_id IS NULL THEN 
    RETURN NULL; 
  END IF;

  -- 2. Verifica se já existe vínculo ativo para este usuário
  SELECT om.office_id INTO v_office_id 
  FROM public.office_members om
  WHERE om.user_id = v_user_id AND om.is_active = true 
  LIMIT 1;
  
  IF v_office_id IS NOT NULL THEN 
    RETURN v_office_id; 
  END IF;

  -- 3. Gera um slug único baseado no ID do usuário
  v_slug := 'personal-' || substring(v_user_id::text from 1 for 8);

  -- 4. Criação do escritório (Rigor de Schema)
  -- NOTA: A coluna 'is_personal' NÃO existe fisicamente, deve ir para o 'metadata' JSONB
  INSERT INTO public.offices (
    name, 
    slug, 
    office_type, 
    metadata
  ) VALUES (
    'Escritório Pessoal', 
    v_slug,
    'LEGAL', 
    jsonb_build_object(
      'is_personal', true,
      'created_via', 'onboarding_wizard',
      'created_at', now()
    )
  ) 
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_office_id;

  -- 5. Vincula o usuário como OWNER (Dono)
  INSERT INTO public.office_members (office_id, user_id, role, is_active) 
  VALUES (v_office_id, v_user_id, 'OWNER', true)
  ON CONFLICT (office_id, user_id) DO UPDATE SET is_active = true;

  RETURN v_office_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_personal_office() TO authenticated;

-- Forçar recarga imediata do cache do PostgREST
NOTIFY pgrst, 'reload schema';
