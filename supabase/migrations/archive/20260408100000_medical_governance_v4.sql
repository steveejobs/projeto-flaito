-- Migration: 20260408100000_medical_governance_v4.sql
-- Description: Infraestrutura para Watchdog e Governança Clínica Ativa (V4)

-- 1. Versionamento de Políticas Clínicas
CREATE TABLE IF NOT EXISTS public.medical_policy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_tag TEXT NOT NULL UNIQUE,
    policy_definition JSONB NOT NULL, -- { "thresholds": {...}, "rules": [...] }
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Incidentes de Governança (Clínico/Comportamental vs Operacional/Safety)
CREATE TYPE governance_incident_category AS ENUM ('clinical_behavioral', 'operational_engine');
CREATE TYPE governance_severity AS ENUM ('info', 'warning', 'high', 'critical', 'operational');

CREATE TABLE IF NOT EXISTS public.medical_governance_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id),
    user_id UUID REFERENCES auth.users(id),
    incident_category governance_incident_category NOT NULL,
    severity governance_severity NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    evidence JSONB, -- Referências a audit_logs ou medical_safety_audits
    status TEXT DEFAULT 'open', -- open, acknowledged, resolved, suppressed
    occurrence_count INT DEFAULT 1,
    first_seen_at TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    auto_action_details JSONB, -- Detalhes da ação tomada pelo sistema
    policy_version_id UUID REFERENCES public.medical_policy_versions(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Estado de Risco e Restrições Temporárias
CREATE TABLE IF NOT EXISTS public.medical_risk_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type TEXT NOT NULL, -- 'user', 'office', 'channel'
    scope_id TEXT NOT NULL, -- UUID ou Slug (ex: 'voice')
    risk_score NUMERIC(5,2) DEFAULT 0,
    risk_level TEXT DEFAULT 'normal',
    temporary_restrictions JSONB DEFAULT '[]', -- [ { "capability": "diagnostic_opinion", "blocked": true } ]
    applied_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ, -- Data de fim da restrição automática
    cooldown_until TIMESTAMPTZ, -- Data até quando novas restrições são mais prováveis
    applied_reason TEXT,
    applied_by TEXT DEFAULT 'system', -- 'system' ou user_id
    lifted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Alertas de Governança para o Dashboard
CREATE TABLE IF NOT EXISTS public.medical_governance_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES public.medical_governance_incidents(id) ON DELETE CASCADE,
    office_id UUID REFERENCES public.offices(id),
    user_id UUID REFERENCES auth.users(id),
    severity governance_severity NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.medical_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_governance_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_risk_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_governance_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas: Apenas Admins do sistema (service_role) ou Admins do Office podem ver incidentes/alertas
CREATE POLICY "Admins can view governance incidents" ON public.medical_governance_incidents
FOR SELECT USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (SELECT 1 FROM public.office_members om WHERE om.office_id = medical_governance_incidents.office_id AND om.user_id = auth.uid() AND om.role IN ('OWNER', 'ADMIN', 'owner', 'admin'))
);

CREATE POLICY "Admins can view governance alerts" ON public.medical_governance_alerts
FOR SELECT USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (SELECT 1 FROM public.office_members om WHERE om.office_id = medical_governance_alerts.office_id AND om.user_id = auth.uid() AND om.role IN ('OWNER', 'ADMIN', 'owner', 'admin'))
);

-- Índices
CREATE INDEX idx_gov_incidents_cat_sev ON public.medical_governance_incidents(incident_category, severity);
CREATE INDEX idx_gov_incidents_office ON public.medical_governance_incidents(office_id);
CREATE INDEX idx_risk_states_expires ON public.medical_risk_states(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_risk_states_scope ON public.medical_risk_states(scope_type, scope_id);
CREATE INDEX idx_gov_alerts_office_unread ON public.medical_governance_alerts(office_id, is_read);

-- Comentários
COMMENT ON TABLE public.medical_risk_states IS 'Estado de risco vivo com restrições temporárias e automáticas por canal, usuário ou consultório.';
COMMENT ON COLUMN public.medical_risk_states.expires_at IS 'Timestamp de expiração automática da restrição. O Watchdog deve limpar após esta data.';
