-- Corrigir função lexos_create_initial_client_docs para usar a tabela document_templates
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

    -- procura primeiro template do escritório; se não houver, usa global (office_id IS NULL)
    select t.*
      into v_template
    from public.document_templates t
    where t.code = v_code
      and (t.office_id = v_client.office_id or t.office_id is null)
    order by
      (t.office_id = v_client.office_id) desc, -- prioriza do escritório
      t.created_at desc
    limit 1;

    -- se não encontrou template para esse código, passa pro próximo
    if not found then
      continue;
    end if;

    -- 3) Cria um registro em generated_docs vinculado ao CLIENTE (sem caso)
    insert into public.generated_docs (
      office_id,
      case_id,
      client_id,
      title,
      source_template_id,
      content,
      metadata,
      status,
      created_by
    )
    values (
      v_client.office_id,
      null, -- sem caso
      v_client.id,
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