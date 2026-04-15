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

-- message_templates
INSERT INTO public.message_templates (office_id, context_type, name, content, category_id, is_active)
VALUES 
('ff000000-0000-0000-0000-000000000000', 'MEDICAL', 'Boas-vindas (Clínica)', 'Olá {{client_name}}! Bem-vindo(a) à nossa clínica.', 'ONBOARDING', true),
('ff000000-0000-0000-0000-000000000000', 'LEGAL', 'Boas-vindas (Jurídico)', 'Olá {{client_name}}! Somos o escritório Flaito.', 'ONBOARDING', true);
