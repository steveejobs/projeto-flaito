-- Remove a linha de assinatura (border-top) de PROC e DECL (templates de escritório e globais)
UPDATE public.document_templates
SET content = regexp_replace(
  content,
  'border-top:\s*1px\s+solid\s*#333;?\s*',
  '',
  'gi'
)
WHERE code IN ('PROC','DECL')
  AND content ~* 'border-top:\s*1px\s+solid\s*#333';
