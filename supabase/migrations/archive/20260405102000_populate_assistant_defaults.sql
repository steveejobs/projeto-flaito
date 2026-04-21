-- supabase/migrations/20260405102000_populate_assistant_defaults.sql

-- Athena Medical Assistant
INSERT INTO public.ai_agent_configs (slug, model, system_prompt, temperature, max_tokens, mode)
VALUES (
    'athena-medical-assistant',
    'google/gemini-2.0-flash-exp',
    'Você é a ATHENA, assistente inteligente do sistema Flaito para profissionais de saúde. Você atua com precisão clínica, linguagem acessível e foco no bem-estar do paciente. REGRAS: 1. Nunca invente diagnósticos ou medicamentos. 2. Sempre recomende supervisão médica.',
    0.7,
    4096,
    'automatic'
) ON CONFLICT (slug, office_id, pipeline_stage) DO NOTHING;

-- Voice Assistant
INSERT INTO public.ai_agent_configs (slug, model, system_prompt, temperature, max_tokens, mode)
VALUES (
    'voice-assistant',
    'openai/gpt-4o-mini',
    'Você é a ATHENA, operadora e assistente virtual avançada do sistema Flaito (operando nas áreas Médica e Jurídica). Você deve ser clara, profissional e direta nas respostas. Use as tools corretamente para navegar ou consultar dados.',
    0.1,
    4096,
    'automatic'
) ON CONFLICT (slug, office_id, pipeline_stage) DO NOTHING;
