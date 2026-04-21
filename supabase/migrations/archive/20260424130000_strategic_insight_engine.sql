-- ============================================================
-- Migration: Stage 18 — Wave 3: Strategic Insight Engine
-- File: 20260424130000_strategic_insight_engine.sql
-- ============================================================

BEGIN;

-- helper function to upsert insights
CREATE OR REPLACE FUNCTION public.upsert_strategic_insight(
    p_type          public.strategic_insight_type,
    p_scope         public.strategic_scope,
    p_scope_id      UUID,
    p_feature       TEXT,
    p_summary       TEXT,
    p_recommended_action TEXT,
    p_priority      public.strategic_priority_level,
    p_decision_type TEXT,
    p_confidence    NUMERIC,
    p_time_window   JSONB,
    p_comparison    JSONB,
    p_explainability JSONB,
    p_signals       JSONB   DEFAULT '[]',
    p_expires_in    INTERVAL DEFAULT INTERVAL '7 days'
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.strategic_intelligence_insights (
        insight_type, scope, scope_id, feature, 
        summary, recommended_action, priority_level, decision_type,
        confidence_score, time_window_start, time_window_end, 
        comparison_window_start, comparison_window_end,
        current_value, baseline_value, deviation_pct,
        signals_used, explainability, expires_at
    ) VALUES (
        p_type, p_scope, p_scope_id, p_feature,
        p_summary, p_recommended_action, p_priority, p_decision_type,
        p_confidence, 
        (p_time_window->>'start')::TIMESTAMPTZ, (p_time_window->>'end')::TIMESTAMPTZ,
        (p_comparison->>'start')::TIMESTAMPTZ, (p_comparison->>'end')::TIMESTAMPTZ,
        (p_comparison->>'current')::NUMERIC, (p_comparison->>'baseline')::NUMERIC, (p_comparison->>'deviation')::NUMERIC,
        p_signals, p_explainability, now() + p_expires_in
    )
    ON CONFLICT (insight_type, scope, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(feature, 'global'), time_window_start)
    DO UPDATE SET
        summary = EXCLUDED.summary,
        recommended_action = EXCLUDED.recommended_action,
        priority_level = EXCLUDED.priority_level,
        confidence_score = EXCLUDED.confidence_score,
        current_value = EXCLUDED.current_value,
        deviation_pct = EXCLUDED.deviation_pct,
        explainability = EXCLUDED.explainability,
        updated_at = now()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ENGINE: Main Generation Procedure
CREATE OR REPLACE FUNCTION public.run_strategic_intelligence_scan()
RETURNS JSONB AS $$
DECLARE
    v_count INTEGER := 0;
    v_rec RECORD;
    v_window_start TIMESTAMPTZ := date_trunc('day', now() - interval '24 hours');
    v_window_end   TIMESTAMPTZ := date_trunc('day', now());
BEGIN
    -- 1. DETECTOR: COST VS USAGE ANOMALY
    FOR v_rec IN 
        SELECT 
            b.office_id, b.feature,
            b.avg_calls_7d, b.avg_cost_7d,
            c.total_requests as current_calls,
            c.total_cost_usd as current_cost,
            ((c.total_cost_usd / NULLIF(b.avg_cost_7d, 0)) - 1) * 100 as cost_dev,
            ((c.total_requests / NULLIF(b.avg_calls_7d, 0)) - 1) * 100 as usage_dev
        FROM public.vw_strategic_feature_baselines b
        JOIN public.vw_strategic_usage_cost_daily c ON b.office_id = c.office_id AND b.feature = c.feature
        WHERE c.day = v_window_start
          AND b.avg_calls_7d > 10 -- Minimum volume
    LOOP
        -- if cost grows much faster than usage
        IF v_rec.cost_dev > v_rec.usage_dev + 20 AND v_rec.cost_dev > 15 THEN
            PERFORM public.upsert_strategic_insight(
                'COST', 'office', v_rec.office_id, v_rec.feature,
                format('Cost for %s is growing faster than usage (%L%% vs %L%%)', v_rec.feature, ROUND(v_rec.cost_dev, 1), ROUND(v_rec.usage_dev, 1)),
                'Inspect model selection and token usage for this feature. Consider switching to a cheaper model tier.',
                'high', 'cost',
                0.85,
                jsonb_build_object('start', v_window_start, 'end', v_window_end),
                jsonb_build_object('current', v_rec.current_cost, 'baseline', v_rec.avg_cost_7d, 'deviation', v_rec.cost_dev),
                jsonb_build_object(
                    'summary', 'Cost/Usage divergence detected.',
                    'data_sources', 'ai_usage_logs, vw_strategic_feature_baselines',
                    'method', 'Comparison of 24h delta vs 7d rolling baseline.',
                    'because', 'Inefficient token usage or unintended model upgrades often cause this pattern.'
                )
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- 2. DETECTOR: FEATURE HEALTH DECAY
    FOR v_rec IN 
        SELECT h.*, b.previous_health
        FROM public.vw_feature_health_scorecard h
        LEFT JOIN (
            -- mock comparison for example purposes in this SQL
            SELECT office_id, feature, composite_health_score as previous_health
            FROM public.vw_feature_health_scorecard -- would normally be a history table
            LIMIT 100 
        ) b ON h.office_id = b.office_id AND h.feature = b.feature
        WHERE h.composite_health_score < 70
    LOOP
        PERFORM public.upsert_strategic_insight(
            'PRODUCT', 'office', v_rec.office_id, v_rec.feature,
            format('Feature %s health is sub-optimal (%s/100)', v_rec.feature, v_rec.composite_health_score),
            'Review friction scores and reliability logs. High incident rate or user edits may be degrading experience.',
            CASE WHEN v_rec.composite_health_score < 40 THEN 'critical' ELSE 'medium' END::public.strategic_priority_level,
            'product',
            0.90,
            jsonb_build_object('start', v_window_start, 'end', v_window_end),
            jsonb_build_object('current', v_rec.composite_health_score, 'baseline', 85, 'deviation', v_rec.composite_health_score - 85),
            jsonb_build_object(
                'summary', 'Composite health score below threshold.',
                'data_sources', 'vw_feature_health_scorecard',
                'method', 'Weight-based aggregation of usage, cost, risk, and friction.',
                'because', 'Low health scores indicate potential churn risk or operational inefficiency.'
            )
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('insights_generated', v_count, 'scanned_at', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
