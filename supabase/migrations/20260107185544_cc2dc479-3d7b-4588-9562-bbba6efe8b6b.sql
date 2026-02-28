-- Fix accept_office_invite RPC: remove non-existent 'joined_at' column from INSERT
CREATE OR REPLACE FUNCTION public.accept_office_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite record;
  v_user_id uuid;
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

  SELECT id INTO v_existing_member
  FROM office_members
  WHERE office_id = v_invite.office_id AND user_id = v_user_id;

  IF v_existing_member IS NOT NULL THEN
    UPDATE office_invites
    SET accepted_at = now(), accepted_by = v_user_id
    WHERE id = v_invite.id;

    RETURN jsonb_build_object('success', true, 'already_member', true, 'office_name', v_invite.office_name);
  END IF;

  -- Fixed: removed 'joined_at' column (doesn't exist), using only existing columns
  INSERT INTO office_members (office_id, user_id, role, is_active)
  VALUES (v_invite.office_id, v_user_id, v_invite.role, true);

  UPDATE office_invites
  SET accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('success', true, 'office_name', v_invite.office_name, 'role', v_invite.role);
END;
$$;