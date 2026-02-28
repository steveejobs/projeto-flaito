-- Desabilitar temporariamente o trigger
ALTER TABLE document_templates DISABLE TRIGGER trg_block_default_templates;

-- Atualizar templates restantes usando regex para capturar variações de formatação
-- Template PROC restante (id: d3b435d2... e f673a8b1...)
UPDATE document_templates 
SET content = regexp_replace(
  content,
  E'<p>\\s*<strong>\\{\\{client\\.nome_completo\\}\\}</strong>,\\s*\\{\\{client\\.nacionalidade\\}\\},\\s*\\{\\{client\\.estado_civil\\}\\},\\s*\\{\\{client\\.profissao\\}\\},\\s*portador\\(a\\) do \\{\\{client\\.documento_tipo\\}\\} nº \\{\\{client\\.documento_numero\\}\\},\\s*inscrito\\(a\\) no CPF sob nº \\{\\{client\\.cpf\\}\\},\\s*residente e domiciliado\\(a\\) em\\s*\\{\\{client\\.endereco_completo\\}\\},\\s*doravante denominado\\(a\\) <strong>OUTORGANTE</strong>,',
  E'<p>\n    {{client.identificacao_cliente}}, doravante denominado(a) <strong>OUTORGANTE</strong>,',
  'gi'
),
updated_at = now()
WHERE code = 'PROC' AND content NOT LIKE '%{{client.identificacao_cliente}}%';

-- Template DECL restante 
UPDATE document_templates 
SET content = regexp_replace(
  content,
  E'<p>\\s*Eu,\\s*<strong>\\{\\{client\\.nome_completo\\}\\}</strong>,\\s*\\{\\{client\\.nacionalidade\\}\\},\\s*\\{\\{client\\.estado_civil\\}\\},\\s*\\{\\{client\\.profissao\\}\\},\\s*portador\\(a\\) do\\s*\\{\\{client\\.documento_tipo\\}\\} nº \\{\\{client\\.documento_numero\\}\\},\\s*inscrito\\(a\\) no CPF sob nº\\s*\\{\\{client\\.cpf\\}\\},\\s*residente e domiciliado\\(a\\) em \\{\\{client\\.endereco_completo\\}\\},\\s*DECLARO,',
  E'<p>\n    {{client.identificacao_cliente}}, DECLARO,',
  'gi'
),
updated_at = now()
WHERE code = 'DECL' AND content NOT LIKE '%{{client.identificacao_cliente}}%';

-- Template CONTRATO restante
UPDATE document_templates 
SET content = regexp_replace(
  content,
  E'Pelo presente instrumento particular, de um lado,\\s*<strong>\\{\\{client\\.nome_completo\\}\\}</strong>,\\s*\\{\\{client\\.nacionalidade\\}\\},\\s*\\{\\{client\\.estado_civil\\}\\},\\s*\\{\\{client\\.profissao\\}\\},\\s*portador\\(a\\) do \\{\\{client\\.documento_tipo\\}\\} nº \\{\\{client\\.documento_numero\\}\\},\\s*inscrito\\(a\\) no CPF sob nº \\{\\{client\\.cpf\\}\\},\\s*residente e domiciliado\\(a\\) em\\s*\\{\\{client\\.endereco_completo\\}\\},\\s*doravante denominado\\(a\\) <strong>CONTRATANTE</strong>;',
  E'Pelo presente instrumento particular, de um lado,\n    {{client.identificacao_cliente}}, doravante denominado(a) <strong>CONTRATANTE</strong>;',
  'gi'
),
updated_at = now()
WHERE code = 'CONTRATO' AND content NOT LIKE '%{{client.identificacao_cliente}}%';

-- Reabilitar o trigger
ALTER TABLE document_templates ENABLE TRIGGER trg_block_default_templates;