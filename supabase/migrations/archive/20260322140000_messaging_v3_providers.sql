-- Migration: Messaging Evolution V3 (Providers, Idempotence, Broadcast)
-- Date: 2026-03-22
-- Author: Antigravity

-- 1. notificacao_config: add provider_type
ALTER TABLE public.notificacao_config 
ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'NON_OFFICIAL_PROVIDER' CHECK (provider_type IN ('META_OFFICIAL_PROVIDER', 'NON_OFFICIAL_PROVIDER'));

COMMENT ON COLUMN public.notificacao_config.api_token IS 'Bearer Token for Meta OR Instance Token for Z-API';
COMMENT ON COLUMN public.notificacao_config.whatsapp_instance_id IS 'Phone Number ID for Meta OR Instance ID for Z-API';

-- 2. automation_runs: table for idempotency
CREATE TABLE IF NOT EXISTS public.automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL, -- Logical ID of the resource (e.g. appointment_id, report_id)
    executed_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_rule_resource UNIQUE (rule_id, resource_id)
);

-- RLS for automation_runs
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view automation runs of their office rules" ON public.automation_runs
    FOR SELECT USING (
        rule_id IN (
            SELECT id FROM public.automation_rules 
            WHERE office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- 3. message_templates: Meta approval status
ALTER TABLE public.message_templates
ADD COLUMN IF NOT EXISTS provider_status TEXT DEFAULT 'APPROVED' CHECK (provider_status IN ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'));

-- 4. broadcast_campaigns: Batch sending base schema
CREATE TABLE IF NOT EXISTS public.broadcast_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    context_type TEXT NOT NULL CHECK (context_type IN ('LEGAL', 'MEDICAL')),
    template_id UUID NOT NULL REFERENCES public.message_templates(id),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED', 'PAUSED')),
    audience_filters JSONB DEFAULT '{}'::jsonb,
    total_recipients INTEGER DEFAULT 0,
    processed_count INTEGER DEFAULT 0,
    scheduled_for TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for broadcast_campaigns
ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage broadcast campaigns of their office" ON public.broadcast_campaigns
    FOR ALL USING (
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
    );
