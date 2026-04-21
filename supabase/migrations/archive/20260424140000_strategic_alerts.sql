-- ============================================================
-- Migration: Stage 18 — Wave 4: Strategic Alerts
-- File: 20260424140000_strategic_alerts.sql
-- ============================================================

BEGIN;

-- 1. ALERT FACTORY: Converts critical insights into actionable alerts
CREATE OR REPLACE FUNCTION public.process_insight_alerts()
RETURNS INTEGER AS $$
DECLARE
    v_rec RECORD;
    v_alert_count INTEGER := 0;
BEGIN
    -- Only process high/critical priority insights with confidence > 0.8
    -- and that were created in the last 15 minutes (fresh insights)
    FOR v_rec IN 
        SELECT * 
        FROM public.strategic_intelligence_insights
        WHERE priority_level IN ('high', 'critical')
          AND confidence_score >= 0.80
          AND created_at >= now() - interval '15 minutes'
    LOOP
        -- Deduplicate: check if an active alert already exists for this insight
        IF NOT EXISTS (
            SELECT 1 FROM public.strategic_intelligence_alerts 
            WHERE insight_id = v_rec.id AND is_active = TRUE
        ) THEN
            INSERT INTO public.strategic_intelligence_alerts (
                insight_id, severity, trigger_condition, threshold_value, current_value
            ) VALUES (
                v_rec.id,
                CASE WHEN v_rec.priority_level = 'critical' THEN 'critical' ELSE 'warning' END,
                format('Condition: %s', v_rec.insight_type),
                v_rec.baseline_value,
                v_rec.current_value
            );
            v_alert_count := v_alert_count + 1;
        END IF;
    END LOOP;

    RETURN v_alert_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TRIGGER: Auto-alert on insert
CREATE OR REPLACE FUNCTION public.tr_fn_auto_alert_on_insight()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.process_insight_alerts();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_insight_alert_trigger ON public.strategic_intelligence_insights;
CREATE TRIGGER tr_insight_alert_trigger
    AFTER INSERT ON public.strategic_intelligence_insights
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.tr_fn_auto_alert_on_insight();

-- 3. CRON JOB (If pg_net/pg_cron available, but we assume manual/external trigger for safety)
-- In a real scenario, this would be scheduled.

COMMIT;
