-- Atualiza template PROC para assinatura sobre a linha
UPDATE public.document_templates
SET content = REPLACE(
  REPLACE(content, 
    'margin: 0 auto 8px;', 
    'margin: 0 auto -20px; position: relative; z-index: 1;'),
  'margin-top: 60px;',
  'margin-top: 0;'
)
WHERE code = 'PROC' AND office_id IS NULL;

-- Atualiza template DECL para assinatura sobre a linha
UPDATE public.document_templates
SET content = REPLACE(
  REPLACE(content, 
    'margin: 0 auto 8px;', 
    'margin: 0 auto -20px; position: relative; z-index: 1;'),
  'margin-top: 60px;',
  'margin-top: 0;'
)
WHERE code = 'DECL' AND office_id IS NULL;

-- Atualiza template CONTRATO para assinatura sobre a linha
UPDATE public.document_templates
SET content = REPLACE(
  REPLACE(content, 
    'margin: 0 auto 8px;', 
    'margin: 0 auto -20px; position: relative; z-index: 1;'),
  'margin-top: 60px;',
  'margin-top: 0;'
)
WHERE code = 'CONTRATO' AND office_id IS NULL;

-- Atualiza também templates específicos de escritório (clones)
UPDATE public.document_templates
SET content = REPLACE(
  REPLACE(content, 
    'margin: 0 auto 8px;', 
    'margin: 0 auto -20px; position: relative; z-index: 1;'),
  'margin-top: 60px;',
  'margin-top: 0;'
)
WHERE code IN ('PROC', 'DECL', 'CONTRATO') AND office_id IS NOT NULL;