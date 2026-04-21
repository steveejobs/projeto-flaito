-- ============================================================
-- Migration: Stage 15 — Wave 3: Regression & Follow-Up Tracking
-- File: 20260421152000_stage15_tracking.sql
-- ============================================================

BEGIN;

-- 1. INCIDENT REGRESSION LINKS
CREATE TABLE IF NOT EXISTS public.incident_regression_links (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID        NOT NULL REFERENCES public.production_incidents(id) ON DELETE CASCADE,
    
    regression_type TEXT        NOT NULL, -- 'unit_test', 'integration_test', 'playbook_update', 'lint_rule'
    test_reference  TEXT        NOT NULL, -- PR URL, Test File Path, or JIRA Link
    
    status          TEXT        NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'exception'
    exception_reason TEXT,
    
    verified_at     TIMESTAMPTZ,
    verified_by     UUID        REFERENCES auth.users(id),
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. INCIDENT FOLLOWUP ACTIONS
CREATE TABLE IF NOT EXISTS public.incident_followup_actions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID        NOT NULL REFERENCES public.production_incidents(id) ON DELETE CASCADE,
    
    title           TEXT        NOT NULL,
    description     TEXT,
    owner           UUID        REFERENCES auth.users(id),
    due_date        DATE,
    
    status          TEXT        NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'completed', 'cancelled'
    linked_change   TEXT,       -- PR URL or Commit hash
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.incident_regression_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_followup_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_tracking" ON public.incident_regression_links FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "service_role_all_actions" ON public.incident_followup_actions FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. ENHANCED CLOSURE ENFORCEMENT
-- Updating fn_enforce_incident_closure to require regression/followup for SEV-1/SEV-2.

CREATE OR REPLACE FUNCTION public.fn_enforce_incident_closure()
RETURNS TRIGGER AS $$
DECLARE
    v_postmortem RECORD;
    v_has_regression BOOLEAN;
    v_has_actions BOOLEAN;
BEGIN
    IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
        
        IF NEW.severity IN ('SEV-1', 'SEV-2') THEN
            
            -- 1. Postmortem check
            SELECT * INTO v_postmortem FROM public.production_postmortems WHERE incident_id = NEW.id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Incident % (severity %) cannot be closed without a postmortem.', NEW.id, NEW.severity;
            END IF;

            -- 2. Regression Link check
            SELECT EXISTS (
                SELECT 1 FROM public.incident_regression_links 
                WHERE incident_id = NEW.id 
                  AND (status = 'verified' OR (status = 'exception' AND exception_reason IS NOT NULL))
            ) INTO v_has_regression;
            
            IF NOT v_has_regression THEN
                RAISE EXCEPTION 'Incident % requires at least one verified regression test or a formal exception before closure.', NEW.id;
            END IF;

            -- 3. Follow-up Actions check (Must at least have 1 defined, even if open)
            SELECT EXISTS (
                SELECT 1 FROM public.incident_followup_actions WHERE incident_id = NEW.id
            ) INTO v_has_actions;

            IF NOT v_has_actions THEN
                RAISE EXCEPTION 'Incident % requires at least one follow-up action to be defined before closure.', NEW.id;
            END IF;
            
        END IF;

        NEW.closed_at := now();
    END IF;

    IF NEW.status IN ('resolved', 'closed') AND (OLD.status NOT IN ('resolved', 'closed') OR OLD.status IS NULL) THEN
        NEW.resolved_at := COALESCE(NEW.resolved_at, now());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
