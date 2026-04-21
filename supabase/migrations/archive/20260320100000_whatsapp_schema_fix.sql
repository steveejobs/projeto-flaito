-- Migration: WhatsApp Schema Fix (2026-03-20)
-- Adds missing columns required by the scheduler and standardizes names

-- 1. Add missing columns to notificacao_config
ALTER TABLE public.notificacao_config 
ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS template_lembrete TEXT DEFAULT 'Olá {paciente}, lembramos da sua consulta no dia {data} às {hora} na {clinica}.';

-- 2. Synchronize existing data
-- Map whatsapp_habilitado to enabled for backward compatibility
UPDATE public.notificacao_config 
SET enabled = whatsapp_habilitado 
WHERE enabled IS FALSE AND whatsapp_habilitado IS TRUE;

-- 3. Comment on columns for clarity
COMMENT ON COLUMN public.notificacao_config.enabled IS 'Geral switch for all notifications in this office';
COMMENT ON COLUMN public.notificacao_config.template_lembrete IS 'Custom WhatsApp message template for appointments';
