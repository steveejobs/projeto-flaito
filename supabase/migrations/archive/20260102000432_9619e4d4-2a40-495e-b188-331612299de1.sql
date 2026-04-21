-- FASE 1: Deletar templates BASE duplicados inativos
DELETE FROM document_template_versions 
WHERE template_id IN (
  'f998fdf0-4aaa-4055-a164-2539b9f5c025',
  '32ec31f3-6cda-46cb-8cd8-c0220304b63e'
);

DELETE FROM document_templates 
WHERE id IN (
  'f998fdf0-4aaa-4055-a164-2539b9f5c025',
  '32ec31f3-6cda-46cb-8cd8-c0220304b63e'
);

-- FASE 2: Sincronizar CONTRATO global com escritório (8.044 chars)
UPDATE document_templates
SET content = (
  SELECT content FROM document_templates 
  WHERE id = '570895c2-5ba9-4fd2-a212-82febcc6e2f9'
),
updated_at = NOW()
WHERE id = '7fe9b601-5c16-4a7f-a30f-5c6a42b4ff7d';

-- FASE 3: Limpar versões antigas (manter 3 mais recentes por template)
DELETE FROM document_template_versions
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY template_id 
      ORDER BY created_at DESC
    ) as rn
    FROM document_template_versions
  ) ranked
  WHERE rn <= 3
);