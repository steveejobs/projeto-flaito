-- Create function to clone global/default templates to user's office
CREATE OR REPLACE FUNCTION clone_global_templates_to_my_office()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id UUID;
  v_user_id UUID;
  v_count INTEGER := 0;
  v_template RECORD;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user's office
  SELECT office_id INTO v_office_id
  FROM office_members
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'User has no active office';
  END IF;

  -- Clone default templates that don't exist yet in user's office
  FOR v_template IN
    SELECT dt.name, dt.category, dt.code, dt.content
    FROM document_templates dt
    WHERE dt.is_default = true
      AND NOT EXISTS (
        SELECT 1 FROM document_templates ot
        WHERE ot.office_id = v_office_id
          AND (ot.code = dt.code OR ot.name = dt.name)
      )
  LOOP
    INSERT INTO document_templates (office_id, name, category, code, content, is_default, created_by)
    VALUES (v_office_id, v_template.name, v_template.category, v_template.code, v_template.content, false, v_user_id);
    
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;