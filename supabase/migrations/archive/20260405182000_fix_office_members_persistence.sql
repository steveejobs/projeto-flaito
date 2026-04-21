-- Migration: 20260405182000_fix_office_members_persistence.sql
-- Objetivo: Garantir que emails e nomes dos membros sejam persistidos na tabela office_members por motivos de visibilidade e performance.

-- 1. Atualizar a função do Gatilho de Autocriação de Escritório
CREATE OR REPLACE FUNCTION public.on_auth_user_created_create_office()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id uuid;
  v_name text;
  v_user_full_name text;
  v_has_pending_invite boolean;
BEGIN
  -- Evita duplicar se já houver membership
  IF EXISTS (
    SELECT 1 FROM public.office_members om WHERE om.user_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Se existe convite pendente para este email, NÃO criar escritório
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
  v_user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_name := COALESCE(v_user_full_name, 'Meu Escritório');

  INSERT INTO public.offices (name, created_by)
  VALUES (v_name, NEW.id)
  RETURNING id INTO v_office_id;

  -- Persistir email e nome no office_members
  INSERT INTO public.office_members (office_id, user_id, role, is_active, email, full_name)
  VALUES (v_office_id, NEW.id, 'owner', true, NEW.email, v_user_full_name);

  INSERT INTO public.office_settings (office_id, plan_code)
  VALUES (v_office_id, 'free')
  ON CONFLICT (office_id) DO NOTHING;

  PERFORM public.init_office_onboarding_steps(v_office_id);

  RETURN NEW;
END;
$$;

-- 2. Atualizar a RPC ensure_personal_office()
CREATE OR REPLACE FUNCTION public.ensure_personal_office()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_office_id uuid;
  v_name text;
  v_email text;
  v_full_name text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT office_id INTO v_office_id
  FROM public.office_members
  WHERE user_id = v_uid
    AND is_active = true
  LIMIT 1;

  IF v_office_id IS NOT NULL THEN
    RETURN v_office_id;
  END IF;

  -- Se não tem, cria um
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email)
  INTO v_email, v_full_name
  FROM auth.users
  WHERE id = v_uid;

  v_name := COALESCE(v_full_name, 'Meu Escritório');

  INSERT INTO public.offices (name, created_by)
  VALUES (v_name, v_uid)
  RETURNING id INTO v_office_id;

  -- Persistir email e nome no office_members
  INSERT INTO public.office_members (office_id, user_id, role, is_active, email, full_name)
  VALUES (v_office_id, v_uid, 'owner', true, v_email, v_full_name);

  INSERT INTO public.office_settings (office_id, plan_code)
  VALUES (v_office_id, 'free')
  ON CONFLICT (office_id) DO NOTHING;

  PERFORM public.init_office_onboarding_steps(v_office_id);

  RETURN v_office_id;
END;
$$;

-- 3. Atualizar a RPC accept_office_invite()
CREATE OR REPLACE FUNCTION public.accept_office_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invite record;
  v_user_id uuid;
  v_user_email text;
  v_user_full_name text;
  v_existing_member uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT oi.*, o.name as office_name
    INTO v_invite
  FROM office_invites oi
  JOIN offices o ON o.id = oi.office_id
  WHERE oi.token = p_token;

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite não encontrado');
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite já foi aceito');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite expirado');
  END IF;

  -- Obter dados do novo membro
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email)
  INTO v_user_email, v_user_full_name
  FROM auth.users
  WHERE id = v_user_id;

  SELECT id INTO v_existing_member
  FROM office_members
  WHERE office_id = v_invite.office_id AND user_id = v_user_id;

  IF v_existing_member IS NOT NULL THEN
    -- Garantir que email e nome estão preenchidos mesmo se já era membro
    UPDATE office_members
    SET email = v_user_email, full_name = v_user_full_name
    WHERE id = v_existing_member AND (email IS NULL OR full_name IS NULL);

    UPDATE office_invites
    SET accepted_at = now(), accepted_by = v_user_id
    WHERE id = v_invite.id;

    RETURN jsonb_build_object('success', true, 'already_member', true, 'office_name', v_invite.office_name);
  END IF;

  -- Inserir membro com email e nome
  INSERT INTO office_members (office_id, user_id, role, is_active, email, full_name)
  VALUES (v_invite.office_id, v_user_id, v_invite.role, true, v_user_email, v_user_full_name);

  UPDATE office_invites
  SET accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('success', true, 'office_name', v_invite.office_name, 'role', v_invite.role);
END;
$$;

-- 4. Backfill de Dados Existentes
-- Sincroniza emails e nomes para registros que ainda estão vazios
UPDATE public.office_members om
SET 
  email = u.email,
  full_name = COALESCE(u.raw_user_meta_data->>'full_name', u.email)
FROM auth.users u
WHERE u.id = om.user_id
  AND (om.email IS NULL OR om.full_name IS NULL);

COMMENT ON COLUMN public.office_members.email IS 'Cópia do email do auth.users para visibilidade interna do escritório.';
COMMENT ON COLUMN public.office_members.full_name IS 'Cópia do nome do auth.users para visibilidade interna do escritório.';
