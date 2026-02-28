-- Fix: Skip office creation for users who have a pending invite
CREATE OR REPLACE FUNCTION on_auth_user_created_create_office()
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

  -- NOVA VERIFICAÇÃO: Se existe convite pendente para este email, NÃO criar escritório
  -- O usuário será adicionado ao escritório do convite pelo código frontend (acceptInvite)
  SELECT EXISTS (
    SELECT 1 FROM public.office_invites oi
    WHERE oi.email = NEW.email
      AND oi.accepted_at IS NULL
      AND oi.expires_at > NOW()
  ) INTO v_has_pending_invite;

  IF v_has_pending_invite THEN
    -- Usuário veio de convite, não criar escritório próprio
    RETURN NEW;
  END IF;

  -- Criar escritório apenas para usuários que se cadastraram sozinhos
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Meu Escritório');

  INSERT INTO public.offices (name, created_by)
  VALUES (v_name, NEW.id)
  RETURNING id INTO v_office_id;

  INSERT INTO public.office_members (office_id, user_id, role, is_active)
  VALUES (v_office_id, NEW.id, 'owner', true);

  INSERT INTO public.office_settings (office_id, plan_code)
  VALUES (v_office_id, 'free')
  ON CONFLICT (office_id) DO NOTHING;

  -- Initialize onboarding steps for new office
  PERFORM public.init_office_onboarding_steps(v_office_id);

  RETURN NEW;
END;
$$;