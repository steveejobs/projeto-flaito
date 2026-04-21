-- Seed: Legal Module Acervo (Petições, Teses, Súmulas e Contatos)
-- Role: Principal Engineer + Data Architect
-- Target: banco_juridico, contatos_judiciario, delegacias, legal_precedents

-- 1. Garante a existência do Escritório de Conteúdo do Sistema
INSERT INTO public.offices (id, name, slug, office_type)
VALUES ('ff000000-0000-0000-0000-000000000000', 'Flaito System Content', 'system-content', 'SYSTEM')
ON CONFLICT (id) DO NOTHING;

-- 2. População do Banco Jurídico (Petições e Teses)
INSERT INTO public.banco_juridico (office_id, tipo, titulo, area_direito, descricao, texto_completo, tags)
VALUES 
('ff000000-0000-0000-0000-000000000000', 'PETICAO', 'Ação de Divórcio Litigioso c/c Alimentos', 'Família', 'Modelo completo de petição inicial para divórcio litigioso com pedido de alimentos.', 'EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA ... VARA DE FAMÍLIA...\n\n[NOME DO REQUERENTE], brasileiro, estado civil..., profissão..., portador do RG nº... e CPF nº..., residente e domiciliado na...', '["familia", "divorcio", "alimentos", "inicial"]'),
('ff000000-0000-0000-0000-000000000000', 'PETICAO', 'Mandado de Segurança contra Ato Administrativo', 'Administrativo', 'Modelo de MS para suspensão de ato administrativo ilegal ou com abuso de poder.', 'AO JUÍZO DA ... VARA FEDERAL DA SEÇÃO JUDICIÁRIA DE...\n\n[IMPETRANTE], por seu advogado infra-assinado...', '["administrativo", "mandado de seguranca", "urgente"]'),
('ff000000-0000-0000-0000-000000000000', 'TESE', 'Inexigibilidade de Débito por Fraude Bancária', 'Consumidor', 'Tese jurídica sobre a responsabilidade objetiva das instituições financeiras em casos de fortuito interno.', 'A responsabilidade das instituições financeiras por fraudes cometidas por terceiros no âmbito de operações bancárias é objetiva...', '["consumidor", "bancario", "fraude", "responsabilidade"]'),
('ff000000-0000-0000-0000-000000000000', 'DOUTRINA', 'O Princípio da Dignidade da Pessoa Humana no Direito Civil', 'Civil', 'Resumo doutrinário sobre a aplicabilidade direta do princípio constitucional nas relações privadas.', 'O princípio da dignidade da pessoa humana, como vetor interpretativo de todo o ordenamento jurídico...', '["civil", "constitucional", "doutrina"]'),
('ff000000-0000-0000-0000-000000000000', 'SUMULA', 'Súmula Vinculante 11 - Uso de Algemas', 'Constitucional', 'Dispõe sobre o uso de algemas apenas em casos de resistência e fundado receio de fuga.', 'Só é lícito o uso de algemas em casos de resistência e de fundado receio de fuga ou de perigo à integridade física própria ou alheia...', '["penal", "algemas", "stf", "sumula vinculante"]');

-- 3. População de Contatos do Judiciário (Varas e Tribunais)
INSERT INTO public.contatos_judiciario (nome_vara, tipo, tribunal, telefone, email, endereco, cidade, estado)
VALUES 
('1ª Vara Cível de Palmas', 'CIVIL', 'TJTO', '(63) 3218-4400', '1civelpalmas@tjto.jus.br', 'Anexo I do Tribunal de Justiça', 'Palmas', 'TO'),
('2ª Vara da Família de Goiânia', 'FAMILIA', 'TJGO', '(62) 3236-2000', '2familia@tjgo.jus.br', 'Fórum Cível, Park Lozandes', 'Goiânia', 'GO'),
('Fórum João Mendes Júnior', 'CIVIL', 'TJSP', '(11) 2171-6000', 'joaomendes@tjsp.jus.br', 'Praça João Mendes, s/n', 'São Paulo', 'SP'),
('Vara do Trabalho de Brasília', 'OUTRO', 'TRT10', '(61) 3348-1100', 'vara01bsb@trt10.jus.br', 'SAFS Quadra 04 Lote 01', 'Brasília', 'DF');

-- 4. População de Delegacias
INSERT INTO public.delegacias (nome, tipo, telefone, email, endereco, cidade, estado)
VALUES 
('1ª Delegacia de Polícia de Palmas', 'CIVIL', '(63) 3218-1800', '1dp.palmas@ssp.to.gov.br', 'Quadra 103 Sul, Rua SO 05', 'Palmas', 'TO'),
('Delegacia da Mulher (DEAM) Goiânia', 'MULHER', '(62) 3201-2801', 'deam.goiania@pc.go.gov.br', 'Rua 24, Centro', 'Goiânia', 'GO'),
('Delegacia de Polícia Federal - Aeroporto GRU', 'FEDERAL', '(11) 2445-2212', 'delemig.gru@dpf.gov.br', 'Rodovia Hélio Smidt, s/n', 'Guarulhos', 'SP');

-- 5. População de Precedentes Jurídicos (legal_precedents)
-- Nota: Esta tabela existe no base_schema mas sem FK de office_id (Global)
INSERT INTO public.legal_precedents (title, description, content, tags)
VALUES 
('Danos Morais - Inscrição Indevida no SPC', 'Indenização fixada em R$ 10.000,00 por negativação sem notificação prévia.', 'EMENTA: APELAÇÃO CÍVEL. AÇÃO DE INDENIZAÇÃO. INSCRIÇÃO INDEVIDA NOS ÓRGÃOS DE PROTEÇÃO AO CRÉDITO. DANO MORAL IN RE IPSA...', '["civil", "consumidor", "indenizacao"]'),
('Pensão Alimentícia - Binômio Necessidade-Possibilidade', 'Fixação de 30% do salário mínimo para um filho, considerando renda informal do genitor.', 'Vistos, etc. O pedido de alimentos deve observar a proporcionalidade entre as necessidades do alimentado e as possibilidades do alimentante...', '["familia", "alimentos", "precedente"]');
