-- Fix triggers to capture user information in client_events

CREATE OR REPLACE FUNCTION public.lexos_client_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.client_events (
    office_id,
    client_id,
    event_type,
    new_status,
    payload,
    changed_by,
    changed_by_email,
    changed_at
  )
  values (
    new.office_id,
    new.id,
    'CLIENT_CREATED',
    'Cliente criado',
    jsonb_build_object('source', coalesce(new.source, 'unknown')),
    auth.uid(),
    public.get_auth_user_email(auth.uid()),
    now()
  );
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.lexos_client_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.client_events (
    office_id,
    client_id,
    event_type,
    new_status,
    payload,
    changed_by,
    changed_by_email,
    changed_at
  )
  values (
    new.office_id,
    new.id,
    'CLIENT_UPDATED',
    'Cliente atualizado',
    '{}'::jsonb,
    auth.uid(),
    public.get_auth_user_email(auth.uid()),
    now()
  );
  return new;
end;
$$;