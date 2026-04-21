-- Fix: documentos sem case_id (ex.: kit inicial do cliente) não devem gerar eventos em document_events (case_id NOT NULL)
CREATE OR REPLACE FUNCTION public.log_document_event(
  p_document_id uuid,
  p_event_type text,
  p_message text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
declare
  v_office uuid;
  v_case uuid;
begin
  select d.office_id, d.case_id into v_office, v_case
  from public.documents d
  where d.id = p_document_id;

  -- Se não achou documento ou não tem office, não loga
  if v_office is null then
    return;
  end if;

  -- Importante: documentos "de cliente" podem não ter case_id; não registramos em document_events
  if v_case is null then
    return;
  end if;

  insert into public.document_events (
    office_id, case_id, document_id, event_type, message, metadata, actor_user_id
  ) values (
    v_office, v_case, p_document_id, p_event_type, p_message, coalesce(p_metadata,'{}'::jsonb), auth.uid()
  );
end;
$$;