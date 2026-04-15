-- Migration: Stage 17 — Closed-Loop Audit & Metrics
-- Description: Functions to correlate optimization decisions with actual results.

BEGIN;

-- 1. FUNCTION: Update Optimization Outcome
-- Correlates a trace_id from performance_history with an entry in optimization_audit_log.
CREATE OR REPLACE FUNCTION public.track_optimization_outcome(
    p_trace_id TEXT,
    p_actual_latency_ms INTEGER,
    p_status_code INTEGER DEFAULT 200
) RETURNS VOID AS $$
DECLARE
    v_audit_id UUID;
    v_target_latency INTEGER;
    v_is_success BOOLEAN;
BEGIN
    -- Find the audit log entry for this trace
    SELECT id, (input_signals->>'latency_avg')::INTEGER 
    INTO v_audit_id, v_target_latency
    FROM public.optimization_audit_log
    WHERE trace_id = p_trace_id
    LIMIT 1;

    IF v_audit_id IS NOT NULL THEN
        -- Evaluate success: did we stay within 15% of the target/expected latency?
        v_is_success := (p_actual_latency_ms <= v_target_latency * 1.15) AND (p_status_code = 200);

        UPDATE public.optimization_audit_log
        SET 
            outcome_status = CASE WHEN v_is_success THEN 'success' ELSE 'failure' END,
            actual_effect = jsonb_build_object(
                'actual_latency', p_actual_latency_ms,
                'target_latency', v_target_latency,
                'status_code', p_status_code,
                'variance_pct', ROUND(((p_actual_latency_ms::numeric / NULLIF(v_target_latency, 0)) - 1) * 100, 2)
            ),
            outcome_measured_at = now()
        WHERE id = v_audit_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. VIEW: Optimizer Success Rate
CREATE OR REPLACE VIEW public.view_optimizer_performance AS
SELECT 
    feature,
    decision_type,
    COUNT(*) as total_decisions,
    COUNT(*) FILTER (WHERE applied_flag = TRUE) as total_applied,
    COUNT(*) FILTER (WHERE outcome_status = 'success') as total_successes,
    COUNT(*) FILTER (WHERE outcome_status = 'failure') as total_failures,
    ROUND(COUNT(*) FILTER (WHERE outcome_status = 'success')::numeric / NULLIF(COUNT(*) FILTER (WHERE outcome_status IN ('success', 'failure')), 0) * 100, 2) as success_rate_pct,
    AVG((actual_effect->>'variance_pct')::numeric) FILTER (WHERE outcome_status = 'success') as avg_improvement_pct
FROM public.optimization_audit_log
GROUP BY 1, 2;

-- 3. TRIGGER: Auto-track registry health updates
-- When performance history is inserted, update the health registry window.
CREATE OR REPLACE FUNCTION public.refresh_model_health_signals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.ai_model_health_registry
    SET 
        latency_avg_ms = (
            SELECT AVG(latency_ms)::INTEGER 
            FROM public.ai_model_performance_history 
            WHERE model_name = NEW.model_name 
            AND created_at > now() - interval '10 minutes'
        ),
        error_rate_pct = (
            SELECT (COUNT(*) FILTER (WHERE status_code >= 400)::numeric / COUNT(*) * 100)
            FROM public.ai_model_performance_history 
            WHERE model_name = NEW.model_name 
            AND created_at > now() - interval '10 minutes'
        ),
        last_updated_at = now()
    WHERE model_name = NEW.model_name;
    
    -- Also try to correlate optimization outcome if trace_id exists
    IF NEW.trace_id IS NOT NULL THEN
        PERFORM public.track_optimization_outcome(NEW.trace_id, NEW.latency_ms, NEW.status_code);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_refresh_model_health
AFTER INSERT ON public.ai_model_performance_history
FOR EACH ROW EXECUTE FUNCTION public.refresh_model_health_signals();

COMMIT;
