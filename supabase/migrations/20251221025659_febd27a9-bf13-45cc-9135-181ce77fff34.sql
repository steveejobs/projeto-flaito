-- Fix: generated_docs.source_template_id referencia public.templates(id),
-- mas o kit usa public.document_templates. Guardamos o ID em metadata e deixamos source_template_id NULL.
CREATE OR REPLACE FUNCTION public.lexos_create_initial_client_docs(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_client    public.clients%rowtype;
  v_template  public.document_templates%rowtype;
  v_code      text;
  v_codes     text[] := array['PROC', 'DECL', 'CONTRATO'];
  v_kind      public.doc_kind;
begin
  select *
    into v_client
  from public.clients c
  where c.id = p_client_id;

  if not found then
    raise exception 'Cliente % não encontrado para criação de documentos iniciais', p_client_id;
  end if;

  foreach v_code in array v_codes loop

    v_kind := case v_code
      when 'PROC' then 'PROCURACAO'::public.doc_kind
      when 'DECL' then 'DECLARACAO'::public.doc_kind
      when 'CONTRATO' then 'CONTRATO'::public.doc_kind
      else 'OUTRO'::public.doc_kind
    end;

    select t.*
      into v_template
    from public.document_templates t
    where t.code = v_code
      and (t.office_id = v_client.office_id or t.office_id is null)
    order by (t.office_id = v_client.office_id) desc,
             t.created_at desc
    limit 1;

    if not found then
      continue;
    end if;

    insert into public.generated_docs (
      office_id,
      case_id,
      client_id,
      kind,
      title,
      version,
      content,
      source_template_id,
      metadata,
      created_by,
      status
    )
    values (
      v_client.office_id,
      null,
      v_client.id,
      v_kind,
      v_template.name || ' - ' || v_client.full_name,
      1,
      v_template.content,
      null,
      jsonb_build_object(
        'auto_generated', true,
        'kit_inicial', true,
        'document_template_id', v_template.id,
        'document_template_code', v_code
      ),
      v_client.created_by,
      'RASCUNHO'
    );

  end loop;
end;
$$;