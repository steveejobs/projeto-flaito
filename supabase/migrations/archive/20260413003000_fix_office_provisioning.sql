-- Migration: 20260413003000_fix_office_provisioning.sql
-- Objetivo: Destravar o Wizard corrigindo o INSERT de escritórios pessoais

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
  -- 1. Verifica se já existe vínculo ativo para este usuário
  SELECT om.office_id INTO v_office_id 
  FROM public.office_members om
  WHERE om.user_id = v_user_id AND om.is_active = true 
  LIMIT 1;
  
  IF v_office_id IS NOT NULL THEN 
    RETURN v_office_id; 
  END IF;

  -- 2. Gera um slug único baseado no ID do usuário
  v_slug := 'personal-' || substring(v_user_id::text from 1 for 8);

  -- 3. Criação do escritório com todos os campos obrigatórios (Rigor de Schema)
  INSERT INTO public.offices (
    name, 
    slug, 
    office_type, 
    is_personal,
    metadata
  ) VALUES (
    'Uso Pessoal', 
    v_slug,
    'LEGAL', -- Default seguro para destravar o fluxo
    true,
    '{"created_via": "onboarding_wizard", "module": "JURIDICO"}'::jsonb
  ) 
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_office_id;

  -- 4. Vincula o usuário como OWNER (Dono)
  INSERT INTO public.office_members (office_id, user_id, role, is_active) 
  VALUES (v_office_id, v_user_id, 'OWNER', true)
  ON CONFLICT (office_id, user_id) DO UPDATE SET is_active = true;

  RETURN v_office_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_personal_office() TO authenticated;

-- Forçar recarga para o PostgREST reconhecer a nova lógica
NOTIFY pgrst, 'reload schema';
