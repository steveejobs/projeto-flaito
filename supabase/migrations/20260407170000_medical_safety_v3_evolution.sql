-- Migration: 20260407170000_medical_safety_v3_evolution.sql
-- Description: Evolução da auditoria para Clinical Decision Safety Engine V3 context-aware.

ALTER TABLE public.medical_safety_audits 
ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.pacientes(id),
ADD COLUMN IF NOT EXISTS channel TEXT, -- ui, voice, internal_api, patient_portal, whatsapp, report_export
ADD COLUMN IF NOT EXISTS clinical_context TEXT, -- analysis_mode, consultation_mode, triage_mode, administrative_mode, voice_quick_action, patient_self_view, medical_review_queue
ADD COLUMN IF NOT EXISTS confidence_band TEXT, -- low, medium, high
ADD COLUMN IF NOT EXISTS data_completeness TEXT, -- insufficient, partial, sufficient, rich
ADD COLUMN IF NOT EXISTS data_completeness_score NUMERIC(4,3),
ADD COLUMN IF NOT EXISTS missing_fields TEXT[],
ADD COLUMN IF NOT EXISTS downgraded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS downgrade_reason TEXT,
ADD COLUMN IF NOT EXISTS actor_role TEXT,
ADD COLUMN IF NOT EXISTS consent_status BOOLEAN,
ADD COLUMN IF NOT EXISTS decision_trace TEXT[],
ADD COLUMN IF NOT EXISTS flags TEXT[];

-- Comentários para documentação de schema
COMMENT ON COLUMN public.medical_safety_audits.channel IS 'Canal de origem da solicitação (ui, voice, whatsapp, etc)';
COMMENT ON COLUMN public.medical_safety_audits.clinical_context IS 'Contexto clínico de execução (consultation, triage, etc)';
COMMENT ON COLUMN public.medical_safety_audits.confidence_band IS 'Classificação da confiança da IA (low, medium, high)';
COMMENT ON COLUMN public.medical_safety_audits.data_completeness IS 'Nível de completude dos dados informados';
COMMENT ON COLUMN public.medical_safety_audits.decision_trace IS 'Log passo-a-passo da decisão do motor de segurança';

-- Índice para busca por canal e contexto
CREATE INDEX IF NOT EXISTS idx_safety_audits_channel_context ON public.medical_safety_audits(channel, clinical_context);
CREATE INDEX IF NOT EXISTS idx_safety_audits_patient_id ON public.medical_safety_audits(patient_id);
