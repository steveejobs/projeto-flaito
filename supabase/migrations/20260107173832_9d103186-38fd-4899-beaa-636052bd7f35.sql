-- Vincular manualmente o usuário bandeira.rgabriel@gmail.com ao escritório
DO $$
DECLARE
  v_user_id uuid;
  v_office_id uuid;
  v_role text;
BEGIN
  -- Get user id
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bandeira.rgabriel@gmail.com' LIMIT 1;
  
  -- Get invite details
  SELECT office_id, role INTO v_office_id, v_role 
  FROM public.office_invites 
  WHERE email = 'bandeira.rgabriel@gmail.com' AND accepted_at IS NULL 
  LIMIT 1;
  
  -- Insert member if not exists
  IF v_user_id IS NOT NULL AND v_office_id IS NOT NULL THEN
    INSERT INTO public.office_members (office_id, user_id, role, is_active)
    VALUES (v_office_id, v_user_id, v_role, true)
    ON CONFLICT (office_id, user_id) DO NOTHING;
    
    -- Mark invite as accepted
    UPDATE public.office_invites 
    SET accepted_at = now(), accepted_by = v_user_id 
    WHERE email = 'bandeira.rgabriel@gmail.com' AND accepted_at IS NULL;
  END IF;
END $$;