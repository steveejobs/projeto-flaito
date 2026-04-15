-- Migration: Messaging Context Separation
-- Date: 2026-03-22
-- Author: Antigravity (Architect)

-- 1. Add context_type to notificacao_config
ALTER TABLE public.notificacao_config 
ADD COLUMN IF NOT EXISTS context_type TEXT CHECK (context_type IN ('LEGAL', 'MEDICAL'));

-- 2. Update existing data for notificacao_config
UPDATE public.notificacao_config SET context_type = 'MEDICAL' WHERE context_type IS NULL;

-- 3. Update constraints for notificacao_config
-- First, drop the unique constraint on office_id if it exists
DO $$ 
BEGIN 
    ALTER TABLE public.notificacao_config DROP CONSTRAINT IF EXISTS notificacao_config_office_id_key;
EXCEPTION 
    WHEN undefined_object THEN NULL; 
END $$;

-- Add new composite unique constraint
ALTER TABLE public.notificacao_config 
ADD CONSTRAINT notificacao_config_office_context_key UNIQUE (office_id, context_type);

-- Make context_type NOT NULL after migration
ALTER TABLE public.notificacao_config ALTER COLUMN context_type SET NOT NULL;

-- 4. Add context_type to notificacoes_fila
ALTER TABLE public.notificacoes_fila 
ADD COLUMN IF NOT EXISTS context_type TEXT CHECK (context_type IN ('LEGAL', 'MEDICAL'));

-- Update existing data in queue
UPDATE public.notificacoes_fila 
SET context_type = CASE 
    WHEN resource_type IN ('CASE') THEN 'LEGAL'
    ELSE 'MEDICAL'
END
WHERE context_type IS NULL;

-- 5. Add context_type to message_templates
ALTER TABLE public.message_templates 
ADD COLUMN IF NOT EXISTS context_type TEXT CHECK (context_type IN ('LEGAL', 'MEDICAL'));

-- Update existing templates
UPDATE public.message_templates 
SET context_type = CASE 
    WHEN category_id = 'LEGAL' THEN 'LEGAL'
    ELSE 'MEDICAL'
END
WHERE context_type IS NULL;

-- 6. Add context_type to automation_rules
ALTER TABLE public.automation_rules 
ADD COLUMN IF NOT EXISTS context_type TEXT CHECK (context_type IN ('LEGAL', 'MEDICAL'));

-- Update existing rules
UPDATE public.automation_rules 
SET context_type = CASE 
    WHEN resource_type IN ('CASE') THEN 'LEGAL'
    ELSE 'MEDICAL'
END
WHERE context_type IS NULL;

-- 7. Ensure message_logs has the correct column (it already has origin_context from a previous migration)
-- But let's ensure it's not null and has the right values
ALTER TABLE public.message_logs 
ALTER COLUMN origin_context SET DEFAULT 'MEDICAL';

UPDATE public.message_logs SET origin_context = 'MEDICAL' WHERE origin_context IS NULL;

-- 8. RLS Policies refinement
-- Ensure policies allow access based on office_id (already done, context_type doesn't change ownership)

-- Comments
COMMENT ON COLUMN public.notificacao_config.context_type IS 'Context of the WhatsApp instance (LEGAL or MEDICAL)';
COMMENT ON COLUMN public.notificacoes_fila.context_type IS 'Target context instance for this notification';
COMMENT ON COLUMN public.message_templates.context_type IS 'Context where this template is available';
COMMENT ON COLUMN public.automation_rules.context_type IS 'Context that owns this automation rule';
