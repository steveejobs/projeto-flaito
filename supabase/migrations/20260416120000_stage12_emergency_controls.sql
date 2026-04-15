-- ============================================================
-- Migration: Stage 12 — Emergency Controls (Kill-Switches)
-- File: 20260416120000_stage12_emergency_controls.sql
--
-- Goals:
--  1. system_kill_switches table with full audit trail
--  2. activate / confirm / deactivate / is_active RPCs
--  3. Integration hooks: claim_session_job respects worker_drain
-- ============================================================

BEGIN;

-- ============================================================
-- 1. KILL SWITCHES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_kill_switches (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- scope: 'global' | 'office'
  scope                 TEXT        NOT NULL,
  -- scope_id: office_id when scope='office', NULL for global
  scope_id              TEXT,
  -- switch_type: 'ai_generation' | 'session_processing' | 'voice_actions' | 'worker_drain' | 'operator_freeze'
  switch_type           TEXT        NOT NULL,
  is_active             BOOLEAN     NOT NULL DEFAULT false,
  activated_by          UUID        REFERENCES auth.users(id),
  activated_at          TIMESTAMPTZ,
  activation_reason     TEXT        NOT NULL,
  deactivated_by        UUID        REFERENCES auth.users(id),
  deactivated_at        TIMESTAMPTZ,
  deactivation_reason   TEXT,
  -- Confirmation required: global scope switches need a token
  requires_confirmation BOOLEAN     NOT NULL DEFAULT true,
  -- token sent to caller, must be echoed back to confirm_kill_switch
  confirmation_token    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_kill_switches ENABLE ROW LEVEL SECURITY;

-- Service role: full access (workers check switches)
CREATE POLICY "kill_switch_service_role_all"
  ON public.system_kill_switches FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Operators can read switches for their office
CREATE POLICY "kill_switch_operator_read"
  ON public.system_kill_switches FOR SELECT
  USING (
    scope = 'global'
    OR scope_id IN (
      SELECT office_id::TEXT FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_kill_switches_active
  ON public.system_kill_switches(switch_type, scope, scope_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_kill_switches_type_scope
  ON public.system_kill_switches(switch_type, scope_id, is_active);

-- ============================================================
-- 2. activate_kill_switch()
-- Creates a new kill-switch record in pending state.
-- For global scope: returns a confirmation_token.
-- For office voice/processing: activates immediately.
-- Returns the switch UUID and confirmation_token (if applicable).
-- ============================================================
CREATE OR REPLACE FUNCTION public.activate_kill_switch(
  p_switch_type TEXT,
  p_scope       TEXT DEFAULT 'global',
  p_scope_id    TEXT DEFAULT NULL,
  p_reason      TEXT DEFAULT 'No reason provided'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid         UUID;
  v_confirmation_token TEXT;
  v_requires_confirm   BOOLEAN;
  v_switch_id          UUID;
  v_activate_now       BOOLEAN;
BEGIN
  v_caller_uid := auth.uid();

  -- Validate switch_type
  IF p_switch_type NOT IN ('ai_generation', 'session_processing', 'voice_actions', 'worker_drain', 'operator_freeze') THEN
    RAISE EXCEPTION 'INVALID_SWITCH_TYPE: %. Valid types: ai_generation, session_processing, voice_actions, worker_drain, operator_freeze',
      p_switch_type;
  END IF;

  -- Validate scope
  IF p_scope NOT IN ('global', 'office') THEN
    RAISE EXCEPTION 'INVALID_SCOPE: %. Valid: global, office', p_scope;
  END IF;

  IF p_scope = 'office' AND p_scope_id IS NULL THEN
    RAISE EXCEPTION 'SCOPE_ID_REQUIRED: office scope requires scope_id (office UUID)';
  END IF;

  -- Determine if confirmation is required
  -- Global switches always require confirmation (high blast radius)
  -- Voice actions at office scope: immediate (lower blast radius)
  v_requires_confirm := (p_scope = 'global');
  v_activate_now     := NOT v_requires_confirm;

  -- Generate confirmation token for global switches
  v_confirmation_token := CASE WHEN v_requires_confirm
    THEN encode(gen_random_bytes(16), 'hex')
    ELSE NULL
  END;

  INSERT INTO public.system_kill_switches (
    scope, scope_id, switch_type,
    is_active, activated_by, activated_at,
    activation_reason, requires_confirmation, confirmation_token
  ) VALUES (
    p_scope, p_scope_id, p_switch_type,
    v_activate_now,
    CASE WHEN v_activate_now THEN v_caller_uid ELSE NULL END,
    CASE WHEN v_activate_now THEN now() ELSE NULL END,
    p_reason, v_requires_confirm, v_confirmation_token
  )
  RETURNING id INTO v_switch_id;

  -- Audit
  INSERT INTO public.session_audit_logs (
    session_id, office_id, action, resource_type, resource_id,
    performed_by, old_value, new_value, metadata
  )
  SELECT
    NULL, NULL,
    'KILL_SWITCH_ACTIVATE_REQUEST', 'system_kill_switch', v_switch_id,
    v_caller_uid,
    jsonb_build_object('is_active', false),
    jsonb_build_object('is_active', v_activate_now),
    jsonb_build_object(
      'switch_type',  p_switch_type,
      'scope',        p_scope,
      'scope_id',     p_scope_id,
      'requires_confirmation', v_requires_confirm,
      'reason',       p_reason
    )
  WHERE v_caller_uid IS NOT NULL;

  RETURN jsonb_build_object(
    'switch_id',           v_switch_id,
    'activated',           v_activate_now,
    'requires_confirmation', v_requires_confirm,
    'confirmation_token',  v_confirmation_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_kill_switch(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_kill_switch(TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_kill_switch(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 3. confirm_kill_switch()
-- Confirms activation of a pending kill-switch using the token.
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_kill_switch(
  p_switch_id         UUID,
  p_confirmation_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_switch     RECORD;
BEGIN
  v_caller_uid := auth.uid();

  SELECT * INTO v_switch
  FROM public.system_kill_switches
  WHERE id = p_switch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SWITCH_NOT_FOUND: %', p_switch_id;
  END IF;

  IF v_switch.is_active THEN
    RETURN jsonb_build_object('ok', true, 'already_active', true, 'switch_id', p_switch_id);
  END IF;

  IF v_switch.confirmation_token IS DISTINCT FROM p_confirmation_token THEN
    RAISE EXCEPTION 'INVALID_CONFIRMATION_TOKEN: Token mismatch for switch %', p_switch_id;
  END IF;

  UPDATE public.system_kill_switches
  SET is_active          = true,
      activated_by       = v_caller_uid,
      activated_at       = now(),
      confirmation_token = NULL,   -- consume token after use
      updated_at         = now()
  WHERE id = p_switch_id;

  -- Audit confirmed activation
  INSERT INTO public.session_audit_logs (
    session_id, office_id, action, resource_type, resource_id,
    performed_by, old_value, new_value, metadata
  )
  SELECT
    NULL, NULL,
    'KILL_SWITCH_CONFIRMED', 'system_kill_switch', p_switch_id,
    v_caller_uid,
    jsonb_build_object('is_active', false),
    jsonb_build_object('is_active', true),
    jsonb_build_object('switch_type', v_switch.switch_type, 'scope', v_switch.scope, 'scope_id', v_switch.scope_id)
  WHERE v_caller_uid IS NOT NULL;

  RETURN jsonb_build_object('ok', true, 'switch_id', p_switch_id, 'activated_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_kill_switch(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_kill_switch(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_kill_switch(UUID, TEXT) TO authenticated;

-- ============================================================
-- 4. deactivate_kill_switch()
-- Deactivates an active kill-switch. Fully audited.
-- ============================================================
CREATE OR REPLACE FUNCTION public.deactivate_kill_switch(
  p_switch_id UUID,
  p_reason    TEXT DEFAULT 'Manual deactivation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_switch     RECORD;
BEGIN
  v_caller_uid := auth.uid();

  SELECT * INTO v_switch
  FROM public.system_kill_switches
  WHERE id = p_switch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SWITCH_NOT_FOUND: %', p_switch_id;
  END IF;

  IF NOT v_switch.is_active THEN
    RETURN jsonb_build_object('ok', true, 'already_inactive', true, 'switch_id', p_switch_id);
  END IF;

  UPDATE public.system_kill_switches
  SET is_active           = false,
      deactivated_by      = v_caller_uid,
      deactivated_at      = now(),
      deactivation_reason = p_reason,
      updated_at          = now()
  WHERE id = p_switch_id;

  INSERT INTO public.session_audit_logs (
    session_id, office_id, action, resource_type, resource_id,
    performed_by, old_value, new_value, metadata
  )
  SELECT
    NULL, NULL,
    'KILL_SWITCH_DEACTIVATED', 'system_kill_switch', p_switch_id,
    v_caller_uid,
    jsonb_build_object('is_active', true),
    jsonb_build_object('is_active', false),
    jsonb_build_object(
      'switch_type',         v_switch.switch_type,
      'scope',               v_switch.scope,
      'scope_id',            v_switch.scope_id,
      'deactivation_reason', p_reason
    )
  WHERE v_caller_uid IS NOT NULL;

  RETURN jsonb_build_object('ok', true, 'switch_id', p_switch_id, 'deactivated_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_kill_switch(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_kill_switch(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_kill_switch(UUID, TEXT) TO authenticated;

-- ============================================================
-- 5. is_kill_switch_active()
-- Fast read-only check used by workers and Edge Functions.
-- Checks both global scope and office-specific scope.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_kill_switch_active(
  p_switch_type TEXT,
  p_scope_id    TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.system_kill_switches
    WHERE switch_type = p_switch_type
      AND is_active   = true
      AND (
        scope = 'global'
        OR (scope = 'office' AND scope_id = p_scope_id)
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_kill_switch_active(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_kill_switch_active(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_kill_switch_active(TEXT, TEXT) TO authenticated;

-- ============================================================
-- 6. EXTEND claim_session_job with kill-switch awareness
-- Workers check worker_drain before claiming new jobs.
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_session_job(
  p_worker_id      TEXT,
  p_worker_type    TEXT     DEFAULT 'CPU',
  p_max_jobs       INTEGER  DEFAULT 1,
  p_lease_duration INTERVAL DEFAULT '5 minutes'
)
RETURNS SETOF public.session_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Kill-switch: worker_drain — workers must stop claiming new jobs
  IF public.is_kill_switch_active('worker_drain') THEN
    RAISE EXCEPTION 'KILL_SWITCH_ACTIVE: worker_drain is enabled. Workers must not claim new jobs.';
  END IF;

  RETURN QUERY
  WITH target_jobs AS (
    SELECT j.id
    FROM   public.session_jobs j
    WHERE  (j.status = 'queued' OR (j.status = 'failed' AND j.scheduled_at <= NOW()))
      AND  (j.lease_expires_at IS NULL OR j.lease_expires_at <= NOW())
      -- Kill-switch: session_processing per office
      AND  NOT public.is_kill_switch_active('session_processing', j.office_id::TEXT)
    ORDER BY j.priority DESC, j.scheduled_at ASC
    LIMIT p_max_jobs
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.session_jobs
  SET
    status           = 'claimed',
    worker_id        = p_worker_id,
    claimed_at       = NOW(),
    lease_expires_at = NOW() + p_lease_duration,
    attempt_count    = attempt_count + 1,
    updated_at       = NOW()
  FROM target_jobs
  WHERE public.session_jobs.id = target_jobs.id
  RETURNING public.session_jobs.*;
END;
$$;

-- ============================================================
-- 7. SEED: Initialize kill-switch defaults (all inactive)
-- ============================================================
INSERT INTO public.system_kill_switches (scope, switch_type, is_active, activation_reason)
VALUES
  ('global', 'ai_generation',      false, 'System default — inactive'),
  ('global', 'worker_drain',       false, 'System default — inactive'),
  ('global', 'operator_freeze',    false, 'System default — inactive')
ON CONFLICT DO NOTHING;

COMMIT;
