-- Fix: Make documents_set_default_type_id SECURITY DEFINER to bypass RLS when creating default document type
CREATE OR REPLACE FUNCTION public.documents_set_default_type_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_type uuid;
begin
  if new.type_id is null then
    select id into v_type
    from public.document_types
    where office_id = new.office_id
      and name = 'ANEXO (padrão)'
    limit 1;

    if v_type is null then
      insert into public.document_types (office_id, name)
      values (new.office_id, 'ANEXO (padrão)')
      returning id into v_type;
    end if;

    new.type_id := v_type;
  end if;

  return new;
end;
$function$;