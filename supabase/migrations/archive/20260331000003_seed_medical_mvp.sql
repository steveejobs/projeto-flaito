-- =====================================================================================
-- Migration: Seed Medical MVP (Acervo Inicial do Flaito)
-- Description: Insere protocolos clínicos e modelos de laudo para popular o sistema
-- =====================================================================================

-- 1. Ajuste de Estrutura para Globais
-- Permitir office_id nulo para que o sistema forneça templates globais
ALTER TABLE public.protocolos ALTER COLUMN office_id DROP NOT NULL;

-- Atualizar Policies RLS para permitir leitura pública dos itens seed
CREATE POLICY "Anyone can view system protocolos"
    ON public.protocolos FOR SELECT
    USING (office_id IS NULL);

-- report_templates já permite NULL no office_id, apenas liberar leitura do sistema
CREATE POLICY "Anyone can view system report_templates"
    ON public.report_templates FOR SELECT
    USING (office_id IS NULL AND is_default = true);

-- 2. Seed `protocolos`
INSERT INTO public.protocolos (id, titulo, condicao, descricao, nivel_evidencia, categoria, conteudo, ativo)
VALUES 
(
    '10000000-0000-0000-0000-000000000001',
    'Protocolo de Hipertensão Leve - Abordagem Integrativa',
    'Hipertensão Arterial Sistemica Grau I',
    'Avaliação inicial de HAS focada em redução de peso, dieta DASH, redução de sódio e nutracêuticos adjuvantes (Magnésio, Coenzima Q10).',
    'A',
    'integrativa',
    '{
        "passos": [
            "Monitoramento diário de PA por 7 dias",
            "Dieta com restrição moderada de sódio (< 2g/dia) e aumento de potássio",
            "Iniciar atividade física aeróbica 150min/semana",
            "Suplementação sugerida: Magnésio Dimalato 300mg/dia, Coenzima Q10 100mg/dia"
        ],
        "metas": "PA < 130/80 mmHg"
    }'::jsonb,
    true
),
(
    '10000000-0000-0000-0000-000000000002',
    'Protocolo Nutricional: Ansiedade e Sono',
    'Transtorno de Ansiedade / Insônia Secundária',
    'Estratégia nutricional focada em modulação de ciclo circadiano, redução de cafeína, e aporte de triptofano.',
    'B',
    'nutricao',
    '{
        "passos": [
            "Higiene do Sono rigorosa a partir das 20h",
            "Cessar estimulantes após 14h (café, chás escuros, pré-treinos)",
            "Ceia com fontes de Triptofano (ex: aveia, leite, banana) e chá de mulungu ou passiflora",
            "Suplementação: Melatonina 0.5mg a 3mg 1h antes de deitar"
        ],
        "metas": "Aumento no tempo total de sono; redução de despertares"
    }'::jsonb,
    true
),
(
    '10000000-0000-0000-0000-000000000003',
    'Protocolo Investigativo - Eixo Neurometabólico',
    'Fadiga Crônica / Suspeita de Disbiose',
    'Bateria de exames e abordagem base focada no eixo intestino-cérebro em pacientes fadigados.',
    'C',
    'neurologia',
    '{
        "passos": [
            "Pedido de Exames: Homocisteína, Vit B12, Vit D3, Ferritina, Cortisol Salivar, Perfil Tireoidiano Completo",
            "Início de protocolo de reparo intestinal (Glutamina 5g/dia, probiótico mix)",
            "Acompanhamento psicológico"
        ],
        "metas": "Mapeamento metabólico e alívio inicial de fadiga"
    }'::jsonb,
    true
)
ON CONFLICT (id) DO NOTHING;

-- 3. Seed `report_templates`
INSERT INTO public.report_templates (id, name, description, sections, terminology_level, detail_level, is_default)
VALUES 
(
    '20000000-0000-0000-0000-000000000001',
    'Anamnese Geral / Primeira Consulta',
    'Template com seções ideais para acolhimento de novos pacientes.',
    '[
        {"nome": "Queixa Principal", "tipo": "texto_livre"},
        {"nome": "Histórico Mórbido Pessoal (HMP)", "tipo": "lista"},
        {"nome": "Histórico Familiar", "tipo": "texto_livre"},
        {"nome": "Hábitos de Vida", "tipo": "texto_livre"}
    ]'::jsonb,
    'layman',
    'detailed',
    true
),
(
    '20000000-0000-0000-0000-000000000002',
    'Laudo Clínico Evolutivo (Retorno)',
    'Template enxuto para consultas de acompanhamento.',
    '[
        {"nome": "Progresso desde a última consulta", "tipo": "texto_livre"},
        {"nome": "Sinais Vitais / Antropometria Atual", "tipo": "tabela"},
        {"nome": "Conduta Ajustada", "tipo": "texto_livre"}
    ]'::jsonb,
    'technical',
    'concise',
    true
),
(
    '20000000-0000-0000-0000-000000000003',
    'Laudo Iridológico Completo',
    'Ficha padrão para compilar achados da Iridologia.',
    '[
        {"nome": "Constituição Geral", "tipo": "selecao"},
        {"nome": "Sinais Tópicos - Olho Direito", "tipo": "texto_livre"},
        {"nome": "Sinais Tópicos - Olho Esquerdo", "tipo": "texto_livre"},
        {"nome": "Conclusão Terapêutica", "tipo": "texto_livre"}
    ]'::jsonb,
    'technical',
    'detailed',
    true
)
ON CONFLICT (id) DO NOTHING;
