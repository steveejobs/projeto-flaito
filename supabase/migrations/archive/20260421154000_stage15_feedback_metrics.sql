-- ============================================================
-- Migration: Stage 15 — Wave 5: Operator Feedback & Metrics
-- File: 20260421154000_stage15_feedback_metrics.sql
-- ============================================================

BEGIN;

-- 1. OPERATOR FEEDBACK TABLE
CREATE TABLE IF NOT EXISTS public.operator_feedback (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id       UUID        REFERENCES public.offices(id),
    user_id         UUID        REFERENCES auth.users(id),
    
    module          TEXT,        -- 'billing', 'session_processor', 'ai_legal'
    page_url        TEXT,
    
    incident_id     UUID        REFERENCES public.production_incidents(id) ON DELETE SET NULL,
    runbook_id      TEXT,        -- reference to playbooks for feedback on quality
    
    feedback_type   TEXT        NOT NULL, -- 'pain_point', 'bug_report', 'improvement_idea', 'runbook_gap'
    description     TEXT        NOT NULL,
    
    metadata        JSONB       DEFAULT '{}', -- captures stack trace, UI state, browser info
    
    is_processed    BOOLEAN     NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.operator_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_feedback" ON public.operator_feedback FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "operators_insert_feedback" ON public.operator_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins_view_feedback" ON public.operator_feedback FOR SELECT USING (EXISTS (SELECT 1 FROM public.office_members WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')));

-- 2. LEARNING LOOP METRIC SNAPSHOTS
CREATE TABLE IF NOT EXISTS public.learning_loop_metric_snapshots (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    
    snapshot_date   DATE        NOT NULL DEFAULT current_date,
    
    -- MTTR / MTTD (in minutes)
    avg_mttr_min    FLOAT,
    avg_mttd_min    FLOAT,
    
    -- Quality / Debt
    open_incident_count INTEGER,
    unmitigated_count   INTEGER,
    postmortem_debt_count INTEGER, -- SEV-1/2 resolved but missing postmortem
    regression_debt_count INTEGER, -- clusters > 1 missing tests
    
    -- Feedback
    unprocessed_feedback_count INTEGER,
    
    metadata        JSONB       DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_loop_snapshot_date ON public.learning_loop_metric_snapshots(snapshot_date);

-- 3. METRICS VIEW
CREATE OR REPLACE VIEW public.learning_loop_metrics AS
SELECT
    -- Timeliness
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)::FLOAT as mttr_min,
    
    -- Quality
    COUNT(*) FILTER (WHERE status != 'closed') as open_incidents,
    COUNT(*) FILTER (WHERE severity IN ('SEV-1', 'SEV-2') AND status = 'resolved' AND NOT EXISTS (SELECT 1 FROM public.production_postmortems p WHERE p.incident_id = production_incidents.id)) as postmortem_debt,
    
    -- Regression Coverage
    (SELECT COUNT(*) FROM public.detect_incident_regression_gaps()) as regression_gap_clusters,
    
    -- Operator satisfaction
    (SELECT COUNT(*) FROM public.operator_feedback WHERE NOT is_processed) as pending_feedback_count
FROM public.production_incidents;

COMMIT;
