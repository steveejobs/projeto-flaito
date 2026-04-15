-- Migration: Messaging Global Context & Fallback
-- Date: 2026-03-25
-- Author: Antigravity

-- 1. Update check constraints to allow 'GLOBAL'
ALTER TABLE public.notificacao_config 
DROP CONSTRAINT IF EXISTS notificacao_config_context_type_check;

ALTER TABLE public.notificacao_config 
ADD CONSTRAINT notificacao_config_context_type_check 
CHECK (context_type IN ('LEGAL', 'MEDICAL', 'GLOBAL'));

ALTER TABLE public.notificacoes_fila 
DROP CONSTRAINT IF EXISTS notificacoes_fila_context_type_check;

ALTER TABLE public.notificacoes_fila 
ADD CONSTRAINT notificacoes_fila_context_type_check 
CHECK (context_type IN ('LEGAL', 'MEDICAL', 'GLOBAL'));

-- 2. Update default context for fila if needed
ALTER TABLE public.notificacoes_fila 
ALTER COLUMN context_type SET DEFAULT 'GLOBAL';

-- 3. Broadcast campaigns also should support GLOBAL
ALTER TABLE public.broadcast_campaigns 
DROP CONSTRAINT IF EXISTS broadcast_campaigns_context_type_check;

ALTER TABLE public.broadcast_campaigns 
ADD CONSTRAINT broadcast_campaigns_context_type_check 
CHECK (context_type IN ('LEGAL', 'MEDICAL', 'GLOBAL'));

-- 4. Template context support for GLOBAL
ALTER TABLE public.message_templates 
DROP CONSTRAINT IF EXISTS message_templates_context_type_check;

ALTER TABLE public.message_templates 
ADD CONSTRAINT message_templates_context_type_check 
CHECK (context_type IN ('LEGAL', 'MEDICAL', 'GLOBAL'));

-- 5. Comments
COMMENT ON COLUMN public.notificacao_config.context_type IS 'Context of the instance: LEGAL, MEDICAL or GLOBAL (Fallback)';
