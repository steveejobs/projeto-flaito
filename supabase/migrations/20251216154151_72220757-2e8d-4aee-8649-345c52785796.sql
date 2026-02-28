-- Fix the trigger to use created_by from the generated_docs record instead of auth.uid()
-- This allows the trigger to work when called from Edge Functions using Service Role

CREATE OR REPLACE FUNCTION public.on_generated_docs_create_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  v_doc_id uuid;
begin
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
      new.case_id,
      new.kind,
      new.title || '.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'lexos',
      new.office_id::text || '/' || new.id::text || '/generated.docx',
      new.created_by,  -- Use created_by from the generated_docs record instead of auth.uid()
      now(),
      jsonb_build_object('source','generated_docs','generated_doc_id',new.id)
    )
    returning id into v_doc_id;

    update public.generated_docs
    set document_id = v_doc_id
    where id = new.id;
  end if;

  return new;
end;
$function$;