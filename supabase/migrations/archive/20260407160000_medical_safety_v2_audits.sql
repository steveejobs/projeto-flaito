-- Migration: 20260407160000_medical_safety_v2_audits.sql
-- Description: Auditoria expandida para Deep Content Guard V2 com capacidades granulares.

CREATE TABLE IF NOT EXISTS public.medical_safety_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id),
    user_id UUID REFERENCES auth.users(id),
    function_slug TEXT NOT NULL,
    requested_capability TEXT NOT NULL, -- observational_summary, clinical_hypothesis, diagnostic_opinion, treatment_suggestion
    effective_capability TEXT NOT NULL,
    audience TEXT NOT NULL DEFAULT 'professional', -- professional, patient
    user_role TEXT, -- Role do usuário no momento da ação
    raw_content TEXT NOT NULL,
    sanitized_content TEXT,
    intent_detected TEXT, -- diagnostic, prescriptive, etc.
    confidence NUMERIC(4,3),
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    requires_review BOOLEAN NOT NULL DEFAULT TRUE,
    decision_logic JSONB, -- { "reason": "...", "policy": "..." }
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.medical_safety_audits ENABLE ROW LEVEL SECURITY;

-- Apenas admins do office ou service_role podem ver logs de segurança
CREATE POLICY "Admins can view safety audits for their office"
ON public.medical_safety_audits
FOR SELECT
USING (
    auth.jwt() ->> 'role' = 'service_role' 
    OR EXISTS (
        SELECT 1 FROM public.office_members
        WHERE office_member_office_id = public.medical_safety_audits.office_id
        AND office_member_user_id = auth.uid()
        AND office_member_role IN ('owner', 'admin')
    )
);

-- Permissão para inserir logs (qualquer função autenticada)
CREATE POLICY "Allow authenticated insert for safety audits"
ON public.medical_safety_audits
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Índices para análise e relatórios
CREATE INDEX IF NOT EXISTS idx_safety_audits_office_blocked ON public.medical_safety_audits(office_id, blocked);
CREATE INDEX IF NOT EXISTS idx_safety_audits_intent ON public.medical_safety_audits(intent_detected);
