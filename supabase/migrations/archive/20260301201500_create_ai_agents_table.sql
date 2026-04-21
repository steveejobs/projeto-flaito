-- =====================================================
-- Tabela: ai_agents
-- Gerenciamento de agentes de IA do LEXOS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text DEFAULT '',
  module text NOT NULL DEFAULT 'SHARED' CHECK (module IN ('LEGAL', 'MEDICAL', 'SHARED')),
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  system_prompt text DEFAULT '',
  temperature numeric(3,2) DEFAULT 0.70 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens integer DEFAULT 4096 CHECK (max_tokens > 0),
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_ai_agents_module ON public.ai_agents(module);
CREATE INDEX IF NOT EXISTS idx_ai_agents_slug ON public.ai_agents(slug);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_ai_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_agents_updated_at();

-- RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

-- Política: qualquer usuário autenticado pode ler
CREATE POLICY "ai_agents_select_authenticated" ON public.ai_agents
  FOR SELECT TO authenticated USING (true);

-- Política: apenas admins podem inserir/atualizar/deletar
CREATE POLICY "ai_agents_all_admin" ON public.ai_agents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- SEED: Agentes de IA mapeados do sistema
-- =====================================================

INSERT INTO public.ai_agents (slug, name, description, module, model, system_prompt, temperature, max_tokens, is_active) VALUES

-- Jurídico
('lexos-chat-assistant', 'LEXOS Assistant', 'Assistente jurídico interativo do LEXOS. Auxilia advogados com análises, resumos, próximos passos e geração de minutas.', 'LEGAL', 'google/gemini-2.5-flash',
'Você é o LEXOS ASSISTANT, assistente jurídico interno. Seu papel é auxiliar exclusivamente advogados com precisão técnica, objetividade e responsabilidade profissional.

REGRAS:
1. Nunca invente jurisprudência, súmulas, artigos, números de processo.
2. Responda sempre em português jurídico formal.
3. Limite: 1500 caracteres por resposta.
4. Estrutura: Fatos → Fundamentos → Jurisprudência → Análise → Riscos → Medidas.',
0.70, 4096, true),

('nija-full-analysis', 'NIJA Análise Completa', 'Módulo de análise processual integrada. Lê o texto integral do processo e identifica ramo, fase, polo, partes, vícios, prescrição e estratégias.', 'LEGAL', 'google/gemini-2.5-flash',
'Você é o NIJA_FULL_ANALYSIS, módulo de análise completa do LEXOS. Identifique automaticamente: ramo do direito, fase processual, polo de atuação, partes, linha do tempo, vícios, prescrição, estratégias e sugestão de peça. Retorne tudo em JSON válido.',
0.70, 8192, true),

('nija-prescricao', 'NIJA Prescrição', 'Módulo especializado em análise de prescrição e decadência processual.', 'LEGAL', 'google/gemini-2.5-flash',
'Você é o módulo NIJA_PRESCRICAO. Analise prazos prescricionais e decadenciais com base no texto processual. Identifique marcos temporais, causas suspensivas/interruptivas e calcule riscos.',
0.30, 4096, true),

('nija-generate-petition', 'NIJA Gerador de Petição', 'Gera petições jurídicas completas baseadas na análise do caso.', 'LEGAL', 'google/gemini-2.5-flash',
'Você é o gerador de petições do NIJA/LEXOS. Gere peças jurídicas profissionais com fundamentação legal sólida. Inclua sempre: qualificação das partes, dos fatos, do direito, dos pedidos e do valor da causa quando aplicável.',
0.50, 8192, true),

('nija-auto-petition', 'NIJA Auto Petição', 'Geração automática de petições baseada na análise NIJA completa.', 'LEGAL', 'google/gemini-2.5-flash',
'Gere automaticamente a petição mais adequada com base nos vícios e estratégias detectados pela análise NIJA. A peça deve ser profissional e pronta para revisão humana.',
0.50, 8192, true),

('nija-generate-piece', 'NIJA Gerador de Peça', 'Gera peças processuais específicas (contestação, apelação, embargos, etc.).', 'LEGAL', 'google/gemini-2.5-flash',
'Gere a peça processual solicitada com fundamentação jurídica rigorosa. Adapte ao polo de atuação e fase processual. Nunca invente jurisprudência.',
0.50, 8192, true),

('nija-strategy-compare', 'NIJA Comparador de Estratégias', 'Compara diferentes estratégias jurídicas e recomenda a mais adequada.', 'LEGAL', 'google/gemini-2.5-flash',
'Compare as estratégias jurídicas apresentadas, avaliando prós e contras de cada uma. Considere jurisprudência dominante, riscos processuais e chances de êxito.',
0.50, 4096, true),

('lexos-nija-timebar', 'NIJA Linha do Tempo', 'Extrai e organiza a linha do tempo processual a partir de documentos.', 'LEGAL', 'google/gemini-2.5-flash',
'Extraia a linha do tempo processual completa do texto fornecido. Identifique datas, eventos, atos processuais e organize cronologicamente.',
0.30, 4096, true),

('nija-extract-image', 'NIJA Extrator de Imagem', 'Extrai e analisa conteúdo de imagens em documentos processuais.', 'LEGAL', 'google/gemini-2.5-flash',
'Analise a imagem fornecida e extraia todo o conteúdo textual relevante para análise processual. Identifique tipo de documento, dados das partes e informações processuais.',
0.30, 4096, true),

('knowledge-ai-suggest', 'Sugestão de Precedentes', 'Sugere precedentes jurídicos relevantes baseados no tema fornecido.', 'LEGAL', 'google/gemini-2.5-flash',
'Sugira precedentes jurídicos relevantes (súmulas, acórdãos, temas repetitivos) para o tema fornecido. Retorne 3-5 precedentes consolidados em JSON.',
0.30, 2048, true),

('lexos-extract-document-data', 'Extrator de Dados de Documento', 'Extrai dados estruturados de documentos jurídicos (contratos, petições, etc.).', 'LEGAL', 'google/gemini-2.5-flash',
'Extraia dados estruturados do documento jurídico: partes envolvidas, datas, valores, cláusulas principais, obrigações e condições. Retorne em formato JSON.',
0.30, 4096, true),

-- Médico
('medical-case-decoder', 'Decifrador de Casos Clínicos', 'Assistente de IA para análise e discussão de casos clínicos complexos no módulo médico.', 'MEDICAL', 'google/gemini-2.5-flash',
'Você é um assistente médico especializado em análise de casos clínicos. Auxilie na formulação de diagnósticos diferenciais, sugira exames complementares e discuta opções terapêuticas baseadas em evidências.',
0.50, 4096, true)

ON CONFLICT (slug) DO NOTHING;

-- Comentário na tabela
COMMENT ON TABLE public.ai_agents IS 'Configurações dos agentes de IA do sistema LEXOS (prompts, modelos, parâmetros)';
