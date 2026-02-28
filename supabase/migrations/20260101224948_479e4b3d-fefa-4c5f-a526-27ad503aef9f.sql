-- Atualiza templates PROC, DECL e CONTRATO para usar tamanho dinâmico do logo
-- baseado nas configurações do escritório (office.logo_max_height e office.logo_max_width)

-- Template PROC (Procuração)
UPDATE document_templates
SET content = REPLACE(
  REPLACE(content, 
    'max-height: 60px; max-width: 150px;', 
    'max-height: {{office.logo_max_height}}; max-width: {{office.logo_max_width}};'
  ),
  'max-height:60px;max-width:150px;',
  'max-height: {{office.logo_max_height}}; max-width: {{office.logo_max_width}};'
)
WHERE code = 'PROC' AND content LIKE '%max-height: 60px%';

-- Template DECL (Declaração)
UPDATE document_templates
SET content = REPLACE(
  REPLACE(content, 
    'max-height: 60px; max-width: 150px;', 
    'max-height: {{office.logo_max_height}}; max-width: {{office.logo_max_width}};'
  ),
  'max-height:60px;max-width:150px;',
  'max-height: {{office.logo_max_height}}; max-width: {{office.logo_max_width}};'
)
WHERE code = 'DECL' AND content LIKE '%max-height: 60px%';

-- Template CONTRATO
UPDATE document_templates
SET content = REPLACE(
  REPLACE(content, 
    'max-height: 60px; max-width: 150px;', 
    'max-height: {{office.logo_max_height}}; max-width: {{office.logo_max_width}};'
  ),
  'max-height:60px;max-width:150px;',
  'max-height: {{office.logo_max_height}}; max-width: {{office.logo_max_width}};'
)
WHERE code = 'CONTRATO' AND content LIKE '%max-height: 60px%';