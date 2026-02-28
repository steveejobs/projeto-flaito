-- Update CONTRATO template to use dynamic signature dimensions
UPDATE document_templates
SET content = REPLACE(
  content,
  '.office-signature-img { max-height: 60px; max-width: 150px; object-fit: contain; display: block; margin: 0 auto 8px; }',
  '.office-signature-img { max-height: {{office.signature_max_height}}; max-width: {{office.signature_max_width}}; object-fit: contain; display: block; margin: 0 auto 8px; }'
)
WHERE code = 'CONTRATO' 
  AND is_active = true
  AND content LIKE '%.office-signature-img { max-height: 60px; max-width: 150px;%';

-- Also update PROC template if it exists with fixed signature dimensions
UPDATE document_templates
SET content = REPLACE(
  content,
  '.office-signature-img { max-height: 60px; max-width: 150px;',
  '.office-signature-img { max-height: {{office.signature_max_height}}; max-width: {{office.signature_max_width}};'
)
WHERE code = 'PROC' 
  AND is_active = true
  AND content LIKE '%.office-signature-img { max-height: 60px; max-width: 150px;%';

-- Also update DECL template if it exists with fixed signature dimensions
UPDATE document_templates
SET content = REPLACE(
  content,
  '.office-signature-img { max-height: 60px; max-width: 150px;',
  '.office-signature-img { max-height: {{office.signature_max_height}}; max-width: {{office.signature_max_width}};'
)
WHERE code = 'DECL' 
  AND is_active = true
  AND content LIKE '%.office-signature-img { max-height: 60px; max-width: 150px;%';