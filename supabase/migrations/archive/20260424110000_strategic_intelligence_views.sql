-- ============================================================
-- Migration: Stage 18 — Wave 1: Unified Intelligence Views
-- File: 20260424110000_strategic_intelligence_views.sql
-- ============================================================

BEGIN;

-- 1. DAILY USAGE & COST CONSOLIDATION
CREATE OR REPLACE VIEW public.vw_strategic_usage_cost_daily AS
SELECT 
    office_id,
    pipeline_stage as feature,
    model,
    provider,
    date_trunc('day', l.created_at) as day,
    count(*) as total_requests,
    sum(input_tokens) as total_input_tokens,
    sum(output_tokens) as total_output_tokens,
    sum(total_cost_usd) as total_cost_usd,
    avg(total_cost_usd) as avg_cost_per_request
FROM public.ai_usage_logs l
LEFT JOIN public.ai_model_pricing p ON l.model = p.model_name
GROUP BY 1, 2, 3, 4, 5;

-- 2. INCIDENT DENSITY VIEW (Incident-weighted Risk)
CREATE OR REPLACE VIEW public.vw_strategic_incident_risk AS
SELECT 
    office_id,
    subsystem,
    date_trunc('day', created_at) as day,
    count(*) as total_incidents,
    sum(CASE 
        WHEN severity = 'SEV-1' THEN 100
        WHEN severity = 'SEV-2' THEN 25
        WHEN severity = 'SEV-3' THEN 5
        WHEN severity = 'SEV-4' THEN 1
        ELSE 0 
    END) as weighted_risk_score
FROM public.production_incidents
GROUP BY 1, 2, 3;

-- 3. OPERATOR FRICTION (HITL Edits)
-- Note: Joining medical_safety_audits (Stage 15/16)
CREATE OR REPLACE VIEW public.vw_strategic_operator_friction AS
SELECT 
    office_id,
    'medical_review'::text as feature, -- Primary HITL source
    date_trunc('day', created_at) as day,
    count(*) as total_reviews,
    avg(edit_distance_score) as avg_friction_score, -- 0 to 1
    count(*) FILTER (WHERE review_classification = 'approved_heavy_edit') as heavy_edits,
    count(*) FILTER (WHERE review_classification = 'rejected') as rejections
FROM public.medical_safety_audits
GROUP BY 1, 2, 3;

-- 4. BASELINE AGGREGATION (7d and 30d)
-- This view provides the comparison points for insights.
CREATE OR REPLACE VIEW public.vw_strategic_feature_baselines AS
WITH daily_stats AS (
    SELECT 
        office_id,
        feature,
        day,
        total_requests,
        total_cost_usd
    FROM public.vw_strategic_usage_cost_daily
)
SELECT 
    office_id,
    feature,
    avg(total_requests) FILTER (WHERE day >= now() - interval '7 days') as avg_calls_7d,
    avg(total_requests) FILTER (WHERE day >= now() - interval '30 days') as avg_calls_30d,
    avg(total_cost_usd) FILTER (WHERE day >= now() - interval '7 days') as avg_cost_7d,
    avg(total_cost_usd) FILTER (WHERE day >= now() - interval '30 days') as avg_cost_30d
FROM daily_stats
GROUP BY 1, 2;

COMMIT;
