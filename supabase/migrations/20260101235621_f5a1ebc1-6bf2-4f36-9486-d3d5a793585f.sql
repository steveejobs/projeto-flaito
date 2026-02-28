-- Restaurar template CONTRATO do escritório para versão 6 (29/12/2025 21:01)
UPDATE document_templates
SET content = (
  SELECT content FROM document_template_versions 
  WHERE id = '6a179aa1-312a-4286-898e-8fab52abc3ac'
),
updated_at = NOW()
WHERE id = '570895c2-5ba9-4fd2-a212-82febcc6e2f9';

-- Restaurar template CONTRATO global para versão 4 (30/12/2025 03:36)
UPDATE document_templates
SET content = (
  SELECT content FROM document_template_versions 
  WHERE id = '606c7fd7-bfc7-46ec-bfde-2ac4ad3d2c14'
),
updated_at = NOW()
WHERE id = '7fe9b601-5c16-4a7f-a30f-5c6a42b4ff7d';