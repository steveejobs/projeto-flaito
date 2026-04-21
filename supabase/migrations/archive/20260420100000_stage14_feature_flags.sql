-- ============================================================
-- Migration: Stage 14 — Feature Flags Foundation
-- File: 20260420100000_stage14_feature_flags.sql
--
-- Goals:
--  1. feature_flags table (scope hierarchy: global→office→user)
--  2. check_feature_flag() RPC — runtime resolution
--  3. set_feature_flag()   RPC — audited write + thrashing protection
--  4. feature_flag_audit_log table — immutable write trail
--  5. Thrashing protection: 60s cooldown OR max 3 changes per 5min
--  6. Kill-switch always overrides feature flags (enforced in check)
--
-- Scope resolution order: user → office → global
-- Supported values: 'enabled' | 'disabled' | 'shadow'
-- ============================================================

BEGIN;

-- ============================================================
-- 1. FEATURE FLAGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Flag name — one of the canonical set
  flag_name    TEXT        NOT NULL,

  -- Scope: 'global' | 'office' | 'user'
  scope        TEXT        NOT NULL CHECK (scope IN ('global', 'office', 'user')),

  -- scope_id: office UUID (when scope=office) or user UUID (when scope=user), NULL for global
  scope_id     TEXT,

  -- Value: 'enabled' | 'disabled' | 'shadow'
  value        TEXT        NOT NULL CHECK (value IN ('enabled', 'disabled', 'shadow')),

  -- Who set this flag
  set_by       UUID        REFERENCES auth.users(id),
  set_by_role  TEXT,
  set_reason   TEXT        NOT NULL DEFAULT 'No reason provided',

  -- Thrashing protection tracking
  last_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_count_5min INTEGER NOT NULL DEFAULT 0,
  change_window_start TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique: one entry per (flag_name, scope, scope_id)
  CONSTRAINT feature_flags_unique UNIQUE (flag_name, scope, COALESCE(scope_id, ''))
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Service role: full access
CREATE POLICY "feature_flags_service_role_all"
  ON public.feature_flags FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Operators can read flags for their office or global
CREATE POLICY "feature_flags_operator_read"
  ON public.feature_flags FOR SELECT
  USING (
    scope = 'global'
    OR (
      scope = 'office' AND scope_id IN (
        SELECT office_id::TEXT FROM public.office_members
        WHERE user_id = auth.uid()
          AND role IN ('OWNER', 'ADMIN')
          AND is_active = true
      )
    )
    OR (scope = 'user' AND scope_id = auth.uid()::TEXT)
  );

-- Indexes for fast resolution
CREATE INDEX IF NOT EXISTS idx_feature_flags_lookup
  ON public.feature_flags(flag_name, scope, scope_id);

CREATE INDEX IF NOT EXISTS idx_feature_flags_global
  ON public.feature_flags(flag_name)
  WHERE scope = 'global';

-- ============================================================
-- 2. FEATURE FLAG AUDIT LOG — immutable write trail
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feature_flag_audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name    TEXT        NOT NULL,
  scope        TEXT        NOT NULL,
  scope_id     TEXT,
  old_value    TEXT,
  new_value    TEXT        NOT NULL,
  changed_by   UUID        REFERENCES auth.users(id),
  changed_by_role TEXT,
  change_reason TEXT,
  -- rejected: thrashing protection blocked this change
  was_rejected BOOLEAN     NOT NULL DEFAULT false,
  reject_reason TEXT,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flag_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flag_audit_service_role_all"
  ON public.feature_flag_audit_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "flag_audit_operator_read"
  ON public.feature_flag_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_flag_audit_flag_name
  ON public.feature_flag_audit_log(flag_name, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_flag_audit_rejected
  ON public.feature_flag_audit_log(was_rejected, changed_at DESC)
  WHERE was_rejected = true;

-- ============================================================
-- 3. CANONICAL FLAG NAMES — enforce valid flag set
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feature_flag_registry (
  flag_name       TEXT PRIMARY KEY,
  description     TEXT NOT NULL,
  domain          TEXT NOT NULL,  -- 'ai' | 'legal' | 'medical' | 'voice' | 'ocr' | 'operator' | 'shadow' | 'rollout'
  is_critical     BOOLEAN NOT NULL DEFAULT true,
  default_value   TEXT NOT NULL DEFAULT 'disabled',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flag_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flag_registry_service_role_all"
  ON public.feature_flag_registry FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "flag_registry_all_read"
  ON public.feature_flag_registry FOR SELECT
  USING (true);

-- Seed canonical flags
INSERT INTO public.feature_flag_registry (flag_name, description, domain, is_critical, default_value)
VALUES
  ('ai_generation',              'Enable/disable all AI generation globally',              'ai',       true,  'disabled'),
  ('legal_ai_generation',        'Enable/disable legal AI document generation',            'legal',    true,  'disabled'),
  ('medical_ai_generation',      'Enable/disable medical AI report generation',            'medical',  true,  'disabled'),
  ('medical_certification_flow', 'Enable/disable medical certification review workflow',   'medical',  true,  'disabled'),
  ('voice_critical_actions',     'Enable/disable voice-triggered destructive actions',     'voice',    true,  'disabled'),
  ('ocr_auto_suggest',           'Enable/disable OCR auto-suggest on intake forms',        'ocr',      false, 'disabled'),
  ('operator_destructive_actions','Enable/disable operator destructive actions (delete/purge)', 'operator', true, 'disabled'),
  ('shadow_mode_legal',          'Route legal AI generation to shadow log only',           'shadow',   false, 'disabled'),
  ('shadow_mode_medical',        'Route medical AI generation to shadow log only',         'shadow',   false, 'disabled'),
  ('rollout_pilot_office',       'Enable rollout for pilot office cohort',                 'rollout',  false, 'disabled'),
  ('rollout_phase_1',            'Activate rollout phase 1 (internal team)',               'rollout',  false, 'disabled'),
  ('rollout_phase_2',            'Activate rollout phase 2 (1-3 offices)',                 'rollout',  false, 'disabled'),
  ('rollout_phase_3',            'Activate rollout phase 3 (5-10 offices)',                'rollout',  false, 'disabled')
ON CONFLICT (flag_name) DO UPDATE
SET description   = EXCLUDED.description,
    domain        = EXCLUDED.domain,
    is_critical   = EXCLUDED.is_critical;

-- ============================================================
-- 4. check_feature_flag() — runtime resolution RPC
--
-- Resolution order: user → office → global
-- Kill-switch override: if associated kill-switch is active,
--   returns 'disabled' regardless of flag value.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_feature_flag(
  p_flag_name TEXT,
  p_office_id TEXT DEFAULT NULL,
  p_user_id   TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value TEXT;
  v_kill_switch_type TEXT;
BEGIN
  -- Validate flag exists in registry
  IF NOT EXISTS (SELECT 1 FROM public.feature_flag_registry WHERE flag_name = p_flag_name) THEN
    RAISE EXCEPTION 'UNKNOWN_FEATURE_FLAG: %. Register it in feature_flag_registry first.', p_flag_name;
  END IF;

  -- Kill-switch override: map flag → kill-switch type
  v_kill_switch_type := CASE p_flag_name
    WHEN 'ai_generation'              THEN 'ai_generation'
    WHEN 'legal_ai_generation'        THEN 'ai_generation'
    WHEN 'medical_ai_generation'      THEN 'ai_generation'
    WHEN 'voice_critical_actions'     THEN 'voice_actions'
    WHEN 'operator_destructive_actions' THEN 'operator_freeze'
    ELSE NULL
  END;

  -- If kill-switch is active, return 'disabled' immediately
  IF v_kill_switch_type IS NOT NULL THEN
    IF public.is_kill_switch_active(v_kill_switch_type, p_office_id) THEN
      RETURN 'disabled';
    END IF;
  END IF;

  -- Resolution order: user → office → global
  -- 1. User-scoped override
  IF p_user_id IS NOT NULL THEN
    SELECT value INTO v_value
    FROM public.feature_flags
    WHERE flag_name = p_flag_name
      AND scope     = 'user'
      AND scope_id  = p_user_id;

    IF FOUND THEN RETURN v_value; END IF;
  END IF;

  -- 2. Office-scoped override
  IF p_office_id IS NOT NULL THEN
    SELECT value INTO v_value
    FROM public.feature_flags
    WHERE flag_name = p_flag_name
      AND scope     = 'office'
      AND scope_id  = p_office_id;

    IF FOUND THEN RETURN v_value; END IF;
  END IF;

  -- 3. Global value
  SELECT value INTO v_value
  FROM public.feature_flags
  WHERE flag_name = p_flag_name
    AND scope     = 'global';

  IF FOUND THEN RETURN v_value; END IF;

  -- 4. Default from registry
  SELECT default_value INTO v_value
  FROM public.feature_flag_registry
  WHERE flag_name = p_flag_name;

  RETURN COALESCE(v_value, 'disabled');
END;
$$;

REVOKE ALL ON FUNCTION public.check_feature_flag(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_feature_flag(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_feature_flag(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 5. set_feature_flag() — audited write + thrashing protection
--
-- Thrashing protection rules:
--  - Cooldown of 60s between changes to same flag/scope
--  - OR max 3 changes per 5 minutes per flag/scope pair
-- All rejected changes are audited.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_feature_flag(
  p_flag_name TEXT,
  p_value     TEXT,
  p_scope     TEXT    DEFAULT 'global',
  p_scope_id  TEXT    DEFAULT NULL,
  p_reason    TEXT    DEFAULT 'No reason provided',
  p_role      TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid       UUID;
  v_existing         RECORD;
  v_old_value        TEXT;
  v_seconds_since    NUMERIC;
  v_changes_in_5min  INTEGER;
  v_window_start     TIMESTAMPTZ;
  v_new_count        INTEGER;
BEGIN
  v_caller_uid := auth.uid();

  -- Validate flag in registry
  IF NOT EXISTS (SELECT 1 FROM public.feature_flag_registry WHERE flag_name = p_flag_name) THEN
    RAISE EXCEPTION 'UNKNOWN_FEATURE_FLAG: %. Must be registered in feature_flag_registry.', p_flag_name;
  END IF;

  -- Validate value
  IF p_value NOT IN ('enabled', 'disabled', 'shadow') THEN
    RAISE EXCEPTION 'INVALID_FLAG_VALUE: %. Valid values: enabled, disabled, shadow', p_value;
  END IF;

  -- Validate scope
  IF p_scope NOT IN ('global', 'office', 'user') THEN
    RAISE EXCEPTION 'INVALID_SCOPE: %. Valid: global, office, user', p_scope;
  END IF;

  IF p_scope != 'global' AND p_scope_id IS NULL THEN
    RAISE EXCEPTION 'SCOPE_ID_REQUIRED for non-global scope';
  END IF;

  -- Fetch existing record for this flag/scope
  SELECT * INTO v_existing
  FROM public.feature_flags
  WHERE flag_name = p_flag_name
    AND scope     = p_scope
    AND COALESCE(scope_id, '') = COALESCE(p_scope_id, '')
  FOR UPDATE;

  IF FOUND THEN
    v_old_value := v_existing.value;

    -- Thrashing protection check 1: 60s cooldown
    v_seconds_since := EXTRACT(EPOCH FROM (now() - v_existing.last_changed_at));
    IF v_seconds_since < 60 THEN
      -- Log rejected change
      INSERT INTO public.feature_flag_audit_log (
        flag_name, scope, scope_id, old_value, new_value,
        changed_by, changed_by_role, change_reason, was_rejected, reject_reason
      ) VALUES (
        p_flag_name, p_scope, p_scope_id, v_old_value, p_value,
        v_caller_uid, p_role, p_reason, true,
        format('THRASHING_COOLDOWN: Last change was %s seconds ago. Minimum cooldown: 60s.', ROUND(v_seconds_since))
      );

      RETURN jsonb_build_object(
        'ok', false,
        'rejected', true,
        'reason', 'THRASHING_COOLDOWN',
        'seconds_since_last_change', ROUND(v_seconds_since),
        'retry_after_seconds', CEIL(60 - v_seconds_since)
      );
    END IF;

    -- Thrashing protection check 2: max 3 changes per 5-minute window
    IF v_existing.change_window_start >= now() - INTERVAL '5 minutes' THEN
      v_changes_in_5min := v_existing.change_count_5min;
      v_window_start    := v_existing.change_window_start;
    ELSE
      -- New window
      v_changes_in_5min := 0;
      v_window_start    := now();
    END IF;

    IF v_changes_in_5min >= 3 THEN
      INSERT INTO public.feature_flag_audit_log (
        flag_name, scope, scope_id, old_value, new_value,
        changed_by, changed_by_role, change_reason, was_rejected, reject_reason
      ) VALUES (
        p_flag_name, p_scope, p_scope_id, v_old_value, p_value,
        v_caller_uid, p_role, p_reason, true,
        format('THRASHING_MAX_CHANGES: %s changes in current 5-minute window. Max: 3.', v_changes_in_5min)
      );

      RETURN jsonb_build_object(
        'ok', false,
        'rejected', true,
        'reason', 'THRASHING_MAX_CHANGES',
        'changes_in_window', v_changes_in_5min,
        'window_resets_in_seconds', CEIL(EXTRACT(EPOCH FROM (v_window_start + INTERVAL '5 minutes' - now())))
      );
    END IF;

    v_new_count := v_changes_in_5min + 1;

    -- Update existing flag
    UPDATE public.feature_flags
    SET value                = p_value,
        set_by               = v_caller_uid,
        set_by_role          = p_role,
        set_reason           = p_reason,
        last_changed_at      = now(),
        change_count_5min    = v_new_count,
        change_window_start  = v_window_start,
        updated_at           = now()
    WHERE id = v_existing.id;
  ELSE
    v_old_value := NULL;
    v_new_count := 1;

    -- Insert new flag
    INSERT INTO public.feature_flags (
      flag_name, scope, scope_id, value,
      set_by, set_by_role, set_reason,
      last_changed_at, change_count_5min, change_window_start
    ) VALUES (
      p_flag_name, p_scope, p_scope_id, p_value,
      v_caller_uid, p_role, p_reason,
      now(), 1, now()
    );
  END IF;

  -- Audit successful change
  INSERT INTO public.feature_flag_audit_log (
    flag_name, scope, scope_id, old_value, new_value,
    changed_by, changed_by_role, change_reason, was_rejected
  ) VALUES (
    p_flag_name, p_scope, p_scope_id, v_old_value, p_value,
    v_caller_uid, p_role, p_reason, false
  );

  RETURN jsonb_build_object(
    'ok',        true,
    'flag_name', p_flag_name,
    'scope',     p_scope,
    'scope_id',  p_scope_id,
    'old_value', v_old_value,
    'new_value', p_value,
    'changes_in_window', v_new_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_feature_flag(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_feature_flag(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_feature_flag(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 6. get_flag_audit_trail() — operator-readable audit trail
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_flag_audit_trail(
  p_flag_name TEXT,
  p_limit     INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',            id,
        'flag_name',     flag_name,
        'scope',         scope,
        'scope_id',      scope_id,
        'old_value',     old_value,
        'new_value',     new_value,
        'changed_by',    changed_by,
        'changed_by_role', changed_by_role,
        'change_reason', change_reason,
        'was_rejected',  was_rejected,
        'reject_reason', reject_reason,
        'changed_at',    changed_at
      ) ORDER BY changed_at DESC
    )
    FROM (
      SELECT * FROM public.feature_flag_audit_log
      WHERE flag_name = p_flag_name
      ORDER BY changed_at DESC
      LIMIT p_limit
    ) sub
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_flag_audit_trail(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_flag_audit_trail(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_flag_audit_trail(TEXT, INTEGER) TO authenticated;

-- ============================================================
-- 7. list_feature_flags() — operator dashboard view
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_feature_flags(
  p_scope     TEXT DEFAULT NULL,
  p_flag_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'flag_name',    r.flag_name,
        'description',  r.description,
        'domain',       r.domain,
        'is_critical',  r.is_critical,
        'default_value', r.default_value,
        'current_value', COALESCE(
          -- global override
          (SELECT value FROM public.feature_flags f
           WHERE f.flag_name = r.flag_name AND f.scope = 'global'),
          r.default_value
        ),
        'kill_switch_override', (
          CASE r.flag_name
            WHEN 'ai_generation'          THEN public.is_kill_switch_active('ai_generation')
            WHEN 'legal_ai_generation'    THEN public.is_kill_switch_active('ai_generation')
            WHEN 'medical_ai_generation'  THEN public.is_kill_switch_active('ai_generation')
            WHEN 'voice_critical_actions' THEN public.is_kill_switch_active('voice_actions')
            WHEN 'operator_destructive_actions' THEN public.is_kill_switch_active('operator_freeze')
            ELSE false
          END
        ),
        'last_changed_at', (
          SELECT last_changed_at FROM public.feature_flags f
          WHERE f.flag_name = r.flag_name AND f.scope = 'global'
        )
      ) ORDER BY r.domain, r.flag_name
    )
    FROM public.feature_flag_registry r
    WHERE (p_flag_name IS NULL OR r.flag_name = p_flag_name)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_feature_flags(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_feature_flags(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_feature_flags(TEXT, TEXT) TO authenticated;

-- ============================================================
-- 8. SEED: Initialize all critical flags as 'disabled' globally
-- ============================================================
INSERT INTO public.feature_flags (flag_name, scope, scope_id, value, set_by_role, set_reason)
SELECT
  flag_name,
  'global',
  NULL,
  'disabled',
  'system',
  'Stage 14 initial seed — all flags start disabled'
FROM public.feature_flag_registry
ON CONFLICT (flag_name, scope, COALESCE(scope_id, '')) DO NOTHING;

COMMIT;
