-- ============================================================
-- Migration: Stage 14 — Rollout Registry
-- File: 20260420120000_stage14_rollout_registry.sql
--
-- Goals:
--  1. rollout_phases — define rollout phases with gates and caps
--  2. rollout_phase_reviews — formal review artifacts per phase
--  3. Phase status model: planned→active→completed→blocked→rolled_back
--  4. Phase cooldown enforcement (24h minimum after major config changes)
--  5. Immediate abort trigger model
--  6. advance_rollout_phase() — blocked without formal review
--  7. block_rollout_phase() — immediate abort path
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ROLLOUT PHASES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rollout_phases (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Phase identity
  phase_number        INTEGER     NOT NULL UNIQUE,  -- 0=internal, 1=pilot, 2=limited, 3=broad, 4=full
  phase_name          TEXT        NOT NULL,
  description         TEXT,

  -- Status: planned | active | completed | blocked | rolled_back
  status              TEXT        NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'completed', 'blocked', 'rolled_back')),

  -- Phase gates — objective criteria
  max_offices         INTEGER     NOT NULL DEFAULT 1,
  max_sessions_per_day INTEGER    NOT NULL DEFAULT 10,
  max_active_jobs     INTEGER     NOT NULL DEFAULT 5,
  min_duration_hours  INTEGER     NOT NULL DEFAULT 24,   -- minimum hours in this phase before advancement
  budget_cap_usd      NUMERIC     NOT NULL DEFAULT 10.0,

  -- Enabled modules in this phase
  enabled_modules     TEXT[]      NOT NULL DEFAULT '{}',

  -- Monitoring window
  monitoring_window_hours INTEGER NOT NULL DEFAULT 24,

  -- Phase timing
  planned_start_at    TIMESTAMPTZ,
  actual_start_at     TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  blocked_at          TIMESTAMPTZ,
  rolled_back_at      TIMESTAMPTZ,

  -- Cooldown enforcement: cannot advance until this time
  -- Set when major config changes happen within phase
  cooldown_until      TIMESTAMPTZ,
  cooldown_reason     TEXT,

  -- Phase governance
  owner_user_id       UUID        REFERENCES auth.users(id),
  activated_by        UUID        REFERENCES auth.users(id),
  blocked_by          UUID        REFERENCES auth.users(id),
  block_reason        TEXT,

  -- Rollback config
  rollback_target_phase INTEGER,  -- which phase to roll back to

  -- Office cohort for this phase
  office_cohort       UUID[],     -- offices actively in this phase

  -- Go/no-go gates (objective criteria verdict)
  go_nogo_verdict     TEXT,       -- 'go' | 'no_go' | 'pending'
  go_nogo_evaluated_at TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rollout_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rollout_phases_service_role_all"
  ON public.rollout_phases FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "rollout_phases_admin_read"
  ON public.rollout_phases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_rollout_phases_status
  ON public.rollout_phases(status);

CREATE INDEX IF NOT EXISTS idx_rollout_phases_number
  ON public.rollout_phases(phase_number);

-- ============================================================
-- 2. ROLLOUT PHASE REVIEWS TABLE
-- Formal review artifact — required before phase advancement.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rollout_phase_reviews (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id         UUID        NOT NULL REFERENCES public.rollout_phases(id),

  -- Review metadata
  review_type      TEXT        NOT NULL,  -- 'pre_advance' | 'post_incident' | 'go_nogo' | 'rollback'
  reviewer_id      UUID        NOT NULL REFERENCES auth.users(id),
  reviewer_role    TEXT,

  -- Decision
  -- 'approved' | 'rejected' | 'conditional' | 'deferred'
  decision         TEXT        NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending', 'approved', 'rejected', 'conditional', 'deferred')),

  -- Checklist items (all must pass for 'go')
  checklist        JSONB       NOT NULL DEFAULT '[]',

  -- Evidence links
  evidence_links   TEXT[],

  -- Notes
  notes            TEXT,
  conditions       TEXT,       -- for 'conditional' decisions

  -- Metrics snapshot at review time
  metrics_snapshot JSONB,

  -- Timing
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at       TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,  -- reviews expire after 72h if not decided

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rollout_phase_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phase_reviews_service_role_all"
  ON public.rollout_phase_reviews FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "phase_reviews_admin_read"
  ON public.rollout_phase_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_phase_reviews_phase
  ON public.rollout_phase_reviews(phase_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_phase_reviews_decision
  ON public.rollout_phase_reviews(decision, phase_id);

-- ============================================================
-- 3. ROLLOUT ABORT TRIGGERS LOG
-- Records every immediate abort trigger event.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rollout_abort_triggers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id        UUID        REFERENCES public.rollout_phases(id),

  -- Trigger type
  trigger_type    TEXT        NOT NULL,
  -- 'CROSS_TENANT_VIOLATION' | 'CERTIFICATION_INCONSISTENCY' |
  -- 'UNAUTHORIZED_DESTRUCTIVE_ACTION' | 'DUPLICATE_AUTHORITATIVE_OUTPUT'

  -- Context
  session_id      UUID,
  office_id       UUID,
  triggered_by    UUID        REFERENCES auth.users(id),

  -- Detail
  trigger_detail  JSONB       NOT NULL DEFAULT '{}',
  action_taken    TEXT,       -- 'phase_blocked' | 'freeze_initiated' | 'rollback_initiated'

  -- Auto-routing
  freeze_initiated BOOLEAN    NOT NULL DEFAULT false,
  freeze_switch_id UUID,      -- reference to created kill-switch

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rollout_abort_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "abort_triggers_service_role_all"
  ON public.rollout_abort_triggers FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "abort_triggers_admin_read"
  ON public.rollout_abort_triggers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND is_active = true
    )
  );

-- ============================================================
-- 4. advance_rollout_phase() — gated phase advancement
--
-- Cannot advance without:
--  - approved formal review for this phase
--  - cooldown satisfied
--  - no active global kill switches
--  - go_nogo_verdict = 'go'
-- ============================================================
CREATE OR REPLACE FUNCTION public.advance_rollout_phase(
  p_phase_id    UUID,
  p_review_id   UUID,
  p_reason      TEXT DEFAULT 'Phase advancement approved'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       UUID;
  v_phase        RECORD;
  v_review       RECORD;
  v_next_phase   RECORD;
  v_active_ks    BIGINT;
BEGIN
  v_caller := auth.uid();

  -- Load current phase
  SELECT * INTO v_phase FROM public.rollout_phases
  WHERE id = p_phase_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PHASE_NOT_FOUND: %', p_phase_id;
  END IF;

  -- Phase must be active to advance
  IF v_phase.status != 'active' THEN
    RAISE EXCEPTION 'PHASE_NOT_ACTIVE: Phase % is in status %. Only active phases can be advanced.', p_phase_id, v_phase.status;
  END IF;

  -- Check cooldown
  IF v_phase.cooldown_until IS NOT NULL AND v_phase.cooldown_until > now() THEN
    RAISE EXCEPTION 'PHASE_COOLDOWN_ACTIVE: Cannot advance until %. Reason: %',
      v_phase.cooldown_until, v_phase.cooldown_reason;
  END IF;

  -- Validate formal review exists and is approved
  SELECT * INTO v_review FROM public.rollout_phase_reviews
  WHERE id = p_review_id
    AND phase_id = p_phase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND: Review % not found for phase %', p_review_id, p_phase_id;
  END IF;

  IF v_review.decision != 'approved' THEN
    RAISE EXCEPTION 'REVIEW_NOT_APPROVED: Review decision is %. Phase advancement requires approved review.', v_review.decision;
  END IF;

  -- Check go/no-go verdict
  IF v_phase.go_nogo_verdict IS DISTINCT FROM 'go' THEN
    RAISE EXCEPTION 'NOGO_VERDICT: Phase % has go/no-go verdict: %. Must be ''go'' to advance.', p_phase_id, COALESCE(v_phase.go_nogo_verdict, 'pending');
  END IF;

  -- Check minimum duration in phase
  IF v_phase.actual_start_at IS NOT NULL THEN
    IF EXTRACT(EPOCH FROM (now() - v_phase.actual_start_at)) / 3600 < v_phase.min_duration_hours THEN
      RAISE EXCEPTION 'MIN_DURATION_NOT_MET: Phase has been active for % hours. Minimum: % hours.',
        ROUND(EXTRACT(EPOCH FROM (now() - v_phase.actual_start_at)) / 3600, 1),
        v_phase.min_duration_hours;
    END IF;
  END IF;

  -- Check no active global kill switches
  SELECT COUNT(*) INTO v_active_ks FROM public.system_kill_switches
  WHERE is_active = true AND scope = 'global';

  IF v_active_ks > 0 THEN
    RAISE EXCEPTION 'KILL_SWITCH_ACTIVE: % global kill switches are active. Deactivate before advancing.', v_active_ks;
  END IF;

  -- Mark current phase as completed
  UPDATE public.rollout_phases
  SET status       = 'completed',
      completed_at = now(),
      updated_at   = now()
  WHERE id = p_phase_id;

  -- Find and activate next phase
  SELECT * INTO v_next_phase FROM public.rollout_phases
  WHERE phase_number = v_phase.phase_number + 1
    AND status = 'planned'
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.rollout_phases
    SET status          = 'active',
        actual_start_at = now(),
        activated_by    = v_caller,
        updated_at      = now()
    WHERE id = v_next_phase.id;
  END IF;

  -- Audit
  INSERT INTO public.session_audit_logs (
    session_id, office_id, action, resource_type, resource_id,
    performed_by, old_value, new_value, metadata
  ) VALUES (
    NULL, NULL, 'ROLLOUT_PHASE_ADVANCED', 'rollout_phase', p_phase_id,
    v_caller,
    jsonb_build_object('phase_number', v_phase.phase_number, 'status', 'active'),
    jsonb_build_object('phase_number', v_phase.phase_number, 'status', 'completed'),
    jsonb_build_object(
      'review_id',      p_review_id,
      'reason',         p_reason,
      'next_phase_id',  v_next_phase.id
    )
  );

  RETURN jsonb_build_object(
    'ok',             true,
    'completed_phase', v_phase.phase_number,
    'next_phase_id',  v_next_phase.id,
    'next_phase',     v_next_phase.phase_number,
    'advanced_at',    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.advance_rollout_phase(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_rollout_phase(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_rollout_phase(UUID, UUID, TEXT) TO authenticated;

-- ============================================================
-- 5. block_rollout_phase() — immediate abort path
-- Called automatically when abort triggers fire.
-- ============================================================
CREATE OR REPLACE FUNCTION public.block_rollout_phase(
  p_phase_id      UUID,
  p_trigger_type  TEXT,
  p_reason        TEXT,
  p_trigger_detail JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      UUID;
  v_phase       RECORD;
  v_abort_id    UUID;
  v_freeze_result JSONB;
BEGIN
  v_caller := auth.uid();

  -- Validate trigger type
  IF p_trigger_type NOT IN (
    'CROSS_TENANT_VIOLATION',
    'CERTIFICATION_INCONSISTENCY',
    'UNAUTHORIZED_DESTRUCTIVE_ACTION',
    'DUPLICATE_AUTHORITATIVE_OUTPUT'
  ) THEN
    RAISE EXCEPTION 'INVALID_TRIGGER_TYPE: %', p_trigger_type;
  END IF;

  -- Load phase
  SELECT * INTO v_phase FROM public.rollout_phases
  WHERE id = p_phase_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PHASE_NOT_FOUND: %', p_phase_id;
  END IF;

  -- Block the phase
  UPDATE public.rollout_phases
  SET status      = 'blocked',
      blocked_at  = now(),
      blocked_by  = v_caller,
      block_reason = format('[%s] %s', p_trigger_type, p_reason),
      updated_at  = now()
  WHERE id = p_phase_id;

  -- Record abort trigger
  INSERT INTO public.rollout_abort_triggers (
    phase_id, trigger_type, triggered_by,
    trigger_detail, action_taken, freeze_initiated
  ) VALUES (
    p_phase_id, p_trigger_type, v_caller,
    p_trigger_detail, 'phase_blocked', false
  )
  RETURNING id INTO v_abort_id;

  -- Audit
  INSERT INTO public.session_audit_logs (
    session_id, office_id, action, resource_type, resource_id,
    performed_by, old_value, new_value, metadata
  ) VALUES (
    NULL, NULL, 'ROLLOUT_PHASE_BLOCKED', 'rollout_phase', p_phase_id,
    v_caller,
    jsonb_build_object('status', v_phase.status),
    jsonb_build_object('status', 'blocked'),
    jsonb_build_object(
      'trigger_type',   p_trigger_type,
      'reason',         p_reason,
      'abort_event_id', v_abort_id
    )
  );

  RETURN jsonb_build_object(
    'ok',           true,
    'phase_id',     p_phase_id,
    'phase_blocked', true,
    'trigger_type', p_trigger_type,
    'abort_event_id', v_abort_id,
    'blocked_at',   now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.block_rollout_phase(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_rollout_phase(UUID, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.block_rollout_phase(UUID, TEXT, TEXT, JSONB) TO authenticated;

-- ============================================================
-- 6. set_phase_cooldown() — enforces 24h after major changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_phase_cooldown(
  p_phase_id UUID,
  p_reason   TEXT,
  p_hours    INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rollout_phases
  SET cooldown_until  = now() + (p_hours || ' hours')::INTERVAL,
      cooldown_reason = p_reason,
      updated_at      = now()
  WHERE id = p_phase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PHASE_NOT_FOUND: %', p_phase_id;
  END IF;

  RETURN jsonb_build_object(
    'ok',             true,
    'phase_id',       p_phase_id,
    'cooldown_until', now() + (p_hours || ' hours')::INTERVAL,
    'reason',         p_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_phase_cooldown(UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_phase_cooldown(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_phase_cooldown(UUID, TEXT, INTEGER) TO authenticated;

-- ============================================================
-- 7. submit_phase_review() — create formal review artifact
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_phase_review(
  p_phase_id      UUID,
  p_review_type   TEXT,
  p_checklist     JSONB,
  p_notes         TEXT    DEFAULT NULL,
  p_evidence_links TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review_id UUID;
BEGIN
  IF p_review_type NOT IN ('pre_advance', 'post_incident', 'go_nogo', 'rollback') THEN
    RAISE EXCEPTION 'INVALID_REVIEW_TYPE: %', p_review_type;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.rollout_phases WHERE id = p_phase_id) THEN
    RAISE EXCEPTION 'PHASE_NOT_FOUND: %', p_phase_id;
  END IF;

  INSERT INTO public.rollout_phase_reviews (
    phase_id, review_type, reviewer_id, reviewer_role,
    decision, checklist, notes, evidence_links,
    expires_at
  ) VALUES (
    p_phase_id, p_review_type, auth.uid(), p_review_type,
    'pending', p_checklist, p_notes, p_evidence_links,
    now() + INTERVAL '72 hours'
  )
  RETURNING id INTO v_review_id;

  RETURN jsonb_build_object(
    'ok',         true,
    'review_id',  v_review_id,
    'phase_id',   p_phase_id,
    'submitted_at', now(),
    'expires_at', now() + INTERVAL '72 hours'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_phase_review(UUID, TEXT, JSONB, TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_phase_review(UUID, TEXT, JSONB, TEXT, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_phase_review(UUID, TEXT, JSONB, TEXT, TEXT[]) TO authenticated;

-- ============================================================
-- 8. decide_phase_review() — approve/reject a review
-- ============================================================
CREATE OR REPLACE FUNCTION public.decide_phase_review(
  p_review_id  UUID,
  p_decision   TEXT,
  p_notes      TEXT DEFAULT NULL,
  p_conditions TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_decision NOT IN ('approved', 'rejected', 'conditional', 'deferred') THEN
    RAISE EXCEPTION 'INVALID_DECISION: %', p_decision;
  END IF;

  UPDATE public.rollout_phase_reviews
  SET decision    = p_decision,
      decided_at  = now(),
      notes       = COALESCE(p_notes, notes),
      conditions  = p_conditions
  WHERE id = p_review_id
    AND decision = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND_OR_ALREADY_DECIDED: %', p_review_id;
  END IF;

  RETURN jsonb_build_object(
    'ok',          true,
    'review_id',   p_review_id,
    'decision',    p_decision,
    'decided_at',  now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decide_phase_review(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_phase_review(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.decide_phase_review(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 9. SEED: Define the 5 rollout phases
-- ============================================================
INSERT INTO public.rollout_phases (
  phase_number, phase_name, description,
  status,
  max_offices, max_sessions_per_day, max_active_jobs, min_duration_hours, budget_cap_usd,
  enabled_modules, monitoring_window_hours, rollback_target_phase
)
VALUES
  (0, 'Internal Team Only', 'Core team only, internal offices, all features disabled. Shadow mode collection begins.',
   'active',
   1, 20, 5, 48, 5.0,
   ARRAY['session_pipeline'], 48, NULL),

  (1, 'Pilot — 1-3 Offices', 'Limited beta with 1-3 pre-selected offices. AI generation enabled in shadow mode only.',
   'planned',
   3, 50, 15, 72, 20.0,
   ARRAY['session_pipeline', 'shadow_mode_legal', 'shadow_mode_medical'], 72, 0),

  (2, 'Limited — 5-10 Offices', 'Expanded pilot. Legal AI generation enabled for opt-in offices.',
   'planned',
   10, 200, 50, 168, 100.0,
   ARRAY['session_pipeline', 'legal_ai_generation', 'shadow_mode_medical'], 168, 1),

  (3, 'Broad — 20-50% Offices', 'Wide rollout. Medical AI enabled. Full monitoring active.',
   'planned',
   50, 1000, 200, 336, 500.0,
   ARRAY['session_pipeline', 'legal_ai_generation', 'medical_ai_generation', 'medical_certification_flow'], 336, 2),

  (4, 'Full Production', 'All offices. All features enabled per office configuration.',
   'planned',
   9999, 99999, 9999, 720, 99999.0,
   ARRAY['session_pipeline', 'legal_ai_generation', 'medical_ai_generation', 'medical_certification_flow', 'voice_critical_actions', 'ocr_auto_suggest'], 720, 3)

ON CONFLICT (phase_number) DO UPDATE
SET phase_name          = EXCLUDED.phase_name,
    description         = EXCLUDED.description,
    max_offices         = EXCLUDED.max_offices,
    enabled_modules     = EXCLUDED.enabled_modules,
    monitoring_window_hours = EXCLUDED.monitoring_window_hours;

COMMIT;
