-- Migration: Configurações Globais de Modelos e Stages
-- Define os modelos padrão para as etapas de análise e geração

-- 1. Inserir/Atualizar Claude 3.5 Sonnet como opção global (se necessário, já temos no frontend, mas garantimos no banco)
-- Nota: O resolver busca por slug. Se quisermos um override global por stage, criamos configs com pipeline_stage definido e office_id nulo.

-- Configuração para ETAPA DE LEITURA (Análise de Processo)
-- Usamos Gemini 1.5 Flash por padrão: rápido, barato e com janela de 1M tokens.
INSERT INTO public.ai_agent_configs (
    slug, 
    pipeline_stage, 
    model, 
    provider, 
    temperature, 
    max_tokens, 
    system_prompt,
    friendly_name,
    is_active
) VALUES (
    'nija-full-analysis',
    'ANALYSIS',
    'google/gemini-1.5-flash',
    'google',
    0.1,
    8192,
    'Você é um especialista em análise processual jurídica. Sua tarefa é ler documentos brutos e extrair dados estruturados com precisão cirúrgica.',
    'Análise de Processo (Leitura)',
    true
) ON CONFLICT (slug, office_id, pipeline_stage) DO UPDATE SET
    model = EXCLUDED.model,
    pipeline_stage = EXCLUDED.pipeline_stage,
    temperature = EXCLUDED.temperature;

-- Configuração para ETAPA DE GERAÇÃO (Motor de Peças)
-- Usamos Claude 3.5 Sonnet por padrão: o melhor para escrita jurídica criativa e técnica.
INSERT INTO public.ai_agent_configs (
    slug, 
    pipeline_stage, 
    model, 
    provider, 
    temperature, 
    max_tokens, 
    system_prompt,
    friendly_name,
    is_active
) VALUES (
    'nija-gen-motor',
    'GENERATION',
    'anthropic/claude-3-5-sonnet-20240620',
    'anthropic',
    0.7,
    4096,
    'Você é um mestre da redação jurídica brasileira. Escreva peças convincentes, fundamentadas e com linguagem natural, evitando clichês de IA.',
    'Motor de Geração (Escrita)',
    true
) ON CONFLICT (slug, office_id, pipeline_stage) DO UPDATE SET
    model = EXCLUDED.model,
    pipeline_stage = EXCLUDED.pipeline_stage,
    temperature = EXCLUDED.temperature;

-- Garantir que o Maestro saiba usar esses estágios ao chamar o resolver
