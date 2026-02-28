-- Remove linha de assinatura do template PROC
UPDATE public.document_templates
SET content = REPLACE(
  REPLACE(content, 
    'border-top: 1px solid #333; width: 300px;', 
    'width: 300px;'),
  'margin: 0 auto -20px;',
  'margin: 0 auto;'
)
WHERE code = 'PROC' AND office_id IS NULL;

-- Remove linha de assinatura do template DECL
UPDATE public.document_templates
SET content = REPLACE(
  REPLACE(content, 
    'border-top: 1px solid #333; width: 320px;', 
    'width: 320px;'),
  'margin: 0 auto -20px;',
  'margin: 0 auto;'
)
WHERE code = 'DECL' AND office_id IS NULL;

-- Atualiza também templates específicos de escritório (clones) - PROC
UPDATE public.document_templates
SET content = REPLACE(
  REPLACE(content, 
    'border-top: 1px solid #333; width: 300px;', 
    'width: 300px;'),
  'margin: 0 auto -20px;',
  'margin: 0 auto;'
)
WHERE code = 'PROC' AND office_id IS NOT NULL;

-- Atualiza também templates específicos de escritório (clones) - DECL
UPDATE public.document_templates
SET content = REPLACE(
  REPLACE(content, 
    'border-top: 1px solid #333; width: 320px;', 
    'width: 320px;'),
  'margin: 0 auto -20px;',
  'margin: 0 auto;'
)
WHERE code = 'DECL' AND office_id IS NOT NULL;