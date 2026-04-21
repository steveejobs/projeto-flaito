-- 20260408180000_saas_platform_integrations.sql
-- Infraestrutura para Billing Multi-Tenant e Camada de Plataforma SaaS

-- ============================================
-- 1. office_billing_integrations
-- Armazena credenciais (criptografadas) e modos de operação por tenant
-- ============================================
CREATE TABLE IF NOT EXISTS public.office_billing_integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'asaas',
    mode text NOT NULL CHECK (mode IN ('platform_master', 'tenant_key', 'subaccount')),
    
    -- Credenciais (Serão salvas criptografadas pelo backend)
    encrypted_api_key text,
    asaas_account_id text, -- ID da conta no provedor para validação de webhook
    webhook_secret text,    -- Secret específico para este tenant
    
    -- Controle de Versionamento e Estado
    is_active boolean NOT NULL DEFAULT true,
    rotated_from_id uuid REFERENCES public.office_billing_integrations(id) ON DELETE SET NULL,
    is_sandbox boolean NOT NULL DEFAULT true,
    
    status text NOT NULL DEFAULT 'pending_validation' 
        CHECK (status IN ('pending_validation', 'active', 'invalid', 'revoked')),
    
    operational_health text NOT NULL DEFAULT 'valid'
        CHECK (operational_health IN ('valid', 'invalid', 'expired', 'warning')),
    
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index para busca rápida por conta do provedor (essencial para webhooks multi-tenant)
CREATE INDEX IF NOT EXISTS idx_billing_integrations_account ON public.office_billing_integrations(asaas_account_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_billing_integrations_active_tenant ON public.office_billing_integrations(office_id, provider) WHERE is_active = true;

-- ============================================
-- 2. office_billing_usage_logs
-- Auditoria rigorosa de qual credencial foi usada e por quem
-- ============================================
CREATE TABLE IF NOT EXISTS public.office_billing_usage_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    integration_id uuid REFERENCES public.office_billing_integrations(id) ON DELETE SET NULL,
    context text NOT NULL CHECK (context IN ('saas_billing', 'office_operational')),
    operation text NOT NULL, -- 'create_payment', 'refund', 'webhook_event', 'validate_key'
    used_in_function text,   -- Nome da Edge Function
    provider text NOT NULL,
    status text NOT NULL,    -- 'SUCCESS', 'DENIED', 'ERROR'
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_usage_logs_office ON public.office_billing_usage_logs(office_id, created_at DESC);

-- ============================================
-- 3. Automation: Status and Timestamps
-- ============================================

-- Garantir que apenas uma integração por (office, provider) esteja ativa
CREATE OR REPLACE FUNCTION public.ensure_single_active_integration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = true THEN
        UPDATE public.office_billing_integrations
        SET is_active = false, updated_at = now()
        WHERE office_id = NEW.office_id 
          AND provider = NEW.provider 
          AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_active_integration
    BEFORE INSERT OR UPDATE ON public.office_billing_integrations
    FOR EACH ROW EXECUTE FUNCTION public.ensure_single_active_integration();


-- Trigger para Updated At (Garante que exista localmente nesta migração)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_office_billing_integrations_updated_at
    BEFORE UPDATE ON public.office_billing_integrations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. RLS - Segurança Multi-Tenant
-- ============================================

ALTER TABLE public.office_billing_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_billing_usage_logs ENABLE ROW LEVEL SECURITY;

-- Integrations: Apenas OWNER e ADMIN do próprio escritório
CREATE POLICY "billing_integrations_admin_access"
    ON public.office_billing_integrations
    FOR ALL
    USING (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid()
            AND role IN ('ADMIN', 'OWNER')
            AND is_active = true
        )
    );

-- Usage Logs: Leitura para membros do escritório, escrita via Service Role (Edge Functions)
CREATE POLICY "billing_usage_logs_select"
    ON public.office_billing_usage_logs
    FOR SELECT
    USING (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid()
            AND is_active = true
        )
    );

-- ============================================
-- 5. Baseline: Migrar tenants existentes para Platform Master (Pending)
-- ============================================
INSERT INTO public.office_billing_integrations (office_id, mode, status, is_sandbox)
SELECT 
    id, 
    'platform_master', 
    'pending_validation',
    true
FROM public.offices
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.office_billing_integrations IS 'Integrações de billing multi-tenant com versionamento e criptografia at-rest.';
COMMENT ON TABLE public.office_billing_usage_logs IS 'Log de auditoria de uso de credenciais de faturamento por contexto.';
