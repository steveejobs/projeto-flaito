-- ============================================================
-- Migration: Stage 15 — Wave 1: Incident Core
-- File: 20260421150000_stage15_incident_core.sql
-- ============================================================

BEGIN;

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE public.incident_severity AS ENUM ('SEV-1', 'SEV-2', 'SEV-3', 'SEV-4');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.incident_lifecycle AS ENUM ('open', 'investigating', 'mitigated', 'resolved', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. PRODUCTION INCIDENTS TABLE
CREATE TABLE IF NOT EXISTS public.production_incidents (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id       UUID        REFERENCES public.offices(id), -- NULL for global
    
    title           TEXT        NOT NULL,
    severity        public.incident_severity NOT NULL,
    status          public.incident_lifecycle NOT NULL DEFAULT 'open',
    
    -- Taxonomy for Clustering
    trigger_type    TEXT        NOT NULL, -- 'kill_switch', 'freeze', 'safe_mode', 'critical_alert', 'manual'
    subsystem       TEXT        NOT NULL, -- 'session_pipeline', 'ai_generation', 'billing', 'voice'
    error_signature TEXT,                 -- deterministic hash or simplified message
    
    -- Content (Sanitized - No PII)
    impact_summary  TEXT,
    mitigation_summary TEXT,
    
    -- Metadata
    source_metadata JSONB       NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.production_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_incidents"
  ON public.production_incidents FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "admins_view_incidents"
  ON public.production_incidents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND (office_id = production_incidents.office_id OR office_id IS NULL)
    )
  );

-- 3. DEDUPLICATION LOGIC & RPC
-- Logic: same (trigger_type, subsystem, office_id) within 15 minutes = dedupe.

CREATE OR REPLACE FUNCTION public.create_production_incident(
    p_title           TEXT,
    p_severity        public.incident_severity,
    p_trigger_type    TEXT,
    p_subsystem       TEXT,
    p_office_id       UUID    DEFAULT NULL,
    p_error_signature TEXT    DEFAULT NULL,
    p_metadata        JSONB   DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_id UUID;
    v_new_id      UUID;
BEGIN
    -- 1. Check for deduplication (15 minute window)
    SELECT id INTO v_existing_id
    FROM public.production_incidents
    WHERE trigger_type = p_trigger_type
      AND subsystem    = p_subsystem
      AND COALESCE(office_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_office_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status       != 'closed'
      AND created_at   >= now() - INTERVAL '15 minutes'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Link to metadata of existing incident instead of creating spam
        UPDATE public.production_incidents
        SET source_metadata = source_metadata || jsonb_build_array(p_metadata),
            updated_at      = now()
        WHERE id = v_existing_id;
        
        RETURN v_existing_id;
    END IF;

    -- 2. Create new incident
    INSERT INTO public.production_incidents (
        title, severity, trigger_type, subsystem, office_id, error_signature, source_metadata
    ) VALUES (
        p_title, p_severity, p_trigger_type, p_subsystem, p_office_id, p_error_signature, 
        jsonb_build_array(p_metadata)
    )
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

-- Grant access
REVOKE ALL ON FUNCTION public.create_production_incident FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_production_incident TO service_role;
GRANT EXECUTE ON FUNCTION public.create_production_incident TO authenticated;

-- 4. INTEGRATION HOOKS
-- Overriding Stage 14 functions to trigger incident creation

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
  v_new_incident_id UUID;
BEGIN
  v_caller := auth.uid();

  -- Auto-create production incident (SEV-3 for manual safe mode)
  v_new_incident_id := public.create_production_incident(
      format('Safe Mode Enabled (%s): %s', p_scope, p_reason),
      'SEV-3',
      'safe_mode',
      'system_ops',
      CASE WHEN p_scope = 'office' THEN p_scope_id::UUID ELSE NULL END,
      p_scope || '_safe_mode_activation',
      jsonb_build_object('scope', p_scope, 'reason', p_reason, 'manual_ref', p_incident_id)
  );

  INSERT INTO public.operator_safe_mode (
    scope, scope_id, is_active,
    activated_by, activated_at, activation_reason,
    incident_id, phase_id
  ) VALUES (
    p_scope, p_scope_id, true,
    v_caller, now(), p_reason,
    v_new_incident_id::TEXT, p_phase_id
  )
  ON CONFLICT (scope, COALESCE(scope_id, '')) DO UPDATE
  SET is_active         = true,
      activated_by      = v_caller,
      activated_at      = now(),
      activation_reason = p_reason,
      incident_id       = v_new_incident_id::TEXT,
      deactivated_by    = NULL,
      deactivated_at    = NULL,
      updated_at        = now()
  RETURNING id INTO v_id;

  INSERT INTO public.operator_safe_mode_log (
    scope, scope_id, attempted_action, action_context, outcome, attempted_by
  ) VALUES (
    p_scope, p_scope_id, 'ENABLE_SAFE_MODE',
    jsonb_build_object('reason', p_reason, 'incident_id', v_new_incident_id),
    'safe_mode_toggled', v_caller
  );

  PERFORM public.set_feature_flag(
    'operator_destructive_actions', 'disabled', p_scope, p_scope_id,
    format('Operator safe mode activated: %s', p_reason), 'system'
  );

  RETURN jsonb_build_object(
    'ok',           true,
    'safe_mode_id',  v_id,
    'incident_id',  v_new_incident_id,
    'scope',        p_scope,
    'activated_at', now()
  );
END;
$$;

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
  v_freeze_id      TEXT        := gen_random_uuid()::TEXT;
  v_new_incident_id UUID;
BEGIN
  -- 1. Auto-create SEV-1 Incident for Global Freeze
  v_new_incident_id := public.create_production_incident(
      format('Global Freeze: %s', p_reason),
      'SEV-1',
      'freeze',
      'global_platform',
      NULL,
      'global_freeze_activation',
      jsonb_build_object('reason', p_reason, 'freeze_id', v_freeze_id)
  );

  -- 2. Activate Kill Switches (Atomic Update)
  UPDATE public.system_kill_switches
  SET is_active = true,
      activated_by = v_caller,
      activated_at = now(),
      activation_reason = format('[GLOBAL_FREEZE %s] %s', v_freeze_id, p_reason),
      updated_at = now()
  WHERE switch_type IN ('worker_drain', 'ai_generation', 'voice_actions') AND scope = 'global';

  -- 3. Feature flag & Safe mode
  PERFORM public.set_feature_flag('operator_destructive_actions', 'disabled', 'global', NULL, format('[GLOBAL_FREEZE %s] %s', v_freeze_id, p_reason), 'system_freeze');
  PERFORM public.enable_operator_safe_mode(format('[GLOBAL_FREEZE %s] %s', v_freeze_id, p_reason), 'global', NULL, v_new_incident_id::TEXT, NULL);

  INSERT INTO public.session_audit_logs (
    session_id, office_id, action, resource_type, resource_id,
    performed_by, old_value, new_value, metadata
  ) VALUES (
    NULL, NULL, 'GLOBAL_FREEZE_EXECUTED', 'system', NULL,
    v_caller,
    jsonb_build_object('freeze_active', false),
    jsonb_build_object('freeze_active', true),
    jsonb_build_object('freeze_id', v_freeze_id, 'incident_id', v_new_incident_id)
  );

  RETURN jsonb_build_object(
    'ok',              true,
    'freeze_id',       v_freeze_id,
    'incident_id',     v_new_incident_id,
    'freeze_duration_ms', ROUND(EXTRACT(EPOCH FROM (now() - v_freeze_start)) * 1000)
  );
END;
$$;

COMMIT;


-- Grant access
REVOKE ALL ON FUNCTION public.create_production_incident FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_production_incident TO service_role;
GRANT EXECUTE ON FUNCTION public.create_production_incident TO authenticated;

COMMIT;
