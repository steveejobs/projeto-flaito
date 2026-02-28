-- Desabilitar temporariamente o trigger que bloqueia edição de templates padrão
ALTER TABLE document_templates DISABLE TRIGGER trg_block_default_templates;

-- Atualizar PROCURAÇÃO para usar {{client.identificacao_cliente}}
UPDATE document_templates 
SET content = REPLACE(
  content,
  E'<p>\n    <strong>{{client.nome_completo}}</strong>, {{client.nacionalidade}}, {{client.estado_civil}},\n    {{client.profissao}}, portador(a) do {{client.documento_tipo}} nº {{client.documento_numero}},\n    inscrito(a) no CPF sob nº {{client.cpf}}, residente e domiciliado(a) em\n    {{client.endereco_completo}}, doravante denominado(a) <strong>OUTORGANTE</strong>,',
  E'<p>\n    {{client.identificacao_cliente}}, doravante denominado(a) <strong>OUTORGANTE</strong>,'
),
updated_at = now()
WHERE code = 'PROC';

-- Atualizar DECLARAÇÃO para usar {{client.identificacao_cliente}} (formato 1)
UPDATE document_templates 
SET content = REPLACE(
  content,
  E'<p>\n    Eu, <strong>{{client.nome_completo}}</strong>, {{client.nacionalidade}}, {{client.estado_civil}},\n    {{client.profissao}}, portador(a) do {{client.documento_tipo}} nº {{client.documento_numero}},\n    inscrito(a) no CPF sob nº {{client.cpf}}, residente e domiciliado(a) em {{client.endereco_completo}},\n    <strong>DECLARO</strong>,',
  E'<p>\n    {{client.identificacao_cliente}}, <strong>DECLARO</strong>,'
),
updated_at = now()
WHERE code = 'DECL';

-- Atualizar DECLARAÇÃO para usar {{client.identificacao_cliente}} (formato 2 - linha diferente)
UPDATE document_templates 
SET content = REPLACE(
  content,
  E'<p>\n    Eu, <strong>{{client.nome_completo}}</strong>, {{client.nacionalidade}},\n    {{client.estado_civil}}, {{client.profissao}}, portador(a) do\n    {{client.documento_tipo}} nº {{client.documento_numero}}, inscrito(a) no CPF sob nº\n    {{client.cpf}}, residente e domiciliado(a) em {{client.endereco_completo}},\n    DECLARO,',
  E'<p>\n    {{client.identificacao_cliente}}, DECLARO,'
),
updated_at = now()
WHERE code = 'DECL';

-- Atualizar CONTRATO para usar {{client.identificacao_cliente}}
UPDATE document_templates 
SET content = REPLACE(
  content,
  E'<p>\n    Pelo presente instrumento particular, de um lado,\n    <strong>{{client.nome_completo}}</strong>, {{client.nacionalidade}}, {{client.estado_civil}},\n    {{client.profissao}}, portador(a) do {{client.documento_tipo}} nº {{client.documento_numero}},\n    inscrito(a) no CPF sob nº {{client.cpf}}, residente e domiciliado(a) em\n    {{client.endereco_completo}}, doravante denominado(a) <strong>CONTRATANTE</strong>;',
  E'<p>\n    Pelo presente instrumento particular, de um lado,\n    {{client.identificacao_cliente}}, doravante denominado(a) <strong>CONTRATANTE</strong>;'
),
updated_at = now()
WHERE code = 'CONTRATO';

-- Reabilitar o trigger
ALTER TABLE document_templates ENABLE TRIGGER trg_block_default_templates;