-- Ajustar lexos_create_initial_client_docs: kind é enum doc_kind (não text)
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
  -- 1) Busca o cliente
  select *
    into v_client
  from public.clients c
  where c.id = p_client_id;

  if not found then
    raise exception 'Cliente % não encontrado para criação de documentos iniciais', p_client_id;
  end if;

  -- 2) Para cada código de template (PROC, DECL, CONTRATO)
  foreach v_code in array v_codes loop

    -- Mapeia códigos do kit para enum doc_kind
    v_kind := case v_code
      when 'PROC' then 'PROCURACAO'::public.doc_kind
      when 'DECL' then 'DECLARACAO'::public.doc_kind
      when 'CONTRATO' then 'CONTRATO'::public.doc_kind
      else 'OUTRO'::public.doc_kind
    end;

    -- procura primeiro template do escritório; se não houver, usa global (office_id IS NULL)
    select t.*
      into v_template
    from public.document_templates t
    where t.code = v_code
      and (t.office_id = v_client.office_id or t.office_id is null)
    order by
      (t.office_id = v_client.office_id) desc,
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
      source_template_id,
      content,
      metadata,
      status,
      created_by
    )
    values (
      v_client.office_id,
      null,
      v_client.id,
      v_kind,
      v_template.name || ' - ' || v_client.full_name,
      v_template.id,
      v_template.content,
      jsonb_build_object('auto_generated', true, 'kit_inicial', true),
      'RASCUNHO',
      v_client.created_by
    );

  end loop;
end;
$$;