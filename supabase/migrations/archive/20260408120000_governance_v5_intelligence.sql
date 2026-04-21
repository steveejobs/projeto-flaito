-- ============================================================
-- MÓDULO MÉDICO — Governança V5: Inteligência Operacional
-- ============================================================

-- 1. RECOMENDAÇÕES DE GOVERNANÇA (Policy Advisor)
CREATE TABLE IF NOT EXISTS public.medical_governance_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL, -- 'policy_adjustment', 'training_needed', 'high_friction'
  title TEXT NOT NULL,
  description TEXT,
  evidence_refs JSONB DEFAULT '[]', -- Links para auditorias ou incidentes que motivaram
  current_policy_snapshot JSONB, -- Estado da policy no momento da recomendação
  suggested_policy_snapshot JSONB, -- Sugestão de alteração
  expected_impact TEXT,
  risk_level TEXT DEFAULT 'info' CHECK (risk_level IN ('info', 'low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'accepted', 'rejected', 'applied')),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  applied_at TIMESTAMPTZ
);

-- 2. SNAPSHOTS DE GOVERNANÇA (Trends & Metrics)
CREATE TABLE IF NOT EXISTS public.medical_governance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  period_type TEXT DEFAULT 'daily' CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metrics JSONB NOT NULL, -- { risk_score: 0-100, incident_count: X, total_audits: Y, breach_rate: Z }
  risk_trend TEXT DEFAULT 'stable' CHECK (risk_trend IN ('improving', 'stable', 'worsening')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS
ALTER TABLE public.medical_governance_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_governance_snapshots ENABLE ROW LEVEL SECURITY;

-- Membros do escritório podem ver os dados de faturamento/governança do seu office
CREATE POLICY "governance_recommendations_office_access" ON public.medical_governance_recommendations
  FOR SELECT USING (
    office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "governance_snapshots_office_access" ON public.medical_governance_snapshots
  FOR SELECT USING (
    office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
  );

-- Apenas funções server-side ou admins podem inserir/atualizar
CREATE POLICY "governance_admin_all" ON public.medical_governance_recommendations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.office_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

-- Índices
CREATE INDEX IF NOT EXISTS idx_gov_rec_office ON public.medical_governance_recommendations(office_id);
CREATE INDEX IF NOT EXISTS idx_gov_rec_status ON public.medical_governance_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_gov_snap_office ON public.medical_governance_snapshots(office_id);
CREATE INDEX IF NOT EXISTS idx_gov_snap_period ON public.medical_governance_snapshots(period_start, period_end);
