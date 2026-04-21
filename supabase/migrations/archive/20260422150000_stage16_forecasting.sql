-- Migration: Stage 16 — Forecasting & Anomaly Detection
-- Description: Implements growth-aware cost forecasting and automated incident triggers for anomalous AI usage.

-- 1. Cost Projection Function (30-day forecast based on 7-day average)
CREATE OR REPLACE FUNCTION public.calculate_office_cost_forecast(
    p_office_id UUID
)
RETURNS TABLE (
    avg_daily_usd NUMERIC(12, 8),
    projected_30d_usd NUMERIC(12, 8),
    budget_remaining_usd NUMERIC(12, 8),
    is_at_risk BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_monthly_budget NUMERIC;
    v_total_spent_30d NUMERIC;
BEGIN
    -- Get budget
    SELECT monthly_usd_budget INTO v_monthly_budget
    FROM public.office_ai_budgets
    WHERE office_id = p_office_id;

    IF v_monthly_budget IS NULL THEN 
        v_monthly_budget := 500.0; -- Default placeholder
    END IF;

    -- Calculate average daily spend over last 7 days
    SELECT COALESCE(SUM(total_cost_usd) / 7.0, 0)
    INTO avg_daily_usd
    FROM public.ai_usage_logs
    WHERE office_id = p_office_id
      AND created_at > (now() - interval '7 days');

    projected_30d_usd := avg_daily_usd * 30.0;

    -- Current month spend (simulated for now)
    SELECT COALESCE(SUM(total_cost_usd), 0)
    INTO v_total_spent_30d
    FROM public.ai_usage_logs
    WHERE office_id = p_office_id
      AND created_at > date_trunc('month', now());

    budget_remaining_usd := v_monthly_budget - v_total_spent_30d;
    
    -- Risk: Projected spend exceeds 90% of budget
    is_at_risk := projected_30d_usd >= (v_monthly_budget * 0.9);

    RETURN NEXT;
END;
$$;

-- 2. Anomaly Detection Function
CREATE OR REPLACE FUNCTION public.detect_job_cost_anomaly(
    p_job_id UUID,
    p_actual_cost NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_office_id UUID;
    v_job_type TEXT;
    v_avg_cost NUMERIC;
    v_multiplier NUMERIC;
BEGIN
    SELECT j.office_id, j.job_type, COALESCE(b.anomaly_threshold_multiplier, 2.0)
    INTO v_office_id, v_job_type, v_multiplier
    FROM public.session_jobs j
    LEFT JOIN public.office_ai_budgets b ON j.office_id = b.office_id
    WHERE j.id = p_job_id;

    -- Calculate historical average for this job type in this office (last 100 jobs)
    SELECT AVG(cost_usd)
    INTO v_avg_cost
    FROM (
        SELECT cost_usd FROM public.session_jobs
        WHERE office_id = v_office_id AND job_type = v_job_type AND status = 'succeeded'
        ORDER BY finished_at DESC LIMIT 100
    ) hist;

    IF v_avg_cost IS NOT NULL AND v_avg_cost > 0 AND p_actual_cost > (v_avg_cost * v_multiplier) THEN
        -- Insert Health Alert (Stage 11/15 integration)
        INSERT INTO public.session_health_alerts (session_id, office_id, alert_type, severity, detail)
        SELECT session_id, office_id, 'cost_anomaly', 'warning', 
               jsonb_build_object('job_id', p_job_id, 'cost', p_actual_cost, 'avg', v_avg_cost, 'multiplier', v_multiplier)
        FROM public.session_jobs WHERE id = p_job_id
        ON CONFLICT DO NOTHING;
        
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;
