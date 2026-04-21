-- ============================================================
-- Migration: Stage 14 — Incident Controls & Operator Safe Mode
-- File: 20260420140000_stage14_incident_controls.sql
--
-- Goals:
--  1. operator_safe_mode table — toggleable restricted incident mode
--  2. operator_safe_mode_log — audit log for safe mode changes
--  3. check_operator_safe_mode() — fast check for edge functions
--  4. enable_operator_safe_mode() — activates restricted mode
--  5. disable_operator_safe_mode() — deactivates with audit
--  6. execute_global_freeze() — GLOBAL_FREEZE_SEQUENCE in < 30s
--  7. get_freeze_status() — current freeze state summary
--  8. rollback_surface_path() — per-surface rollback documentation
-- ============================================================

BEGIN;

-- ============================================================
-- 1. OPERATOR SAFE MODE TABLE
-- One record per scope (global or office).
-- When active: only kill-switch, flag rollback, read-only, readiness.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.operator_safe_mode (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           TEXT        NOT NULL CHECK (scope IN ('global', 'office')),
  scope_id        TEXT,

  is_active       BOOLEAN     NOT NULL DEFAULT false,

  activated_by    UUID        REFERENCES auth.users(id),
  activated_at    TIMESTAMPTZ,
  activation_reason TEXT,

  deactivated_by  UUID        REFERENCES auth.users(id),
  deactivated_at  TIMESTAMPTZ,
  deactivation_reason TEXT,

  -- Incident context
  incident_id     TEXT,       -- optional external incident tracking ID
  phase_id        UUID        REFERENCES public.rollout_phases(id),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT safe_mode_unique UNIQUE (scope, COALESCE(scope_id, ''))
);

ALTER TABLE public.operator_safe_mode ENABLE ROW LEVEL SECURITY;

CREATE POLICY "safe_mode_service_role_all"
  ON public.operator_safe_mode FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "safe_mode_admin_read"
  ON public.operator_safe_mode FOR SELECT
  USING (
    scope = 'global'
    OR scope_id IN (
      SELECT office_id::TEXT FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND is_active = true
    )
  );

-- ============================================================
-- 2. OPERATOR SAFE MODE LOG — blocked action audit
-- All attempted blocked actions are logged.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.operator_safe_mode_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope          TEXT        NOT NULL,
  scope_id       TEXT,

  -- What was attempted
  attempted_action TEXT      NOT NULL,
  action_context   JSONB     NOT NULL DEFAULT '{}',

  -- Outcome
  -- 'allowed' | 'blocked' | 'safe_mode_toggled'
  outcome        TEXT        NOT NULL,
  block_reason   TEXT,

  attempted_by   UUID        REFERENCES auth.users(id),
  attempted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_safe_mode_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "safe_mode_log_service_role_all"
  ON public.operator_safe_mode_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "safe_mode_log_admin_read"
  ON public.operator_safe_mode_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_safe_mode_log_blocked
  ON public.operator_safe_mode_log(outcome, attempted_at DESC)
  WHERE outcome = 'blocked';

-- ============================================================
-- 3. check_operator_safe_mode() — fast check (< 50ms)
-- Used by edge functions before executing operator actions.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_operator_safe_mode(
  p_scope_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.operator_safe_mode
    WHERE is_active = true
      AND (
        scope = 'global'
        OR (scope = 'office' AND scope_id = p_scope_id)
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_operator_safe_mode(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_operator_safe_mode(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_operator_safe_mode(TEXT) TO authenticated;

-- ============================================================
-- 4. log_safe_mode_blocked_action() — records blocked attempt
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_safe_mode_blocked_action(
  p_attempted_action TEXT,
  p_action_context   JSONB   DEFAULT '{}',
  p_scope_id         TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.operator_safe_mode_log (
    scope, scope_id, attempted_action, action_context,
    outcome, block_reason, attempted_by
  ) VALUES (
    CASE WHEN p_scope_id IS NULL THEN 'global' ELSE 'office' END,
    p_scope_id,
    p_attempted_action, p_action_context,
    'blocked', 'Operator safe mode is active. Only read-only, kill-switch, and flag rollback actions are permitted.',
    auth.uid()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_safe_mode_blocked_action(TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_safe_mode_blocked_action(TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_safe_mode_blocked_action(TEXT, JSONB, TEXT) TO authenticated;

-- ============================================================
-- 5. enable_operator_safe_mode() — activates restricted mode
-- ============================================================
CREATE OR REPLACE FUNCTION public.enable_operator_safe_mode(
  p_reason     TEXT,
  p_scope      TEXT  DEFAULT 'global',
  p_scope_id   TEXT  DEFAULT NULL,
  p_incident_id TEXT DEFAULT NULL,
  p_phase_id   UUID  DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_id     UUID;
BEGIN
  v_caller := auth.uid();

  INSERT INTO public.operator_safe_mode (
    scope, scope_id, is_active,
    activated_by, activated_at, activation_reason,
    incident_id, phase_id
  ) VALUES (
    p_scope, p_scope_id, true,
    v_caller, now(), p_reason,
    p_incident_id, p_phase_id
  )
  ON CONFLICT (scope, COALESCE(scope_id, '')) DO UPDATE
  SET is_active         = true,
      activated_by      = v_caller,
      activated_at      = now(),
      activation_reason = p_reason,
      incident_id       = p_incident_id,
      deactivated_by    = NULL,
      deactivated_at    = NULL,
      updated_at        = now()
  RETURNING id INTO v_id;

  -- Audit
  INSERT INTO public.operator_safe_mode_log (
    scope, scope_id, attempted_action, action_context, outcome, attempted_by
  ) VALUES (
    p_scope, p_scope_id, 'ENABLE_SAFE_MODE',
    jsonb_build_object('reason', p_reason, 'incident_id', p_incident_id),
    'safe_mode_toggled', v_caller
  );

  -- Also update feature flag: operator_destructive_actions → disabled
  PERFORM public.set_feature_flag(
    'operator_destructive_actions', 'disabled', p_scope, p_scope_id,
    format('Operator safe mode activated: %s', p_reason), 'system'
  );

  RETURN jsonb_build_object(
    'ok',          true,
    'safe_mode_id', v_id,
    'scope',       p_scope,
    'activated_at', now(),
    'effect',      'Destructive actions disabled. Only kill-switch, flag rollback, read-only, and readiness checks permitted.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enable_operator_safe_mode(TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enable_operator_safe_mode(TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.enable_operator_safe_mode(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- ============================================================
-- 6. disable_operator_safe_mode()
-- ============================================================
CREATE OR REPLACE FUNCTION public.disable_operator_safe_mode(
  p_reason   TEXT,
  p_scope    TEXT DEFAULT 'global',
  p_scope_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
BEGIN
  v_caller := auth.uid();

  UPDATE public.operator_safe_mode
  SET is_active           = false,
      deactivated_by      = v_caller,
      deactivated_at      = now(),
      deactivation_reason = p_reason,
      updated_at          = now()
  WHERE scope = p_scope
    AND COALESCE(scope_id, '') = COALESCE(p_scope_id, '')
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Safe mode was not active for this scope');
  END IF;

  INSERT INTO public.operator_safe_mode_log (
    scope, scope_id, attempted_action, action_context, outcome, attempted_by
  ) VALUES (
    p_scope, p_scope_id, 'DISABLE_SAFE_MODE',
    jsonb_build_object('reason', p_reason),
    'safe_mode_toggled', v_caller
  );

  RETURN jsonb_build_object(
    'ok',             true,
    'scope',          p_scope,
    'deactivated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.disable_operator_safe_mode(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disable_operator_safe_mode(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.disable_operator_safe_mode(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 7. execute_global_freeze() — GLOBAL_FREEZE_SEQUENCE
--
-- Executes in order (designed for < 30 seconds total):
--  Step 1: worker_drain kill-switch (global)
--  Step 2: ai_generation kill-switch (global)
--  Step 3: voice_actions kill-switch (global)
--  Step 4: operator_destructive_actions → disabled via feature flag
--  Step 5: operator_safe_mode → enabled
--  Step 6: log operator + timestamp + reason
--  Step 7: (notification to ops is async — documented in runbook)
--
-- Returns full audit of all actions taken.
-- ============================================================
CREATE OR REPLACE FUNCTION public.execute_global_freeze(
  p_reason     TEXT,
  p_incident_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freeze_start   TIMESTAMPTZ := now();
  v_caller         UUID        := auth.uid();
  v_steps          JSONB       := '[]'::JSONB;
  v_step_result    JSONB;
  v_ks_result      JSONB;
  v_step_ts        TIMESTAMPTZ;
  v_freeze_id      TEXT        := gen_random_uuid()::TEXT;
BEGIN
  -- ==== STEP 1: worker_drain kill-switch ====
  v_step_ts := clock_timestamp();
  BEGIN
    -- Activate without confirmation (emergency path bypasses confirmation)
    INSERT INTO public.system_kill_switches (
      scope, switch_type, is_active,
      activated_by, activated_at, activation_reason,
      requires_confirmation
    ) VALUES (
      'global', 'worker_drain', true,
      v_caller, v_step_ts,
      format('[GLOBAL_FREEZE %s] %s', v_freeze_id, p_reason),
      false
    )
    ON CONFLICT DO NOTHING;

    -- Also update existing if inactive
    UPDATE public.system_kill_switches
    SET is_active        = true,
        activated_by     = v_caller,
        activated_at     = v_step_ts,
        activation_reason = format('[GLOBAL_FREEZE %s] %s', v_freeze_id, p_reason),
        updated_at       = v_step_ts
    WHERE switch_type = 'worker_drain'
      AND scope = 'global'
      AND is_active = false;

    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'step', 1, 'action', 'kill_switch(worker_drain, global)',
      'status', 'DONE', 'ts', v_step_ts
    ));
  EXCEPTION WHEN OTHERS THEN
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'step', 1, 'action', 'kill_switch(worker_drain, global)',
      'status', 'ERROR', 'error', SQLERRM, 'ts', clock_timestamp()
    ));
  END;

  -- ==== STEP 2: ai_generation kill-switch ====
  v_step_ts := clock_timestamp();
  BEGIN
    INSERT INTO public.system_kill_switches (
      scope, switch_type, is_active, activated_by, activated_at,
      activation_reason, requires_confirmation
    ) VALUES (
      'global', 'ai_generation', true, v_caller, v_step_ts,
      format('[GLOBAL_FREEZE %s] %s', v_freeze_id, p_reason), false
    )
    ON CONFLICT DO NOTHING;

    UPDATE public.system_kill_switches
    SET is_active = true, activated_by = v_caller, activated_at = v_step_ts,
        activation_reason = format('[GLOBAL_FREEZE %s] %s', v_freeze_id, p_reason),
        updated_at = v_step_ts
    WHERE switch_type = 'ai_generation' AND scope = 'global' AND is_active = false;

    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'step', 2, 'action', 'kill_switch(ai_generation, global)',
      'status', 'DONE', 'ts', v_step_ts
    ));
  EXCEPTION WHEN OTHERS THEN
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'step', 2, 'action', 'kill_switch(ai_generation, global)',
      'status', 'ERROR', 'error', SQLERRM, 'ts', clock_timestamp()
    ));
  END;

  -- ==== STEP 3: voice_actions kill-switch ====
  v_step_ts := clock_timestamp();
  BEGIN
    INSERT INTO public.system_kill_switches (
      scope, switch_type, is_active, activated_by, activated_at,
      activation_reason, requires_confirmation
    ) VALUES (
      'global', 'voice_actions', true, v_caller, v_step_ts,
      format('[GLOBAL_FREEZE %s] %s', v_freeze_id, p_reason), false
    )
    ON CONFLICT DO NOTHING;

    UPDATE public.system_kill_switches
    SET is_active = true, activated_by = v_caller, activated_at = v_step_ts,
        activation_reason = format('[GLOBAL_FREEZE %s] %s', v_freeze_id, p_reason),
        updated_at = v_step_ts
    WHERE switch_type = 'voice_actions' AND scope = 'global' AND is_active = false;

    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'step', 3, 'action', 'kill_switch(voice_actions, global)',
      'status', 'DONE', 'ts', v_step_ts
    ));
  EXCEPTION WHEN OTHERS THEN
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'step', 3, 'action', 'kill_switch(voice_actions, global)',
      'status', 'ERROR', 'error', SQLERRM, 'ts', clock_timestamp()
    ));
  END;

  -- ==== STEP 4: operator_destructive_actions → disabled ====
  v_step_ts := clock_timestamp();
  BEGIN
    PERFORM public.set_feature_flag(
      'operator_destructive_actions', 'disabled', 'global', NULL,
      format('[GLOBAL_FREEZE %s] %s', v_freeze_id, p_reason), 'system_freeze'
    );
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'step', 4, 'action', 'flag(operator_destructive_actions, disabled)',
      'status', 'DONE', 'ts', v_step_ts
    ));
  EXCEPTION WHEN OTHERS THEN
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'step', 4, 'action', 'flag(operator_destructive_actions, disabled)',
      'status', 'ERROR', 'error', SQLERRM, 'ts', clock_timestamp()
    ));
  END;

  -- ==== STEP 5: enable operator safe mode ====
  v_step_ts := clock_timestamp();
  BEGIN
    PERFORM public.enable_operator_safe_mode(
      format('[GLOBAL_FREEZE %s] %s', v_freeze_id, p_reason),
      'global', NULL, p_incident_id, NULL
    );
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'step', 5, 'action', 'enable_operator_safe_mode(global)',
      'status', 'DONE', 'ts', v_step_ts
    ));
  EXCEPTION WHEN OTHERS THEN
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'step', 5, 'action', 'enable_operator_safe_mode(global)',
      'status', 'ERROR', 'error', SQLERRM, 'ts', clock_timestamp()
    ));
  END;

  -- ==== STEP 6: Full audit log ====
  INSERT INTO public.session_audit_logs (
    session_id, office_id, action, resource_type, resource_id,
    performed_by, old_value, new_value, metadata
  ) VALUES (
    NULL, NULL, 'GLOBAL_FREEZE_EXECUTED', 'system', NULL,
    v_caller,
    jsonb_build_object('freeze_active', false),
    jsonb_build_object('freeze_active', true),
    jsonb_build_object(
      'freeze_id',    v_freeze_id,
      'reason',       p_reason,
      'incident_id',  p_incident_id,
      'steps',        v_steps,
      'operator',     v_caller,
      'freeze_duration_ms', EXTRACT(EPOCH FROM (now() - v_freeze_start)) * 1000
    )
  );

  RETURN jsonb_build_object(
    'ok',              true,
    'freeze_id',       v_freeze_id,
    'freeze_started',  v_freeze_start,
    'freeze_completed', now(),
    'freeze_duration_ms', ROUND(EXTRACT(EPOCH FROM (now() - v_freeze_start)) * 1000),
    'meets_30s_target', EXTRACT(EPOCH FROM (now() - v_freeze_start)) <= 30,
    'reason',          p_reason,
    'incident_id',     p_incident_id,
    'operator',        v_caller,
    'steps',           v_steps,
    'note',            'Step 7 (notify active operators) must be completed manually per GLOBAL_FREEZE_SEQUENCE runbook.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_global_freeze(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_global_freeze(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_global_freeze(TEXT, TEXT) TO authenticated;

-- ============================================================
-- 8. get_freeze_status() — current freeze state
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_freeze_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'queried_at', now(),
    'kill_switches', (
      SELECT jsonb_agg(jsonb_build_object(
        'switch_type',  switch_type,
        'scope',       scope,
        'is_active',   is_active,
        'activated_at', activated_at,
        'reason',      activation_reason
      ))
      FROM public.system_kill_switches
      WHERE scope = 'global'
      ORDER BY switch_type
    ),
    'operator_safe_mode', (
      SELECT jsonb_build_object(
        'is_active',    is_active,
        'activated_at', activated_at,
        'reason',       activation_reason
      )
      FROM public.operator_safe_mode
      WHERE scope = 'global'
      LIMIT 1
    ),
    'operator_destructive_actions_flag', (
      SELECT value FROM public.feature_flags
      WHERE flag_name = 'operator_destructive_actions' AND scope = 'global'
    ),
    'active_global_kill_switches', (
      SELECT COUNT(*) FROM public.system_kill_switches
      WHERE is_active = true AND scope = 'global'
    ),
    'any_freeze_active', (
      SELECT COUNT(*) > 0 FROM public.system_kill_switches
      WHERE is_active = true AND scope = 'global'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_freeze_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_freeze_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_freeze_status() TO authenticated;

-- ============================================================
-- 9. ROLLBACK SURFACE REGISTRY — per-surface rollback config
-- Documents rollback action, in-flight behavior, reversibility
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rollback_surface_registry (
  surface_name          TEXT PRIMARY KEY,
  rollback_action       TEXT NOT NULL,
  in_flight_behavior    TEXT NOT NULL,
  is_reversible         BOOLEAN NOT NULL,
  data_consequences     TEXT,
  audit_requirements    TEXT,
  kill_switch_type      TEXT,
  feature_flag_name     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rollback_surface_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rollback_registry_service_role_all"
  ON public.rollback_surface_registry FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "rollback_registry_all_read"
  ON public.rollback_surface_registry FOR SELECT
  USING (true);

INSERT INTO public.rollback_surface_registry
  (surface_name, rollback_action, in_flight_behavior, is_reversible, data_consequences, audit_requirements, kill_switch_type, feature_flag_name)
VALUES
  ('session_pipeline',
   'Activate worker_drain kill-switch. In-flight sessions complete current stage, no new claims.',
   'In-flight sessions allowed to reach session-end checkpoint. Orphaned sessions reclaimed after lease expiry.',
   true,
   'No data loss. Sessions remain in DB. Transcripts/snapshots preserved.',
   'Kill-switch activation logged. session_audit_logs entry required with operator + reason.',
   'worker_drain', NULL),

  ('ai_generation',
   'Activate ai_generation kill-switch + set feature flags: ai_generation, legal_ai_generation, medical_ai_generation → disabled.',
   'In-flight AI requests finish. New requests blocked immediately with KILL_SWITCH_ACTIVE error.',
   true,
   'Partially completed AI outputs may be in draft state. No data loss. Rollback clears pending generation flags on sessions.',
   'Kill-switch logged. Feature flag changes audited in feature_flag_audit_log.',
   'ai_generation', 'ai_generation'),

  ('legal_generation',
   'Set legal_ai_generation feature flag → disabled. If immediate: also activate ai_generation kill-switch.',
   'In-flight NIJA pipeline stages complete current document stage. New legal generation requests blocked.',
   true,
   'Partially assembled dossiers remain in draft state. No data deleted. Reassembly possible when re-enabled.',
   'Feature flag change audited. Any in-flight dossier stage logged in session_audit_logs.',
   'ai_generation', 'legal_ai_generation'),

  ('medical_certification',
   'Set medical_certification_flow feature flag → disabled. Medical reports revert to draft/pending state.',
   'In-flight certification reviews complete. New certification requests blocked.',
   true,
   'Pending certifications remain in pending state. Signed reports remain valid. No data rollback.',
   'Flag change audited. medical_report_reviews entries must reflect blocked_at timestamp.',
   NULL, 'medical_certification_flow'),

  ('voice_actions',
   'Activate voice_actions kill-switch. Set voice_critical_actions flag → disabled.',
   'Active voice sessions stop processing new commands. Pending PTT actions cancelled with safe acknowledgment.',
   true,
   'No data loss. Voice confirmations cancelled gracefully. Audit trail preserved.',
   'Kill-switch logged. voice_action_logs must capture all cancelled confirmations.',
   'voice_actions', 'voice_critical_actions'),

  ('ocr_auto_suggest',
   'Set ocr_auto_suggest feature flag → disabled. OCR processing continues; auto-suggest UI hidden.',
   'In-flight OCR extractions complete. Auto-suggest responses return empty. Manual intake flow available.',
   true,
   'No data loss. All OCR extractions stored. Suggestions simply not surfaced to users.',
   'Flag change audited.',
   NULL, 'ocr_auto_suggest')

ON CONFLICT (surface_name) DO UPDATE
SET rollback_action    = EXCLUDED.rollback_action,
    in_flight_behavior = EXCLUDED.in_flight_behavior,
    data_consequences  = EXCLUDED.data_consequences;

-- ============================================================
-- 10. SEED: Initialize safe mode record (inactive)
-- ============================================================
INSERT INTO public.operator_safe_mode (scope, scope_id, is_active, activation_reason)
VALUES ('global', NULL, false, 'System default — inactive')
ON CONFLICT (scope, COALESCE(scope_id, '')) DO NOTHING;

COMMIT;
