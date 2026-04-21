-- Migration: Add Z-API specific fields to notificacao_config
-- Date: 2026-03-20

ALTER TABLE public.notificacao_config 
ADD COLUMN IF NOT EXISTS whatsapp_instance_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_client_token TEXT;

-- Comments for documentation
COMMENT ON COLUMN public.notificacao_config.whatsapp_instance_id IS 'Instance ID provided by Z-API';
COMMENT ON COLUMN public.notificacao_config.whatsapp_client_token IS 'Security Client Token provided by Z-API';
