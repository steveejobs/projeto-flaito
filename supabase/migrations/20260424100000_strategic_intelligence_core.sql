-- ============================================================
-- Migration: Stage 18 — Wave 1: Strategic Intelligence Core
-- File: 20260424100000_strategic_intelligence_core.sql
-- ============================================================

BEGIN;

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE public.strategic_insight_type AS ENUM ('PRODUCT', 'ENGINEERING', 'OPERATIONS', 'COST', 'RISK');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.strategic_priority_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.strategic_scope AS ENUM ('global', 'office', 'feature');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. STRATEGIC INTELLIGENCE INSIGHTS TABLE
CREATE TABLE IF NOT EXISTS public.strategic_intelligence_insights (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_type    public.strategic_insight_type NOT NULL,
    scope           public.strategic_scope NOT NULL,
    scope_id        UUID        REFERENCES public.offices(id), -- NULL if global
    feature         TEXT,        -- Feature name if scope=feature
    
    summary         TEXT        NOT NULL,
    recommended_action TEXT      NOT NULL,
    priority_level  public.strategic_priority_level NOT NULL,
    decision_type   TEXT        NOT NULL, -- 'product', 'engineering', 'ops', 'cost'
    
    confidence_score NUMERIC(3, 2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Time Context
    time_window_start TIMESTAMPTZ NOT NULL,
    time_window_end   TIMESTAMPTZ NOT NULL,
    comparison_window_start TIMESTAMPTZ,
    comparison_window_end   TIMESTAMPTZ,
    
    -- Metrics (Interpreted)
    current_value     NUMERIC,
    baseline_value    NUMERIC,
    deviation_pct     NUMERIC,
    
    -- Traceability & Explainability
    signals_used      JSONB       NOT NULL DEFAULT '[]',
    explainability    JSONB       NOT NULL, -- {summary, data_sources, method, because}
    
    -- Intelligence Metadata
    metadata          JSONB       NOT NULL DEFAULT '{}',
    expires_at        TIMESTAMPTZ,
    relevance_score_decay NUMERIC DEFAULT 1.0,
    
    -- Lifecycle
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Deduplication constraint
    UNIQUE (insight_type, scope, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(feature, 'global'), time_window_start)
);

-- RLS
ALTER TABLE public.strategic_intelligence_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_insights"
  ON public.strategic_intelligence_insights FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "admins_view_insights"
  ON public.strategic_intelligence_insights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND (office_id = strategic_intelligence_insights.office_id OR office_id IS NULL)
    )
  );

-- 3. STRATEGIC INTELLIGENCE ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.strategic_intelligence_alerts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_id      UUID        NOT NULL REFERENCES public.strategic_intelligence_insights(id) ON DELETE CASCADE,
    severity        TEXT        NOT NULL, -- 'info', 'warning', 'critical'
    
    trigger_condition TEXT      NOT NULL,
    threshold_value   NUMERIC,
    current_value     NUMERIC,
    
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ
);

-- RLS for Alerts
ALTER TABLE public.strategic_intelligence_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_alerts"
  ON public.strategic_intelligence_alerts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "admins_view_alerts"
  ON public.strategic_intelligence_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
    )
  );

COMMIT;
