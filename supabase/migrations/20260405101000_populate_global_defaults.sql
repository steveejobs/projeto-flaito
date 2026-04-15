-- migration: populate_global_defaults

-- 1. nija-gen-motor
INSERT INTO public.ai_agent_configs (slug, friendly_name, description, provider, model, temperature, max_tokens, system_prompt, mode, is_active)
VALUES (
    'nija-gen-motor',
    'Motor de Geração NIJA',
    'Responsável pela redação técnica de peças jurídicas de alta fidelidade.',
    'google',
    'google/gemini-2.0-pro-exp-02-05',
    0.2,
    8192,
    'Você atua como Principal Legal Writer + Litigation Specialist. Sua missão é redigir peças de qualidade excepcional, usando tom profissional e técnico. MANTENHA-SE FIEL AOS FATOS DO DOSSIÊ. NÃO INVENTE PROVAS.',
    'automatic',
    true
)
ON CONFLICT (slug, office_id, pipeline_stage) DO UPDATE 
SET system_prompt = EXCLUDED.system_prompt, model = EXCLUDED.model;

-- 2. nija-judge-simulation
INSERT INTO public.ai_agent_configs (slug, friendly_name, description, provider, model, temperature, max_tokens, system_prompt, mode, is_active)
VALUES (
    'nija-judge-simulation',
    'Juiz IA (Simulador)',
    'Simula decisão judicial com base em peça, dossiê e tendência jurisprudencial.',
    'google',
    'google/gemini-2.0-pro-exp-02-05',
    0.1,
    4096,
    'Você é um MAGISTRADO SENIOR com 30 anos de carreira, especializado em análise de risco e probabilidade judicial. Sua missão é auditar a peça jurídica e o dossiê, gerando scores técnicos para o SISTEMA DE PROBABILIDADE DO FLAITO.',
    'automatic',
    true
)
ON CONFLICT (slug, office_id, pipeline_stage) DO UPDATE 
SET system_prompt = EXCLUDED.system_prompt, model = EXCLUDED.model;

-- 3. lexos-chat-assistant (Athena)
INSERT INTO public.ai_agent_configs (slug, friendly_name, description, provider, model, temperature, max_tokens, system_prompt, mode, is_active)
VALUES (
    'lexos-chat-assistant',
    'Athena Chat Assistant',
    'Assistente operacional full-stack para advogados e médicos.',
    'google',
    'google/gemini-2.5-flash',
    0.7,
    4096,
    'Você é a ATHENA, assistente jurídica inteligente do sistema Flaito. Seu papel é auxiliar advogados com precisão técnica, objetividade e responsabilidade.',
    'automatic',
    true
)
ON CONFLICT (slug, office_id, pipeline_stage) DO UPDATE 
SET system_prompt = EXCLUDED.system_prompt;

-- 4. voice-assistant
INSERT INTO public.ai_agent_configs (slug, friendly_name, description, provider, model, temperature, max_tokens, system_prompt, mode, is_active)
VALUES (
    'voice-assistant',
    'Voz da Athena',
    'Interface vocal direta para operações rápidas e navegação por voz.',
    'openai',
    'openai/gpt-4o-mini',
    0.1,
    4096,
    'Você é a ATHENA, operadora e assistente virtual avançada do sistema Flaito. Você deve ser clara, profissional, direta nas respostas e focada em executar tools.',
    'automatic',
    true
)
ON CONFLICT (slug, office_id, pipeline_stage) DO UPDATE 
SET system_prompt = EXCLUDED.system_prompt;

-- 5. nija-full-analysis
INSERT INTO public.ai_agent_configs (slug, friendly_name, description, provider, model, temperature, max_tokens, system_prompt, mode, is_active)
VALUES (
    'nija-full-analysis',
    'Análise Integrada (Full)',
    'Módulo de análise completa de processos e detecção de riscos.',
    'google',
    'google/gemini-2.5-flash',
    0.7,
    8192,
    'Você é o NIJA_FULL_ANALYSIS, o módulo de ANÁLISE COMPLETA do LEXOS. OBJETIVO: Ler o TEXTO INTEGRAL do processo e identificar fatos, vícios e estratégias.',
    'automatic',
    true
)
ON CONFLICT (slug, office_id, pipeline_stage) DO UPDATE 
SET system_prompt = EXCLUDED.system_prompt;
