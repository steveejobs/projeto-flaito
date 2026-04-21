-- Atualiza templates globais para incluir telefone e email na qualificação do cliente

-- Atualiza template PROC (Procuração)
UPDATE document_templates
SET content = REPLACE(
  content,
  'residente e domiciliado(a) em {{client.endereco_completo}}.</p>',
  'residente e domiciliado(a) em {{client.endereco_completo}}{{#if client.phone}}, Tel.: {{client.phone}}{{/if}}{{#if client.email}}, E-mail: {{client.email}}{{/if}}.</p>'
)
WHERE code = 'PROC' 
  AND office_id IS NULL
  AND content LIKE '%residente e domiciliado(a) em {{client.endereco_completo}}.</p>%';

-- Atualiza template DECL (Declaração)
UPDATE document_templates
SET content = REPLACE(
  content,
  'residente e domiciliado(a) em {{client.endereco_completo}}.</p>',
  'residente e domiciliado(a) em {{client.endereco_completo}}{{#if client.phone}}, Tel.: {{client.phone}}{{/if}}{{#if client.email}}, E-mail: {{client.email}}{{/if}}.</p>'
)
WHERE code = 'DECL' 
  AND office_id IS NULL
  AND content LIKE '%residente e domiciliado(a) em {{client.endereco_completo}}.</p>%';

-- Atualiza template CONTRATO (Contrato de Honorários)
UPDATE document_templates
SET content = REPLACE(
  content,
  'residente e domiciliado(a) em {{client.endereco_completo}}.</p>',
  'residente e domiciliado(a) em {{client.endereco_completo}}{{#if client.phone}}, Tel.: {{client.phone}}{{/if}}{{#if client.email}}, E-mail: {{client.email}}{{/if}}.</p>'
)
WHERE code = 'CONTRATO' 
  AND office_id IS NULL
  AND content LIKE '%residente e domiciliado(a) em {{client.endereco_completo}}.</p>%';