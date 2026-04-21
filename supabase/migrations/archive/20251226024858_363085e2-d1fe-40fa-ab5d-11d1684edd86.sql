
-- Corrige o trigger para usar a tabela correta e permitir case_id NULL
CREATE OR REPLACE FUNCTION public.on_generated_docs_create_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_doc_id uuid;
begin
  -- Só cria documento físico se document_id for null e for um dos tipos do kit
  if new.document_id is null
     and new.kind in ('PROCURACAO','DECLARACAO','CONTRATO') then

    insert into public.documents (
      office_id,
      case_id,
      kind,
      filename,
      mime_type,
      storage_bucket,
      storage_path,
      uploaded_by,
      uploaded_at,
      metadata
    )
    values (
      new.office_id,
      new.case_id,  -- Pode ser NULL para documentos de cliente
      new.kind,
      new.title || '.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'lexos',
      new.office_id::text || '/' || new.id::text || '/generated.docx',
      new.created_by,
      now(),
      jsonb_build_object(
        'source', 'generated_docs_legacy',
        'generated_doc_id', new.id,
        'client_id', new.client_id
      )
    )
    returning id into v_doc_id;

    -- CORREÇÃO: Atualiza a tabela real, não a view
    update public.generated_docs_legacy
    set document_id = v_doc_id
    where id = new.id;
  end if;

  return new;
end;
$$;