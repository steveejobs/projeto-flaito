-- Migration: 20260409020000_medical_pro_evolution.sql
-- Description: Evolução do Motor Médico para suporte a laudos completos, revisão ativa e assinatura profissional.

-- 1. Novos Tipos e Enums
DO $$ BEGIN
    CREATE TYPE medical_report_status AS ENUM (
        'ai_draft', 
        'under_medical_review', 
        'approved_signed', 
        'approved_with_edits', 
        'rejected'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE professional_signature_mode AS ENUM (
        'handwritten', 
        'uploaded_image', 
        'text_only'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Expansão de user_medical_settings
ALTER TABLE public.user_medical_settings 
ADD COLUMN IF NOT EXISTS title_prefix TEXT,
ADD COLUMN IF NOT EXISTS full_name_override TEXT,
ADD COLUMN IF NOT EXISTS professional_license_display TEXT,
ADD COLUMN IF NOT EXISTS signature_mode professional_signature_mode DEFAULT 'text_only',
ADD COLUMN IF NOT EXISTS signature_asset_path TEXT,
ADD COLUMN IF NOT EXISTS signature_version UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS signature_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stamp_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS default_report_template_id UUID;

COMMENT ON COLUMN public.user_medical_settings.professional_license_display IS 'Exibição formatada do conselho (ex: CRM/SP 123456).';
COMMENT ON COLUMN public.user_medical_settings.signature_asset_path IS 'Caminho do arquivo de assinatura no bucket signatures.';

-- 3. Expansão de governance_reports para Fluxo Médico
ALTER TABLE public.governance_reports 
ADD COLUMN IF NOT EXISTS status medical_report_status DEFAULT 'ai_draft',
ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_time_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sections_viewed JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS was_edited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS report_version_hash TEXT,
ADD COLUMN IF NOT EXISTS template_id UUID,
ADD COLUMN IF NOT EXISTS template_version TEXT,
ADD COLUMN IF NOT EXISTS template_snapshot JSONB,
ADD COLUMN IF NOT EXISTS template_hash TEXT,
ADD COLUMN IF NOT EXISTS signature_version_used UUID,
ADD COLUMN IF NOT EXISTS signed_hash TEXT,
ADD COLUMN IF NOT EXISTS ai_model_used TEXT,
ADD COLUMN IF NOT EXISTS ai_original_blocks JSONB,
ADD COLUMN IF NOT EXISTS ai_original_hash TEXT,
ADD COLUMN IF NOT EXISTS edited_blocks JSONB,
ADD COLUMN IF NOT EXISTS review_quality_flag TEXT;

COMMENT ON COLUMN public.governance_reports.template_snapshot IS 'Cópia integral do template no momento da assinatura para imutabilidade visual.';
COMMENT ON COLUMN public.governance_reports.signed_hash IS 'Hash criptográfico final do laudo oficializado.';

-- 4. Índices de Auditoria
CREATE INDEX IF NOT EXISTS idx_gov_reports_status ON public.governance_reports(status);
CREATE INDEX IF NOT EXISTS idx_gov_reports_signed_hash ON public.governance_reports(signed_hash) WHERE signed_hash IS NOT NULL;

-- 5. RLS Adicional (Segurança de Assinatura)
-- Garante que um usuário só pode configurar sua própria assinatura
CREATE POLICY "Users can only update their own signature" ON public.user_medical_settings
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
