-- Migration: Stage 17 — Policy & Signal Layer (HARDENED)
-- Description: Establishes the control plane for autonomous optimization.

BEGIN;

-- 1. AUTONOMOUS OPTIMIZATION POLICIES
-- Defines what autonomy is allowed where and under what constraints.
CREATE TABLE IF NOT EXISTS public.autonomous_optimization_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature TEXT NOT NULL, -- 'transcription', 'legal_analysis', 'medical_review', 'general_query'
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    
    -- Autonomy Mode
    mode TEXT NOT NULL DEFAULT 'recommend', -- 'recommend', 'auto_apply', 'disabled'
    
    -- Constraints
    auto_apply_allowed BOOLEAN DEFAULT FALSE,
    downgrade_allowed BOOLEAN DEFAULT FALSE, -- Allowed to use cheaper, lower quality models
    reroute_allowed BOOLEAN DEFAULT TRUE,   -- Allowed to switch providers for same tier
    
    max_changes_per_window INTEGER DEFAULT 5, -- Prevent thrashing
    cooldown_seconds INTEGER DEFAULT 3600,    -- 1 hour cooldown for same feature/scope
    min_sample_size INTEGER DEFAULT 20,       -- Min samples before trusting latency data
    
    -- Quality Floor
    quality_floor TEXT NOT NULL DEFAULT 'standard', -- 'high', 'standard', 'economic'
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Multi-tenant constraint: one policy per feature per office (or global)
    UNIQUE (feature, office_id)
);

-- RLS for Policies
ALTER TABLE public.autonomous_optimization_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_policies" ON public.autonomous_optimization_policies FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "admins_view_policies" ON public.autonomous_optimization_policies FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.office_members WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN'))
);

-- 2. AI MODEL HEALTH REGISTRY (Circuit Breaker)
CREATE TABLE IF NOT EXISTS public.ai_model_health_registry (
    model_name TEXT PRIMARY KEY REFERENCES public.ai_model_pricing(model_name),
    status TEXT NOT NULL DEFAULT 'healthy', -- 'healthy', 'degraded', 'blocked', 'manual_review_required'
    
    latency_avg_ms INTEGER DEFAULT 0,
    error_rate_pct NUMERIC(5, 2) DEFAULT 0.00,
    
    incident_count_24h INTEGER DEFAULT 0,
    
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- 3. AI MODEL PERFORMANCE HISTORY
-- High-churn table for sliding window calculations.
CREATE TABLE IF NOT EXISTS public.ai_model_performance_history (
    id BIGSERIAL PRIMARY KEY,
    model_name TEXT NOT NULL REFERENCES public.ai_model_pricing(model_name),
    trace_id TEXT,
    latency_ms INTEGER NOT NULL,
    status_code INTEGER DEFAULT 200,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_performance_model_date ON public.ai_model_performance_history (model_name, created_at DESC);

-- 4. OPTIMIZATION AUDIT LOG (Hardened V1)
CREATE TABLE IF NOT EXISTS public.optimization_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    
    decision_type TEXT NOT NULL, -- 'model_switch', 'cache_tune', 'rate_limit_adjust'
    
    input_signals JSONB NOT NULL, -- Captures cost, latency, error_rate at decision time
    
    recommendation TEXT NOT NULL,
    action_taken TEXT NOT NULL, -- What was actually done (might be 'nothing' in recommend-only mode)
    
    reason TEXT NOT NULL,
    confidence_score NUMERIC(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    applied_flag BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMPTZ,
    
    -- Closed loop metrics
    outcome_status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failure', 'inconclusive'
    outcome_measured_at TIMESTAMPTZ,
    actual_effect JSONB DEFAULT '{}',
    
    reversible_flag BOOLEAN DEFAULT TRUE,
    trace_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_optimization_audit_office_date ON public.optimization_audit_log (office_id, created_at);

-- 5. INITIAL SEEDS
-- Global Defaults for critical features
INSERT INTO public.autonomous_optimization_policies (feature, mode, auto_apply_allowed, quality_floor, cooldown_seconds)
VALUES 
    ('legal_analysis', 'recommend', FALSE, 'high', 7200),
    ('medical_review', 'recommend', FALSE, 'high', 7200),
    ('transcription', 'auto_apply', TRUE, 'standard', 3600),
    ('general_query', 'auto_apply', TRUE, 'economic', 1800)
ON CONFLICT (feature, office_id) DO NOTHING;

-- Registry sync from pricing
INSERT INTO public.ai_model_health_registry (model_name)
SELECT model_name FROM public.ai_model_pricing
ON CONFLICT (model_name) DO NOTHING;

COMMIT;
