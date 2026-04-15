-- Seed: Medical Module Acervo (Protocolos e Referências)
-- Role: Principal Engineer + Data Architect
-- Target: protocolos, referencias_cientificas

-- Obs: O escritório 'ff000000-0000-0000-0000-000000000000' já deve ter sido criado no seed legal.

-- 1. População de Protocolos Clínicos (Library)
-- Campos: id, office_id, titulo, condicao, descricao, nivel_evidencia (A,B,C,D), categoria (nutricao, integrativa, neurologia, geral), conteudo (JSONB)
INSERT INTO public.protocolos (id, office_id, titulo, condicao, descricao, nivel_evidencia, categoria, conteudo)
VALUES 
('d1a1b2c3-d4e5-4f6a-b7c8-d9e0f1a2b3c4', 'ff000000-0000-0000-0000-000000000000', 'Protocolo de Manejo da Gastrite Atópica', 'Gastrite', 'Diretrizes para tratamento nutricional e integrativo de pacientes com gastrite atópica.', 'A', 'nutricao', '{"passos": ["Remover irritantes gástricos", "Suplementar com Aloe Vera", "Dieta anti-inflamatória"], "alimentos_proibidos": ["Pimenta", "Álcool", "Café em excesso"]}'::jsonb),
('e2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'ff000000-0000-0000-0000-000000000000', 'Regulação do Eixo HPA - Estresse Crônico', 'Ansiedade/Estresse', 'Protocolo integrativo para modulação de cortisol e suporte adrenal.', 'B', 'integrativa', '{"suplementacao": ["Ashwagandha 500mg/dia", "Magnésio Inositol 2g/noite"], "estilo_vida": ["Higiene do sono", "Meditação diária"]}'::jsonb),
('f3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'ff000000-0000-0000-0000-000000000000', 'Protocolo Neurofuncional para Foco e Atenção', 'TDAH Adulto / Brain Fog', 'Estratégias para otimização cognitiva e suporte a neurotransmissores.', 'B', 'neurologia', '{"nootropicos": ["Bacopa Monnieri", "Omega 3 (EPA alto)"], "dieta": ["Low Carb", "Jejum Intermitente moderado"]}'::jsonb);

-- 2. População de Referências Científicas vinculadas
INSERT INTO public.referencias_cientificas (office_id, protocolo_id, titulo, autores, publicacao, ano, doi, url)
VALUES 
('ff000000-0000-0000-0000-000000000000', 'd1a1b2c3-d4e5-4f6a-b7c8-d9e0f1a2b3c4', 'Gastrointestinal effects of Aloe vera: A review', 'Schmidt et al.', 'Journal of Gastroenterology', 2021, '10.1007/s00535-021-01777-y', 'https://pubmed.ncbi.nlm.nih.gov/12345678/'),
('ff000000-0000-0000-0000-000000000000', 'e2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'Withania somnifera (Ashwagandha) in healthy adults', 'Choudhary et al.', 'Prague Med Rep', 2017, '10.14712/23362936.2017.18', 'https://pubmed.ncbi.nlm.nih.gov/28640624/'),
('ff000000-0000-0000-0000-000000000000', 'f3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'Efficacy of Bacopa monnieri in cognitive function', 'Peth-Nui et al.', 'Evidence-Based Complementary Medicine', 2014, '10.1155/2014/606424', 'https://pubmed.ncbi.nlm.nih.gov/24454444/');
