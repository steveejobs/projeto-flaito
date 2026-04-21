-- Create function to initialize onboarding steps for an office
CREATE OR REPLACE FUNCTION public.init_office_onboarding_steps(p_office_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.office_onboarding_steps (office_id, step_key, completed)
  VALUES 
    (p_office_id, 'office_info', false),
    (p_office_id, 'first_client', false),
    (p_office_id, 'first_case', false),
    (p_office_id, 'first_template', false)
  ON CONFLICT (office_id, step_key) DO NOTHING;
END;
$function$;

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'office_onboarding_steps_office_step_unique'
  ) THEN
    ALTER TABLE public.office_onboarding_steps 
    ADD CONSTRAINT office_onboarding_steps_office_step_unique 
    UNIQUE (office_id, step_key);
  END IF;
END $$;

-- Initialize onboarding steps for all existing offices that don't have them yet
INSERT INTO public.office_onboarding_steps (office_id, step_key, completed)
SELECT o.id, s.step_key, false
FROM public.offices o
CROSS JOIN (VALUES ('office_info'), ('first_client'), ('first_case'), ('first_template')) AS s(step_key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.office_onboarding_steps os 
  WHERE os.office_id = o.id AND os.step_key = s.step_key
)
ON CONFLICT DO NOTHING;

-- Update the on_auth_user_created_create_office function to also init onboarding steps
CREATE OR REPLACE FUNCTION public.on_auth_user_created_create_office()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
  DECLARE
    v_office_id uuid;
    v_name text;
  BEGIN
    -- evita duplicar se já houver membership
    IF EXISTS (
      SELECT 1 FROM public.office_members om WHERE om.user_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

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
  $function$;