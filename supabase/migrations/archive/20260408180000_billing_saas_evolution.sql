-- Migration: 20260408180000_billing_saas_evolution.sql
-- Goal: SaaS Multi-tenancy, Credential Security and AI Forensic Governance

-- ============================================
-- 1. Estender billing_configs para Criptografia
-- ============================================
CREATE TABLE IF NOT EXISTS public.billing_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    enabled boolean NOT NULL DEFAULT false,
    environment text NOT NULL DEFAULT 'sandbox',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_office_billing_config_base UNIQUE (office_id)
);

ALTER TABLE public.billing_configs 
    ADD COLUMN IF NOT EXISTS asaas_api_key_encrypted text,
    ADD COLUMN IF NOT EXISTS encryption_iv text;

COMMENT ON COLUMN public.billing_configs.asaas_api_key_encrypted IS 'Chave de API do Asaas cifrada com AES-256-GCM';

-- ============================================
-- 2. office_ai_policies - Governança por Escritório
-- ============================================
CREATE TABLE IF NOT EXISTS public.office_ai_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    forensic_mode_enabled boolean NOT NULL DEFAULT true,
    multi_stage_generation_enabled boolean NOT NULL DEFAULT true,
    block_unreviewed_output boolean NOT NULL DEFAULT true,
    max_refinement_attempts integer NOT NULL DEFAULT 2 CHECK (max_refinement_attempts BETWEEN 1 AND 5),
    low_temperature_mode boolean NOT NULL DEFAULT true,
    strict_grammar_check boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_office_ai_policy UNIQUE (office_id)
);

ALTER TABLE public.office_ai_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Office AI Policy: Select for members" ON public.office_ai_policies
    FOR SELECT USING (
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "Office AI Policy: Admin update" ON public.office_ai_policies
    FOR UPDATE USING (
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OWNER') AND is_active = true)
    );

-- ============================================
-- 3. ai_validation_logs - Telemetria do Pipeline Forense
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_validation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    piece_type text NOT NULL,
    request_id text,
    draft_version text NOT NULL, -- Rascunho Bruto
    final_version text,          -- Versão Entregue
    validation_passed boolean NOT NULL DEFAULT false,
    validation_scores jsonb NOT NULL DEFAULT '{}',
    issues_detected jsonb DEFAULT '[]',
    refinement_attempts integer DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_validation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI Validation Logs: Select for members" ON public.ai_validation_logs
    FOR SELECT USING (
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
    );

-- Index para auditoria rápida
CREATE INDEX idx_ai_val_logs_office_created ON public.ai_validation_logs(office_id, created_at DESC);

-- ============================================
-- 4. ai_error_rules - Memória Progressiva de Erro
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_error_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE, -- NULL significa REGRA GLOBAL
    rule_key text NOT NULL,
    rule_description text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_from_validation_log_id uuid REFERENCES public.ai_validation_logs(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_error_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI Error Rules: Select Global or Office" ON public.ai_error_rules
    FOR SELECT USING (
        office_id IS NULL OR 
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
    );

-- ============================================
-- 5. saas_quotas - Controle de Consumo B2B
-- ============================================
CREATE TABLE IF NOT EXISTS public.saas_quotas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    legal_pieces_limit integer NOT NULL DEFAULT 20,
    legal_pieces_used integer NOT NULL DEFAULT 0,
    medical_analysis_limit integer NOT NULL DEFAULT 10,
    medical_analysis_used integer NOT NULL DEFAULT 0,
    forensic_reviews_count integer DEFAULT 0,
    refinement_cycles_count integer DEFAULT 0,
    billing_cycle_start date NOT NULL DEFAULT current_date,
    billing_cycle_end date NOT NULL DEFAULT (current_date + interval '1 month'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_office_quota UNIQUE (office_id)
);

ALTER TABLE public.saas_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SaaS Quotas: Select for members" ON public.saas_quotas
    FOR SELECT USING (
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
    );

-- ============================================
-- 6. Seed Inicial de Políticas e Quotas
-- ============================================
INSERT INTO public.office_ai_policies (office_id)
SELECT id FROM public.offices
ON CONFLICT (office_id) DO NOTHING;

INSERT INTO public.saas_quotas (office_id)
SELECT id FROM public.offices
ON CONFLICT (office_id) DO NOTHING;
