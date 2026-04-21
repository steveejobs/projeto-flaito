-- Flaito Medical Depth Expansion Seed
-- Adiciona protocolos aprofundados para as especialidades suportadas

INSERT INTO public.protocolos (id, office_id, titulo, condicao, descricao, nivel_evidencia, categoria, conteudo)
VALUES 
    (
        'a1b1c1d1-e2f2-3g3g-4h4h-5i5i5i5i5i5i',
        'ff000000-0000-0000-0000-000000000000',
        'Protocolo de Modulação Intestinal Básica',
        'Disbiose Intestinal',
        'Guia completo em 4 Rs (Remover, Recolocar, Reparar, Reinoculcar) para pacientes com queixas digestivas inespecíficas e sinais de leaky gut.',
        'A',
        'nutricao_integrativa',
        '{"passos": ["1. Remover Alergênicos: retirar glúten, laticínios A1, açúcares refinados", "2. Recolocar: betaína HCl e Enzimas digestivas", "3. Reparar: L-Glutamina 5g ao dia, Zinco Carnosina", "4. Reinoculcar: Lactobacillus sporogenes, Bifidobacterium lactis"]}'::jsonb
    ),
    (
        'b2c2d2e2-f3g3-4h4h-5i5i-6j6j6j6j6j6j',
        'ff000000-0000-0000-0000-000000000000',
        'Sinais Iridológicos - Anel de Estresse (Cãibras Nervosas)',
        'Esgotamento Nervoso',
        'Análise pela Iridologia Alemã: O anel de espasmo (tetania) indica hiperatividade do sistema nervoso simpático.',
        'C',
        'naturologia',
        '{"avaliacao": ["Verificar pupilotonia", "Observar número de anéis"], "recomendacao": ["Cloreto de Magnésio PA", "Passiflora incarnata 300mg", "Técnicas de respiração diafragmática (Vagal tone)"]}'::jsonb
    ),
    (
        'c3d3e3f3-g4h4-5i5i-6j6j-7k7k7k7k7k7k',
        'ff000000-0000-0000-0000-000000000000',
        'Avaliação Neuropsicológica Inicial - TDAH Adulto',
        'TDAH',
        'Bateria recomendada de testes e rastreios para adultos com queixa primária de desatenção.',
        'A',
        'neuropsicologia',
        '{"instrumentos": ["ASRS-18", "BPA (Bateria Psicológica para Avaliação da Atenção)", "Teste de Trilhas", "WAIS-IV (Índice de Memória Operacional)"], "observacoes": "Descartar transtornos do humor comórbidos (BDI, BAI)."}'::jsonb
    ),
    (
        'd4e4f4g4-h5i5-6j6j-7k7k-8l8l8l8l8l8l',
        'ff000000-0000-0000-0000-000000000000',
        'Recomendações Pós-Análise de Iridologia',
        'Prevenção Geral',
        'Modelo base de recomendações terapêuticas naturopáticas após laudo iridológico de base toxêmica.',
        'B',
        'naturologia',
        '{"detox": ["Suco verde matinal com couve, maçã e spirulina", "Escalda-pés com sulfato de magnésio", "Chá de dente-de-leão (Taraxacum officinale) 2x ao dia", "Banhos de argila no ventre (Hidroterapia)"]}'::jsonb
    );

INSERT INTO public.referencias_cientificas (office_id, protocolo_id, titulo, autores, publicacao, ano, doi)
VALUES 
    ('ff000000-0000-0000-0000-000000000000', 'a1b1c1d1-e2f2-3g3g-4h4h-5i5i5i5i5i5i', 'Intestinal permeability and its regulation by zonulin', 'Fasano A.', 'Physiological reviews', 2011, '10.1152/physrev.00003.2008');
