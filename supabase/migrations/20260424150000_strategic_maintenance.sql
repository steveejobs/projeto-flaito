-- ============================================================
-- Migration: Stage 18 — Wave 5: Storage & Maintenance
-- File: 20260424150000_strategic_maintenance.sql
-- ============================================================

BEGIN;

-- 1. INSIGHT DECAY & CLEANUP
-- Automatically removes expired insights. Alerts linked via CASCADE.
CREATE OR REPLACE FUNCTION public.cleanup_strategic_intelligence()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM public.strategic_intelligence_insights
    WHERE expires_at < now();
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. DASHBOARD VIEW (Consolidated for Decision Support)
-- This view provides the "Structure for Product/Engineering/Ops" requested.
CREATE OR REPLACE VIEW public.vw_strategic_decision_board AS
SELECT 
    priority_level,
    insight_type,
    summary,
    recommended_action,
    confidence_score,
    (explainability->>'because') as reasoning,
    deviation_pct,
    scope,
    CASE 
        WHEN scope = 'office' THEN (SELECT name FROM public.offices WHERE id = scope_id)
        ELSE 'GLOBAL'
    END as scope_name,
    created_at
FROM public.strategic_intelligence_insights
WHERE expires_at > now()
ORDER BY 
    CASE priority_level 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
    END ASC,
    created_at DESC;

COMMIT;
