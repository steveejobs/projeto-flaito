-- Atualiza a função trigger para diferenciar origem do cliente na timeline
CREATE OR REPLACE FUNCTION public.lexos_client_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  status_text TEXT;
BEGIN
  -- Define o texto baseado na origem
  IF NEW.source = 'public_capture' THEN
    status_text := 'Cliente cadastrado via captação online';
  ELSE
    status_text := 'Cliente criado';
  END IF;

  INSERT INTO public.client_events (
    office_id,
    client_id,
    event_type,
    new_status,
    payload,
    changed_by,
    changed_by_email,
    changed_at
  )
  VALUES (
    NEW.office_id,
    NEW.id,
    'CLIENT_CREATED',
    status_text,
    jsonb_build_object('source', COALESCE(NEW.source, 'unknown')),
    auth.uid(),
    public.get_auth_user_email(auth.uid()),
    NOW()
  );
  
  RETURN NEW;
END;
$$;

-- Atualiza registros existentes de captação online
UPDATE public.client_events
SET new_status = 'Cliente cadastrado via captação online'
WHERE event_type = 'CLIENT_CREATED'
  AND payload->>'source' = 'public_capture'
  AND new_status = 'Cliente criado';