-- Substitui template CONTRATO do escritório pelo template global correto
UPDATE document_templates
SET content = (
  SELECT content FROM document_templates 
  WHERE code = 'CONTRATO' AND office_id IS NULL AND is_active = true
  LIMIT 1
),
updated_at = NOW()
WHERE id = '570895c2-5ba9-4fd2-a212-82febcc6e2f9';