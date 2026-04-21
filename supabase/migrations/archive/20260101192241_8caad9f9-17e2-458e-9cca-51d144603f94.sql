CREATE OR REPLACE VIEW public.vw_documents_inbox AS
SELECT 
    d.id,
    d.office_id,
    d.case_id,
    d.kind,
    d.filename,
    d.mime_type,
    d.file_size,
    d.storage_bucket,
    d.storage_path,
    d.extracted_text,
    d.metadata,
    d.uploaded_by,
    d.uploaded_at,
    d.deleted_at,
    d.deleted_by,
    d.deleted_reason,
    d.type_id,
    d.signed_at,
    d.signed_by,
    d.is_locked,
    d.locked_at,
    d.locked_by,
    d.status,
    d.reading_status,
    d.extraction_report,
    d.extracted_text_chars,
    d.extracted_pages_total,
    d.extracted_pages_with_text,
    d.extracted_coverage_ratio,
    d.extraction_method,
    d.extraction_updated_at,
    d.is_image_pdf,
    c.full_name AS client_name,
    (d.metadata ->> 'template_code') AS template_code
FROM documents d
LEFT JOIN clients c ON c.id = (d.metadata ->> 'client_id')::uuid
WHERE d.deleted_at IS NULL
  AND d.case_id IS NULL
  AND COALESCE(d.metadata->>'scope', '') != 'CLIENT_KIT'
  AND COALESCE(d.metadata->>'source', '') != 'generated_docs_legacy';