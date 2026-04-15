-- migration 20260320140000_fix_office_creation_trigger.sql

-- 1. Garante que a função de criação automática está correta
CREATE OR REPLACE FUNCTION public.on_auth_user_created_create_office()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id uuid;
  v_name text;
  v_has_pending_invite boolean;
BEGIN
  -- Evita duplicar se já houver membership
  IF EXISTS (
    SELECT 1 FROM public.office_members om WHERE om.user_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Se existe convite pendente para este email, NÃO criar escritório
  -- O usuário será adicionado ao escritório do convite pelo código frontend (acceptInvite)
  SELECT EXISTS (
    SELECT 1 FROM public.office_invites oi
    WHERE oi.email = NEW.email
      AND oi.accepted_at IS NULL
      AND oi.expires_at > NOW()
  ) INTO v_has_pending_invite;

  IF v_has_pending_invite THEN
    RETURN NEW;
  END IF;

  -- Criar escritório
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Meu Escritório');

  INSERT INTO public.offices (name, created_by)
  VALUES (v_name, NEW.id)
  RETURNING id INTO v_office_id;

  INSERT INTO public.office_members (office_id, user_id, role, is_active)
  VALUES (v_office_id, NEW.id, 'owner', true);

  INSERT INTO public.office_settings (office_id, plan_code)
  VALUES (v_office_id, 'free')
  ON CONFLICT (office_id) DO NOTHING;

  -- Inicializa passos de onboarding
  PERFORM public.init_office_onboarding_steps(v_office_id);

  RETURN NEW;
END;
$$;

-- 2. Ativa o gatilho na tabela auth.users (se não existir)
-- Nota: Em alguns ambientes Supabase, o esquema 'auth' pode exigir permissões especiais.
-- Este trigger garante que novos cadastros funcionem.
DROP TRIGGER IF EXISTS tr_on_auth_user_created_create_office ON auth.users;
CREATE TRIGGER tr_on_auth_user_created_create_office
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_created_create_office();

-- 3. Função RPC para o frontend garantir que o escritório existe (fallback para usuários existentes)
CREATE OR REPLACE FUNCTION public.ensure_personal_office()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_office_id uuid;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Verifica se já tem escritório
  SELECT office_id INTO v_office_id
  FROM public.office_members
  WHERE user_id = v_uid
    AND is_active = true
  LIMIT 1;

  IF v_office_id IS NOT NULL THEN
    RETURN v_office_id;
  END IF;

  -- 2. Se não tem, cria um (seguindo a mesma lógica do trigger)
  SELECT COALESCE(email, 'Meu Escritório') INTO v_name
  FROM auth.users
  WHERE id = v_uid;

  INSERT INTO public.offices (name, created_by)
  VALUES (v_name, v_uid)
  RETURNING id INTO v_office_id;

  INSERT INTO public.office_members (office_id, user_id, role, is_active)
  VALUES (v_office_id, v_uid, 'owner', true);

  INSERT INTO public.office_settings (office_id, plan_code)
  VALUES (v_office_id, 'free')
  ON CONFLICT (office_id) DO NOTHING;

  PERFORM public.init_office_onboarding_steps(v_office_id);

  RETURN v_office_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_personal_office() TO authenticated;
