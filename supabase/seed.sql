-- Flaito Master Seed File
-- Last Updated: 2026-03-26
-- Author: Antigravity (Principal Engineer)

-- ============================================================
-- 1. ESTRUTURA BASE (SISTEMA)
-- ============================================================
INSERT INTO public.offices (id, name, slug, office_type)
VALUES ('ff000000-0000-0000-0000-000000000000', 'Flaito System Content', 'system-content', 'SYSTEM')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. ACERVO JURÍDICO
-- ============================================================

-- banco_juridico
INSERT INTO public.banco_juridico (office_id, tipo, titulo, area_direito, descricao, texto_completo, tags)
VALUES 
('ff000000-0000-0000-0000-000000000000', 'PETICAO', 'Ação de Divórcio Litigioso c/c Alimentos', 'Família', 'Modelo completo de petição inicial para divórcio litigioso com pedido de alimentos.', 'EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA ... VARA DE FAMÍLIA...\n\n[NOME DO REQUERENTE], brasileiro, estado civil..., profissão..., portador do RG nº... e CPF nº..., residente e domiciliado na...', '["familia", "divorcio", "alimentos", "inicial"]'),
('ff000000-0000-0000-0000-000000000000', 'PETICAO', 'Mandado de Segurança contra Ato Administrativo', 'Administrativo', 'Modelo de MS para suspensão de ato administrativo ilegal ou com abuso de poder.', 'AO JUÍZO DA ... VARA FEDERAL DA SEÇÃO JUDICIÁRIA DE...\n\n[IMPETRANTE], por seu advogado infra-assinado...', '["administrativo", "mandado de seguranca", "urgente"]'),
('ff000000-0000-0000-0000-000000000000', 'TESE', 'Inexigibilidade de Débito por Fraude Bancária', 'Consumidor', 'Tese jurídica sobre a responsabilidade objetiva das instituições financeiras em casos de fortuito interno.', 'A responsabilidade das instituições financeiras por fraudes cometidas por terceiros no âmbito de operações bancárias é objetiva...', '["consumidor", "bancario", "fraude", "responsabilidade"]');

-- contatos_judiciario
INSERT INTO public.contatos_judiciario (nome_vara, tipo, tribunal, telefone, email, endereco, cidade, estado)
VALUES 
('1ª Vara Cível de Palmas', 'CIVIL', 'TJTO', '(63) 3218-4400', '1civelpalmas@tjto.jus.br', 'Anexo I do Tribunal de Justiça', 'Palmas', 'TO'),
('Fórum João Mendes Júnior', 'CIVIL', 'TJSP', '(11) 2171-6000', 'joaomendes@tjsp.jus.br', 'Praça João Mendes, s/n', 'São Paulo', 'SP');

-- delegacias
INSERT INTO public.delegacias (nome, tipo, telefone, email, endereco, cidade, estado)
VALUES 
('1ª Delegacia de Polícia de Palmas', 'CIVIL', '(63) 3218-1800', '1dp.palmas@ssp.to.gov.br', 'Quadra 103 Sul, Rua SO 05', 'Palmas', 'TO');

-- ============================================================
-- 3. ACERVO MÉDICO
-- ============================================================

-- protocolos
INSERT INTO public.protocolos (id, office_id, titulo, condicao, descricao, nivel_evidencia, categoria, conteudo)
VALUES 
('d1a1b2c3-d4e5-4f6a-b7c8-d9e0f1a2b3c4', 'ff000000-0000-0000-0000-000000000000', 'Protocolo de Manejo da Gastrite Atópica', 'Gastrite', 'Diretrizes para tratamento nutricional e integrativo de pacientes com gastrite atópica.', 'A', 'nutricao', '{"passos": ["Remover irritantes gástricos", "Suplementar com Aloe Vera", "Dieta anti-inflamatória"]}'::jsonb),
('e2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'ff000000-0000-0000-0000-000000000000', 'Regulação do Eixo HPA - Estresse Crônico', 'Ansiedade/Estresse', 'Protocolo integrativo para modulação de cortisol e suporte adrenal.', 'B', 'integrativa', '{"suplementacao": ["Ashwagandha 500mg/dia"]}'::jsonb);

-- referencias_cientificas
INSERT INTO public.referencias_cientificas (office_id, protocolo_id, titulo, autores, publicacao, ano, doi)
VALUES 
('ff000000-0000-0000-0000-000000000000', 'd1a1b2c3-d4e5-4f6a-b7c8-d9e0f1a2b3c4', 'Gastrointestinal effects of Aloe vera: A review', 'Schmidt et al.', 'Journal of Gastroenterology', 2021, '10.1007/s00535-021-01777-y');

-- ============================================================
-- 4. MENSAGERIA
-- ============================================================

-- message_template_categories
INSERT INTO public.message_template_categories (id, name, description)
VALUES 
('ONBOARDING', 'Boas-vindas e Ativação', 'Templates para primeiro contato.'),
('REMINDER', 'Lembretes e Avisos', 'Avisos de consultas e prazos.'),
('QUICK', 'Respostas Rápidas', 'Frases curtas.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. DOCUMENTOS E MODELOS INSTITUCIONAIS (Motor V3)
-- ============================================================

-- document_variables
INSERT INTO public.document_variables (key, label, type, source_type, vertical, category, required)
VALUES 
    ('client.full_name', 'Nome Completo', 'text', 'system', 'BOTH', 'Geral', true),
    ('client.cpf', 'CPF', 'text', 'system', 'BOTH', 'Geral', false),
    ('case.cnj_number', 'Processo', 'text', 'system', 'LEGAL', 'Processo', false),
    ('office.name', 'Escritório', 'text', 'system', 'BOTH', 'Geral', true),
    ('custom.data_extenso', 'Data Extenso', 'text', 'manual', 'BOTH', 'Geral', true)
ON CONFLICT (office_id, key) DO NOTHING;

-- document_templates
INSERT INTO public.document_templates (id, name, category, code, vertical, is_system, content)
VALUES 
(
    '50000000-0000-0000-0000-000000000001',
    'Procuração Ad Judicia (Sistema)',
    'PROCURAÇÃO',
    'PROC_SYS_001',
    'LEGAL',
    true,
    '<h1>PROCURAÇÃO</h1><p>OUTORGANTE: {{client.full_name}}, CPF: {{client.cpf}}.</p><p>OUTORGADO: {{office.name}}.</p>'
)
ON CONFLICT (id) DO NOTHING;

-- document_template_versions (v1)
INSERT INTO public.document_template_versions (template_id, version_number, content_html, status, published_at)
VALUES 
('50000000-0000-0000-0000-000000000001', 1, '<h1>PROCURAÇÃO</h1><p>OUTORGANTE: {{client.full_name}}, CPF: {{client.cpf}}.</p><p>OUTORGADO: {{office.name}}.</p>', 'published', now())
ON CONFLICT (template_id, version_number) DO NOTHING;

-- Update template active version
UPDATE public.document_templates SET active_version_id = (SELECT id FROM public.document_template_versions WHERE template_id = '50000000-0000-0000-0000-000000000001' LIMIT 1)
WHERE id = '50000000-0000-0000-0000-000000000001';

-- Additional system templates for operational document generation

-- Declaração de Hipossuficiência
INSERT INTO public.document_templates (id, name, category, code, vertical, is_system, content)
VALUES
(
    '50000000-0000-0000-0000-000000000002',
    'Declaração de Hipossuficiência (Sistema)',
    'DECLARAÇÃO',
    'DECL_SYS_001',
    'LEGAL',
    true,
    '<h1>DECLARAÇÃO DE HIPOSSUFICIÊNCIA</h1><p>Eu, <strong>{{client.full_name}}</strong>, portador(a) do CPF nº {{client.cpf}}, residente e domiciliado(a) em {{client.address_line}}, {{client.city}} - {{client.state}}, CEP {{client.cep}}, <strong>DECLARO</strong>, para os devidos fins de direito, sob as penas da lei, que não possuo condições financeiras de arcar com as custas processuais e honorários advocatícios sem prejuízo do sustento próprio e de minha família, nos termos do art. 98 e seguintes do Código de Processo Civil.</p><p>Por ser expressão da verdade, firmo a presente declaração.</p><p>{{custom.data_extenso}}</p><p>_____________________________<br/>{{client.full_name}}</p>'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.document_template_versions (template_id, version_number, content_html, status, published_at)
VALUES
('50000000-0000-0000-0000-000000000002', 1, '<h1>DECLARAÇÃO DE HIPOSSUFICIÊNCIA</h1><p>Eu, <strong>{{client.full_name}}</strong>, portador(a) do CPF nº {{client.cpf}}, residente e domiciliado(a) em {{client.address_line}}, {{client.city}} - {{client.state}}, CEP {{client.cep}}, <strong>DECLARO</strong>, para os devidos fins de direito, sob as penas da lei, que não possuo condições financeiras de arcar com as custas processuais e honorários advocatícios sem prejuízo do sustento próprio e de minha família, nos termos do art. 98 e seguintes do Código de Processo Civil.</p><p>Por ser expressão da verdade, firmo a presente declaração.</p><p>{{custom.data_extenso}}</p><p>_____________________________<br/>{{client.full_name}}</p>', 'published', now())
ON CONFLICT (template_id, version_number) DO NOTHING;

UPDATE public.document_templates SET active_version_id = (SELECT id FROM public.document_template_versions WHERE template_id = '50000000-0000-0000-0000-000000000002' LIMIT 1)
WHERE id = '50000000-0000-0000-0000-000000000002';

-- Contrato de Honorários Advocatícios
INSERT INTO public.document_templates (id, name, category, code, vertical, is_system, content)
VALUES
(
    '50000000-0000-0000-0000-000000000003',
    'Contrato de Honorários Advocatícios (Sistema)',
    'CONTRATO',
    'CONTR_SYS_001',
    'LEGAL',
    true,
    '<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</h1><p>Pelo presente instrumento particular, de um lado <strong>{{client.full_name}}</strong>, CPF nº {{client.cpf}}, doravante denominado(a) CONTRATANTE, e de outro lado <strong>{{office.name}}</strong>, doravante denominado CONTRATADO, têm entre si justo e contratado o seguinte:</p><h2>CLÁUSULA PRIMEIRA — DO OBJETO</h2><p>O presente contrato tem por objeto a prestação de serviços advocatícios pelo CONTRATADO ao CONTRATANTE, referentes ao processo nº {{case.cnj_number}}.</p><h2>CLÁUSULA SEGUNDA — DOS HONORÁRIOS</h2><p>Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO o valor de R$ {{custom.valor_honorarios}}, a ser pago conforme condições acordadas entre as partes.</p><h2>CLÁUSULA TERCEIRA — DA VIGÊNCIA</h2><p>O presente contrato vigorará até a conclusão dos serviços contratados ou até rescisão por qualquer das partes mediante comunicação prévia por escrito.</p><p>{{custom.data_extenso}}</p><p>_____________________________<br/>{{client.full_name}}<br/>CONTRATANTE</p><p>_____________________________<br/>{{office.name}}<br/>CONTRATADO</p>'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.document_template_versions (template_id, version_number, content_html, status, published_at)
VALUES
('50000000-0000-0000-0000-000000000003', 1, '<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</h1><p>Pelo presente instrumento particular, de um lado <strong>{{client.full_name}}</strong>, CPF nº {{client.cpf}}, doravante denominado(a) CONTRATANTE, e de outro lado <strong>{{office.name}}</strong>, doravante denominado CONTRATADO, têm entre si justo e contratado o seguinte:</p><h2>CLÁUSULA PRIMEIRA — DO OBJETO</h2><p>O presente contrato tem por objeto a prestação de serviços advocatícios pelo CONTRATADO ao CONTRATANTE, referentes ao processo nº {{case.cnj_number}}.</p><h2>CLÁUSULA SEGUNDA — DOS HONORÁRIOS</h2><p>Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO o valor de R$ {{custom.valor_honorarios}}, a ser pago conforme condições acordadas entre as partes.</p><h2>CLÁUSULA TERCEIRA — DA VIGÊNCIA</h2><p>O presente contrato vigorará até a conclusão dos serviços contratados ou até rescisão por qualquer das partes mediante comunicação prévia por escrito.</p><p>{{custom.data_extenso}}</p><p>_____________________________<br/>{{client.full_name}}<br/>CONTRATANTE</p><p>_____________________________<br/>{{office.name}}<br/>CONTRATADO</p>', 'published', now())
ON CONFLICT (template_id, version_number) DO NOTHING;

UPDATE public.document_templates SET active_version_id = (SELECT id FROM public.document_template_versions WHERE template_id = '50000000-0000-0000-0000-000000000003' LIMIT 1)
WHERE id = '50000000-0000-0000-0000-000000000003';

-- Declaração de Residência
INSERT INTO public.document_templates (id, name, category, code, vertical, is_system, content)
VALUES
(
    '50000000-0000-0000-0000-000000000004',
    'Declaração de Residência (Sistema)',
    'DECLARAÇÃO',
    'DECL_SYS_002',
    'LEGAL',
    true,
    '<h1>DECLARAÇÃO DE RESIDÊNCIA</h1><p>Eu, <strong>{{client.full_name}}</strong>, portador(a) do CPF nº {{client.cpf}}, <strong>DECLARO</strong> para os devidos fins que resido no endereço: {{client.address_line}}, {{client.city}} - {{client.state}}, CEP {{client.cep}}.</p><p>{{custom.data_extenso}}</p><p>_____________________________<br/>{{client.full_name}}</p>'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.document_template_versions (template_id, version_number, content_html, status, published_at)
VALUES
('50000000-0000-0000-0000-000000000004', 1, '<h1>DECLARAÇÃO DE RESIDÊNCIA</h1><p>Eu, <strong>{{client.full_name}}</strong>, portador(a) do CPF nº {{client.cpf}}, <strong>DECLARO</strong> para os devidos fins que resido no endereço: {{client.address_line}}, {{client.city}} - {{client.state}}, CEP {{client.cep}}.</p><p>{{custom.data_extenso}}</p><p>_____________________________<br/>{{client.full_name}}</p>', 'published', now())
ON CONFLICT (template_id, version_number) DO NOTHING;

UPDATE public.document_templates SET active_version_id = (SELECT id FROM public.document_template_versions WHERE template_id = '50000000-0000-0000-0000-000000000004' LIMIT 1)
WHERE id = '50000000-0000-0000-0000-000000000004';

-- Additional document variables for new templates
INSERT INTO public.document_variables (key, label, type, source_type, vertical, category, required)
VALUES
    ('client.address_line', 'Endereço', 'text', 'system', 'BOTH', 'Endereço', false),
    ('client.city', 'Cidade', 'text', 'system', 'BOTH', 'Endereço', false),
    ('client.state', 'Estado', 'text', 'system', 'BOTH', 'Endereço', false),
    ('client.cep', 'CEP', 'text', 'system', 'BOTH', 'Endereço', false),
    ('custom.valor_honorarios', 'Valor dos Honorários', 'text', 'manual', 'LEGAL', 'Financeiro', false)
ON CONFLICT (office_id, key) DO NOTHING;

