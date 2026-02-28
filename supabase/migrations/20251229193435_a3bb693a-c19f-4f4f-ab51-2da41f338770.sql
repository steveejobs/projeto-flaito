-- Recriar a view vw_client_kit_latest_files usando metadata->>'template_code' ao invés de pattern matching no nome
DROP VIEW IF EXISTS public.vw_client_kit_latest_files;

CREATE VIEW public.vw_client_kit_latest_files AS
WITH classified AS (
  SELECT 
    cf.id,
    cf.office_id,
    cf.client_id,
    cf.case_id,
    cf.kind,
    cf.description,
    cf.storage_bucket,
    cf.storage_path,
    cf.file_name,
    cf.mime_type,
    cf.file_size,
    cf.uploaded_at,
    cf.uploaded_by,
    cf.metadata,
    -- Prioriza metadata->>'template_code', fallback para pattern matching
    COALESCE(
      cf.metadata->>'template_code',
      CASE
        WHEN cf.file_name ~~ 'proc_%' THEN 'PROC'
        WHEN cf.file_name ~~ 'decl_%' THEN 'DECL'
        WHEN cf.file_name ~~ 'contrato_%' THEN 'CONTRATO'
        ELSE NULL
      END
    ) AS kit_type,
    -- Busca status do generated_docs_legacy correspondente
    (
      SELECT gdl.status 
      FROM generated_docs_legacy gdl 
      WHERE gdl.metadata->>'client_file_id' = cf.id::text
      LIMIT 1
    ) AS status
  FROM client_files cf
  WHERE cf.kind IN ('KIT_PROCURACAO', 'KIT_DECLARACAO', 'KIT_CONTRATO')
),
ranked AS (
  SELECT 
    c.*,
    row_number() OVER (
      PARTITION BY c.client_id, c.kit_type 
      ORDER BY c.uploaded_at DESC, c.id DESC
    ) AS rn
  FROM classified c
  WHERE c.kit_type IS NOT NULL
)
SELECT 
  id,
  office_id,
  client_id,
  case_id,
  kind,
  description,
  storage_bucket,
  storage_path,
  file_name,
  mime_type,
  file_size,
  uploaded_at,
  uploaded_by,
  metadata,
  kit_type,
  status
FROM ranked
WHERE rn = 1;