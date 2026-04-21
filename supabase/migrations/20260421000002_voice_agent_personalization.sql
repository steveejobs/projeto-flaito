-- Migração: Adicionar Personalização ao Agente de Voz
-- Permite configurar Nome e Personalidade (Prompt) por usuário/escritório

ALTER TABLE public.user_voice_settings 
ADD COLUMN IF NOT EXISTS agent_name TEXT DEFAULT 'Flaito',
ADD COLUMN IF NOT EXISTS agent_personality TEXT DEFAULT 'Você é o Assistente Inteligente da Flaito. Seja prestativo, objetivo e fale em Português do Brasil.';

COMMENT ON COLUMN public.user_voice_settings.agent_name IS 'O nome pelo qual o agente se identifica e responde.';
COMMENT ON COLUMN public.user_voice_settings.agent_personality IS 'O tom de voz e diretrizes de comportamento do agente (System Prompt).';
