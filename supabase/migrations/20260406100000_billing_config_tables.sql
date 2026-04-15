-- Billing Configuration Tables
-- Phase 1: Foundation for configurable Asaas billing

-- ============================================
-- 1. billing_configs - Configuração principal por escritório
-- ============================================
CREATE TABLE IF NOT EXISTS public.billing_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    enabled boolean NOT NULL DEFAULT true,
    environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
    default_billing_type text NOT NULL DEFAULT 'BOLETO' CHECK (default_billing_type IN ('BOLETO', 'PIX', 'CREDIT_CARD')),
    default_due_days int NOT NULL DEFAULT 5 CHECK (default_due_days BETWEEN 1 AND 90),
    default_description_template text DEFAULT 'Serviço: {{service}} - Cliente: {{client_name}}',
    require_manual_approval boolean NOT NULL DEFAULT false,
    auto_send_after_approval boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id),
    CONSTRAINT unique_office_billing_config UNIQUE (office_id)
);

COMMENT ON TABLE public.billing_configs IS 'Configuração de cobrança Asaas por escritório';
COMMENT ON COLUMN public.billing_configs.environment IS 'sandbox ou production - define qual endpoint Asaas usar';
COMMENT ON COLUMN public.billing_configs.default_description_template IS 'Template com placeholders: {{service}}, {{client_name}}, {{case_title}}, {{date}}';

-- ============================================
-- 2. billing_plans - Planos/serviços configuráveis
-- ============================================
CREATE TABLE IF NOT EXISTS public.billing_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    value numeric(10,2) NOT NULL CHECK (value > 0),
    billing_type text CHECK (billing_type IN ('BOLETO', 'PIX', 'CREDIT_CARD')),
    due_days int CHECK (due_days BETWEEN 1 AND 90),
    recurrence text CHECK (recurrence IN ('NONE', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
    active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.billing_plans IS 'Planos e serviços configuráveis para cobrança';

-- ============================================
-- 3. billing_rules - Regras avançadas de cobrança
-- ============================================
CREATE TABLE IF NOT EXISTS public.billing_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    rule_type text NOT NULL CHECK (rule_type IN ('VALUE_LIMIT', 'DUE_DATE_POLICY', 'BLOCK_DUPLICATE', 'AUTO_OVERDUE_ACTION')),
    config_json jsonb NOT NULL DEFAULT '{}',
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.billing_rules IS 'Regras avançadas de cobrança (limites, políticas, bloqueios)';
COMMENT ON COLUMN public.billing_rules.config_json IS 'Configuração específica por tipo de regra. Ex VALUE_LIMIT: {"min_value": 50, "max_value": 50000}';

-- ============================================
-- 4. charge_approvals - Fila de aprovação manual
-- ============================================
CREATE TABLE IF NOT EXISTS public.charge_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
    case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
    plan_id uuid REFERENCES public.billing_plans(id) ON DELETE SET NULL,
    value numeric(10,2) NOT NULL CHECK (value > 0),
    description text NOT NULL,
    billing_type text NOT NULL CHECK (billing_type IN ('BOLETO', 'PIX', 'CREDIT_CARD')),
    due_date date NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SENT_TO_ASAAS')),
    requested_by uuid REFERENCES auth.users(id),
    approved_by uuid REFERENCES auth.users(id),
    approved_at timestamptz,
    rejection_reason text,
    asaas_payment_id text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.charge_approvals IS 'Fila de aprovação manual de cobranças';

-- ============================================
-- 5. billing_config_history - Audit trail
-- ============================================
CREATE TABLE IF NOT EXISTS public.billing_config_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    config_id uuid NOT NULL REFERENCES public.billing_configs(id) ON DELETE CASCADE,
    changed_by uuid REFERENCES auth.users(id),
    change_type text NOT NULL CHECK (change_type IN ('CREATED', 'UPDATED', 'TOGGLED', 'KEY_ROTATED')),
    old_value jsonb,
    new_value jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.billing_config_history IS 'Histórico de alterações nas configurações de cobrança';

-- ============================================
-- 6. Adicionar colunas de vínculo ao asaas_payments existente
-- ============================================
ALTER TABLE public.asaas_payments
    ADD COLUMN IF NOT EXISTS billing_config_id uuid REFERENCES public.billing_configs(id),
    ADD COLUMN IF NOT EXISTS approval_id uuid REFERENCES public.charge_approvals(id),
    ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.billing_plans(id);

-- ============================================
-- 7. Indexes para performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_billing_configs_office ON public.billing_configs(office_id);
CREATE INDEX IF NOT EXISTS idx_billing_plans_office ON public.billing_plans(office_id);
CREATE INDEX IF NOT EXISTS idx_billing_plans_active ON public.billing_plans(office_id, active);
CREATE INDEX IF NOT EXISTS idx_billing_rules_office ON public.billing_rules(office_id, active);
CREATE INDEX IF NOT EXISTS idx_charge_approvals_office ON public.charge_approvals(office_id);
CREATE INDEX IF NOT EXISTS idx_charge_approvals_status ON public.charge_approvals(office_id, status);
CREATE INDEX IF NOT EXISTS idx_charge_approvals_created ON public.charge_approvals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_config_history_config ON public.billing_config_history(config_id);
CREATE INDEX IF NOT EXISTS idx_billing_config_history_office ON public.billing_config_history(office_id, created_at DESC);

-- ============================================
-- 8. Trigger para updated_at automático
-- ============================================
CREATE OR REPLACE FUNCTION public.update_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_billing_configs_updated_at
    BEFORE UPDATE ON public.billing_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_billing_updated_at();

CREATE TRIGGER trg_billing_plans_updated_at
    BEFORE UPDATE ON public.billing_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_billing_updated_at();

-- ============================================
-- 9. Trigger para audit trail automático
-- ============================================
CREATE OR REPLACE FUNCTION public.audit_billing_config_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.billing_config_history (
        office_id,
        config_id,
        changed_by,
        change_type,
        old_value,
        new_value
    ) VALUES (
        NEW.office_id,
        NEW.id,
        COALESCE(NEW.updated_by, auth.uid()),
        CASE
            WHEN TG_OP = 'INSERT' THEN 'CREATED'
            WHEN OLD.enabled != NEW.enabled THEN 'TOGGLED'
            ELSE 'UPDATED'
        END,
        CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb END,
        row_to_json(NEW)::jsonb
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_billing_config_audit
    AFTER INSERT OR UPDATE ON public.billing_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_billing_config_change();

-- ============================================
-- 10. RLS Policies
-- ============================================

-- billing_configs
ALTER TABLE public.billing_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_configs_select_office_members"
    ON public.billing_configs FOR SELECT
    USING (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "billing_configs_insert_admin"
    ON public.billing_configs FOR INSERT
    WITH CHECK (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid()
            AND role IN ('ADMIN', 'OWNER')
            AND status = 'active'
        )
    );

CREATE POLICY "billing_configs_update_admin"
    ON public.billing_configs FOR UPDATE
    USING (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid()
            AND role IN ('ADMIN', 'OWNER')
            AND status = 'active'
        )
    );

-- billing_plans
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_plans_select_office_members"
    ON public.billing_plans FOR SELECT
    USING (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "billing_plans_insert_admin"
    ON public.billing_plans FOR INSERT
    WITH CHECK (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid()
            AND role IN ('ADMIN', 'OWNER')
            AND status = 'active'
        )
    );

CREATE POLICY "billing_plans_update_admin"
    ON public.billing_plans FOR UPDATE
    USING (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid()
            AND role IN ('ADMIN', 'OWNER')
            AND status = 'active'
        )
    );

CREATE POLICY "billing_plans_delete_admin"
    ON public.billing_plans FOR DELETE
    USING (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid()
            AND role IN ('ADMIN', 'OWNER')
            AND status = 'active'
        )
    );

-- billing_rules
ALTER TABLE public.billing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_rules_select_office_members"
    ON public.billing_rules FOR SELECT
    USING (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "billing_rules_admin_write"
    ON public.billing_rules FOR ALL
    USING (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid()
            AND role IN ('ADMIN', 'OWNER')
            AND status = 'active'
        )
    );

-- charge_approvals
ALTER TABLE public.charge_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charge_approvals_select_office_members"
    ON public.charge_approvals FOR SELECT
    USING (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "charge_approvals_insert_members"
    ON public.charge_approvals FOR INSERT
    WITH CHECK (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
        AND requested_by = auth.uid()
    );

CREATE POLICY "charge_approvals_update_admin"
    ON public.charge_approvals FOR UPDATE
    USING (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid()
            AND role IN ('ADMIN', 'OWNER')
            AND status = 'active'
        )
    );

-- billing_config_history (read-only)
ALTER TABLE public.billing_config_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_config_history_select_office_members"
    ON public.billing_config_history FOR SELECT
    USING (
        office_id IN (
            SELECT office_id FROM public.office_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- billing_config_history is INSERT-only via trigger (SECURITY DEFINER), no direct INSERT policy needed

-- ============================================
-- 11. Helper function: resolve environment URL
-- ============================================
CREATE OR REPLACE FUNCTION public.get_asaas_base_url(environment text)
RETURNS text AS $$
BEGIN
    CASE environment
        WHEN 'sandbox' THEN RETURN 'https://sandbox.asaas.com/api/v3';
        WHEN 'production' THEN RETURN 'https://api.asaas.com/v3';
        ELSE RETURN 'https://sandbox.asaas.com/api/v3';
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.get_asaas_base_url IS 'Retorna a URL base do Asaas baseada no ambiente';

-- ============================================
-- 12. Seed: criar config padrão para offices existentes
-- ============================================
INSERT INTO public.billing_configs (office_id, enabled, environment, default_billing_type, default_due_days, default_description_template)
SELECT
    id,
    false, -- starts disabled until API key is configured
    'sandbox',
    'BOLETO',
    5,
    'Serviço: {{service}} - Cliente: {{client_name}}'
FROM public.offices
WHERE id NOT IN (SELECT office_id FROM public.billing_configs)
ON CONFLICT (office_id) DO NOTHING;
