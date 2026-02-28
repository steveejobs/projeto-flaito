-- RPC function to accept an office invite (SECURITY DEFINER for atomic operation)
CREATE OR REPLACE FUNCTION public.accept_office_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_user_id uuid;
  v_existing_member uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Find the invite
  SELECT oi.*, o.name as office_name
  INTO v_invite
  FROM office_invites oi
  JOIN offices o ON o.id = oi.office_id
  WHERE oi.token = p_token;
  
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite não encontrado');
  END IF;
  
  -- Check if already accepted
  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite já foi aceito');
  END IF;
  
  -- Check if expired
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite expirado');
  END IF;
  
  -- Check if user is already a member
  SELECT id INTO v_existing_member
  FROM office_members
  WHERE office_id = v_invite.office_id AND user_id = v_user_id;
  
  IF v_existing_member IS NOT NULL THEN
    -- User already member, just mark invite as accepted
    UPDATE office_invites
    SET accepted_at = now(), accepted_by = v_user_id
    WHERE id = v_invite.id;
    
    RETURN jsonb_build_object('success', true, 'already_member', true, 'office_name', v_invite.office_name);
  END IF;
  
  -- Add user as member
  INSERT INTO office_members (office_id, user_id, role, is_active, joined_at)
  VALUES (v_invite.office_id, v_user_id, v_invite.role, true, now());
  
  -- Mark invite as accepted
  UPDATE office_invites
  SET accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invite.id;
  
  RETURN jsonb_build_object('success', true, 'office_name', v_invite.office_name, 'role', v_invite.role);
END;
$$;

-- Fix the current user: bandeira.rgabriel@gmail.com
DO $$
DECLARE
  v_user_id uuid;
  v_invite record;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bandeira.rgabriel@gmail.com';
  
  IF v_user_id IS NOT NULL THEN
    -- Get the pending invite
    SELECT * INTO v_invite FROM office_invites WHERE email = 'bandeira.rgabriel@gmail.com' AND accepted_at IS NULL LIMIT 1;
    
    IF v_invite IS NOT NULL THEN
      -- Check if already member
      IF NOT EXISTS (SELECT 1 FROM office_members WHERE office_id = v_invite.office_id AND user_id = v_user_id) THEN
        -- Add as member
        INSERT INTO office_members (office_id, user_id, role, is_active, joined_at)
        VALUES (v_invite.office_id, v_user_id, v_invite.role, true, now());
      END IF;
      
      -- Mark invite as accepted
      UPDATE office_invites SET accepted_at = now(), accepted_by = v_user_id WHERE id = v_invite.id;
    END IF;
  END IF;
END;
$$;