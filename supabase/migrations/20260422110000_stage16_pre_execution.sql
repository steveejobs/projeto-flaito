-- Migration: Stage 16 — Pre-Execution Control & Rerun Guard
-- Description: Implements procedural guards to prevent infinite loops and budget overruns before AI execution.

-- 1. Rerun Loop Guard
-- Rules: max 3 runs per snapshot hash within 10 minutes.
CREATE OR REPLACE FUNCTION public.check_rerun_loop_guard(
    p_session_id UUID,
    p_snapshot_hash TEXT
)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) 
    INTO v_count
    FROM public.ai_usage_logs
    WHERE session_id = p_session_id
      AND metadata->>'snapshot_hash' = p_snapshot_hash
      AND created_at > (now() - interval '10 minutes');

    IF v_count >= 3 THEN
        -- Log Incident (Stage 15 Integration)
        INSERT INTO public.session_audit_logs (
            session_id, office_id, action, resource_type, resource_id, metadata
        )
        SELECT 
            p_session_id, office_id, 'RERUN_LOOP_DETECTED', 'session', p_session_id,
            jsonb_build_object('snapshot_hash', p_snapshot_hash, 'count', v_count, 'period', '10m')
        FROM public.sessions
        WHERE id = p_session_id;

        RETURN QUERY SELECT FALSE, 'RERUN_LOOP_LIMIT_EXCEEDED: Max 3 runs per unique snapshot per 10 minutes.';
    ELSE
        RETURN QUERY SELECT TRUE, NULL::TEXT;
    END IF;
END;
$$;

-- 2. Pre-Execution Verdict
-- Decides whether to allow, degrade, or reject based on estimated cost and budget budget.
CREATE OR REPLACE FUNCTION public.get_pre_execution_verdict(
    p_job_id UUID,
    p_estimated_tokens INTEGER
)
RETURNS TABLE (
    allowed BOOLEAN,
    decision_taken TEXT,
    estimated_cost_usd NUMERIC(12, 8),
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_office_id UUID;
    v_model TEXT;
    v_input_1k NUMERIC;
    v_output_1k NUMERIC;
    v_est_cost NUMERIC;
    v_daily_used INTEGER;
    v_daily_cap INTEGER;
    v_daily_hard_cap INTEGER;
    v_budget_pct NUMERIC;
BEGIN
    -- 1. Identify context
    SELECT j.office_id, COALESCE(j.worker_id, 'gpt-4o') -- Fallback to 4o for pricing check
    INTO v_office_id, v_model
    FROM public.session_jobs j
    WHERE j.id = p_job_id;

    -- 2. Get pricing (assume 30% output ratio for estimation)
    SELECT input_1k_usd, output_1k_usd
    INTO v_input_1k, v_output_1k
    FROM public.ai_model_pricing
    WHERE model_name = v_model;

    IF NOT FOUND THEN
        -- Default to gpt-4o pricing if specific model is unknown
        SELECT input_1k_usd, output_1k_usd INTO v_input_1k, v_output_1k
        FROM public.ai_model_pricing WHERE model_name = 'gpt-4o';
    END IF;

    v_est_cost := (p_estimated_tokens::NUMERIC / 1000.0) * (v_input_1k + (v_output_1k * 0.3));

    -- 3. Check budget
    SELECT daily_tokens_used, daily_token_cap, daily_hard_cap
    INTO v_daily_used, v_daily_cap, v_daily_hard_cap
    FROM public.office_ai_budgets
    WHERE office_id = v_office_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT TRUE, 'execute', v_est_cost, 'No budget configured (fail-open)';
        RETURN;
    END IF;

    v_budget_pct := (v_daily_used::NUMERIC / NULLIF(v_daily_hard_cap, 0)) * 100;

    -- 4. Decision Logic
    IF v_daily_used + p_estimated_tokens > v_daily_hard_cap THEN
        RETURN QUERY SELECT FALSE, 'reject', v_est_cost, 'DAILY_HARD_CAP_EXCEEDED';
    ELSIF v_daily_used + p_estimated_tokens > v_daily_cap THEN
        -- Soft cap exceeded but under hard cap -> Suggest degradation
        RETURN QUERY SELECT TRUE, 'degrade', v_est_cost, 'SOFT_CAP_EXCEEDED';
    ELSE
        RETURN QUERY SELECT TRUE, 'execute', v_est_cost, NULL::TEXT;
    END IF;
END;
$$;
