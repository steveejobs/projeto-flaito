-- ============================================================
-- Migration: Stage 18 — Wave 2: Scoring Systems
-- File: 20260424120000_strategic_intelligence_scoring.sql
-- ============================================================

BEGIN;

-- 1. BASELINE CONTEXT (Helper function for normalization)
CREATE OR REPLACE FUNCTION public.fn_normalize_score(val NUMERIC, min_val NUMERIC, max_val NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
    IF max_val = min_val OR val IS NULL THEN RETURN 0.5; END IF;
    RETURN LEAST(GREATEST((val - min_val) / (max_val - min_val), 0), 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. FEATURE HEALTH SCORECARD (Explainable)
-- This view breaks down the score into its mandatory components.
CREATE OR REPLACE VIEW public.vw_feature_health_scorecard AS
WITH raw_metrics AS (
    SELECT 
        u.office_id,
        u.feature,
        u.total_requests,
        u.total_cost_usd,
        u.avg_cost_per_request,
        COALESCE(f.avg_friction_score, 0.1) as friction, -- default low friction
        COALESCE(r.weighted_risk_score, 0) as risk
    FROM (
        SELECT office_id, feature, sum(total_requests) as total_requests, sum(total_cost_usd) as total_cost_usd, avg(avg_cost_per_request) as avg_cost_per_request
        FROM public.vw_strategic_usage_cost_daily
        WHERE day >= now() - interval '7 days'
        GROUP BY 1, 2
    ) u
    LEFT JOIN public.vw_strategic_operator_friction f ON u.office_id = f.office_id AND u.feature = f.feature
    LEFT JOIN public.vw_strategic_incident_risk r ON u.office_id = r.office_id AND u.feature = r.subsystem -- assuming subsystem maps to feature
),
global_bounds AS (
    SELECT 
        max(total_requests) as max_req,
        max(total_cost_usd) as max_cost,
        max(avg_cost_per_request) as max_avg_cost
    FROM raw_metrics
)
SELECT 
    m.office_id,
    m.feature,
    
    -- Mandatory Component scores (0-100)
    ROUND(public.fn_normalize_score(m.total_requests, 0, b.max_req) * 100) as usage_score,
    ROUND((1 - public.fn_normalize_score(m.avg_cost_per_request, 0, b.max_avg_cost)) * 100) as cost_efficiency_score,
    ROUND((1 - public.fn_normalize_score(m.risk, 0, 100)) * 100) as reliability_score, -- 100 is a SEV-1 weighted risk
    ROUND((1 - m.friction) * 100) as friction_score,
    
    -- Composite Score (Weighted)
    ROUND(
        (public.fn_normalize_score(m.total_requests, 0, b.max_req) * 0.3 +
        (1 - public.fn_normalize_score(m.avg_cost_per_request, 0, b.max_avg_cost)) * 0.3 +
        (1 - public.fn_normalize_score(m.risk, 0, 100)) * 0.2 +
        (1 - m.friction) * 0.2) * 100
    ) as composite_health_score,
    
    now() as measured_at
FROM raw_metrics m, global_bounds b;

-- 3. STRATEGIC RISK SCORE (Incident-weighted)
CREATE OR REPLACE VIEW public.vw_strategic_risk_summary AS
SELECT 
    office_id,
    subsystem,
    weighted_risk_score,
    CASE 
        WHEN weighted_risk_score > 50 THEN 'critical'
        WHEN weighted_risk_score > 20 THEN 'high'
        WHEN weighted_risk_score > 5 THEN 'medium'
        ELSE 'low'
    END as risk_level,
    now() as calculated_at
FROM public.vw_strategic_incident_risk
WHERE day >= now() - interval '7 days';

-- 4. VALUE PROXY
-- value_proxy = f(usage_freq, session_impact, output_gen, operator_reliance)
CREATE OR REPLACE VIEW public.vw_strategic_value_proxy AS
SELECT 
    office_id,
    pipeline_stage as feature,
    -- Formula: (Calls * 0.4) + (Log10(Tokens) * 0.3) + (1 - Friction * 0.3)
    (count(*) * 0.4 + 
     log(NULLIF(sum(output_tokens), 0) + 1) * 3 + -- Scaling factor for tokens
     (1 - COALESCE(avg(f.avg_friction_score), 0.1)) * 30 -- Scaling factor for reliance
    ) as calculated_value_proxy
FROM public.ai_usage_logs l
LEFT JOIN public.vw_strategic_operator_friction f ON l.office_id = f.office_id AND l.pipeline_stage = f.feature
WHERE l.created_at >= now() - interval '7 days'
GROUP BY 1, 2;

COMMIT;
