-- ============================================================
-- Migration: Stage 15 — Wave 2: Postmortem & Closure Enforcement
-- File: 20260421151000_stage15_postmortems.sql
-- ============================================================

BEGIN;

-- 1. PRODUCTION POSTMORTEMS TABLE
CREATE TABLE IF NOT EXISTS public.production_postmortems (
    incident_id         UUID        PRIMARY KEY REFERENCES public.production_incidents(id) ON DELETE CASCADE,
    
    -- Analysis (Mandatory for High Severity)
    root_cause          TEXT,
    contributing_factors TEXT,
    blast_radius        TEXT,
    detection_gap       TEXT,
    mitigation_used     TEXT,
    prevention_action   TEXT,
    
    -- Ownership
    owner               UUID        REFERENCES auth.users(id),
    due_date            DATE,
    
    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.production_postmortems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_postmortems"
  ON public.production_postmortems FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "admins_view_postmortems"
  ON public.production_postmortems FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
    )
  );

-- 2. CLOSURE ENFORCEMENT TRIGGER
-- Objective: SEV-1 and SEV-2 cannot move to 'closed' without a valid postmortem.

CREATE OR REPLACE FUNCTION public.fn_enforce_incident_closure()
RETURNS TRIGGER AS $$
DECLARE
    v_postmortem RECORD;
BEGIN
    -- Only trigger on transition to 'closed'
    IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
        
        -- High severity check (SEV-1, SEV-2)
        IF NEW.severity IN ('SEV-1', 'SEV-2') THEN
            
            -- Check for postmortem existence
            SELECT * INTO v_postmortem FROM public.production_postmortems WHERE incident_id = NEW.id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Incident % (severity %) cannot be closed without a postmortem.', NEW.id, NEW.severity;
            END IF;

            -- Severity-specific field validation
            IF v_postmortem.root_cause IS NULL OR v_postmortem.root_cause = '' THEN
                RAISE EXCEPTION 'Postmortem for % must include a root cause.', NEW.id;
            END IF;
            
            IF v_postmortem.prevention_action IS NULL OR v_postmortem.prevention_action = '' THEN
                RAISE EXCEPTION 'Postmortem for % must include a prevention action.', NEW.id;
            END IF;

            IF v_postmortem.owner IS NULL THEN
                RAISE EXCEPTION 'Postmortem for % must have an assigned owner.', NEW.id;
            END IF;
        END IF;

        -- Capture closed_at
        NEW.closed_at := now();
    END IF;

    -- Capture resolved_at
    IF NEW.status IN ('resolved', 'closed') AND (OLD.status NOT IN ('resolved', 'closed') OR OLD.status IS NULL) THEN
        NEW.resolved_at := COALESCE(NEW.resolved_at, now());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_enforce_incident_closure ON public.production_incidents;
CREATE TRIGGER tr_enforce_incident_closure
    BEFORE UPDATE ON public.production_incidents
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_incident_closure();

COMMIT;
