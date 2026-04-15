-- =============================================================
-- Migration: Stage 10 — Trust Boundary Hardening
-- Path: supabase/migrations/20260410_stage10_trust_boundary.sql
--
-- Changes:
--   1. Enrich audit_logs with execution context fields
--   2. Enrich session_audit_logs with execution context fields
--   3. Create execution_context_log (major boundary entry events)
--   4. Create operator_action_log (immutable audit of admin actions)
--   5. Align transition_session_fsm with runtime signature
-- =============================================================

BEGIN;

-- =============================================================
-- 1. ENRICH audit_logs WITH TRUST CONTEXT
-- =============================================================

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS execution_context TEXT
    CHECK (execution_context IN ('user', 'worker', 'operator', 'system')),
  ADD COLUMN IF NOT EXISTS trigger_source TEXT,
  ADD COLUMN IF NOT EXISTS delegated_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.audit_logs.execution_context IS
  'Stage 10: Trust context under which this action was executed';
COMMENT ON COLUMN public.audit_logs.trigger_source IS
  'Stage 10: How this action was triggered (http_user, http_worker, cron, db_trigger, delegated_storage_write)';
COMMENT ON COLUMN public.audit_logs.delegated_by IS
  'Stage 10: If action was delegated, the originating actor';

-- =============================================================
-- 2. ENRICH session_audit_logs WITH TRUST CONTEXT
-- =============================================================

ALTER TABLE public.session_audit_logs
  ADD COLUMN IF NOT EXISTS execution_context TEXT
    CHECK (execution_context IN ('user', 'worker', 'operator', 'system')),
  ADD COLUMN IF NOT EXISTS trigger_source TEXT;

COMMENT ON COLUMN public.session_audit_logs.execution_context IS
  'Stage 10: Trust context under which this session action was executed';
COMMENT ON COLUMN public.session_audit_logs.trigger_source IS
  'Stage 10: How this session action was triggered';

-- =============================================================
-- 3. CREATE execution_context_log
--
-- Records major execution boundary entry points only.
-- NOT a per-function call log. Use for:
--   - User session context establishment
--   - Worker job pickup
--   - Operator action entry
--   - System reconciliation start
--   - Delegated storage write contracts
-- =============================================================

CREATE TABLE IF NOT EXISTS public.execution_context_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id          UUID        NOT NULL,
  execution_context TEXT        NOT NULL
    CHECK (execution_context IN ('user', 'worker', 'operator', 'system')),
  actor_id          TEXT,
  actor_role        TEXT,
  office_id         UUID,
  trigger_source    TEXT        NOT NULL,
  function_name     TEXT        NOT NULL,
  action            TEXT,
  delegated_by      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.execution_context_log ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert/read — never user RLS
CREATE POLICY "execution_context_log: service_role only"
  ON public.execution_context_log
  FOR ALL
  USING (false);  -- RLS blocks all; service_role bypasses RLS

CREATE INDEX IF NOT EXISTS idx_execution_context_log_trace_id
  ON public.execution_context_log(trace_id);
CREATE INDEX IF NOT EXISTS idx_execution_context_log_context
  ON public.execution_context_log(execution_context, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_context_log_actor
  ON public.execution_context_log(actor_id, created_at DESC);

COMMENT ON TABLE public.execution_context_log IS
  'Stage 10: Records major trust boundary entry points. Not a per-call telemetry table.';

-- =============================================================
-- 4. CREATE operator_action_log
--
-- Immutable audit trail for all operator/admin actions.
-- Every action by OWNER/ADMIN on privileged surfaces must be logged here.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.operator_action_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id           UUID        NOT NULL REFERENCES auth.users(id),
  operator_role         TEXT        NOT NULL,
  office_id             UUID,
  action_type           TEXT        NOT NULL,  -- retry_job, cancel_session, inspect_lineage, emergency_stop, requeue_session
  target_resource_type  TEXT,                  -- session, session_job, session_snapshot, etc.
  target_resource_id    TEXT,
  justification         TEXT,                  -- required for destructive actions
  idempotency_key       TEXT,                  -- prevents duplicate execution
  execution_result      TEXT        NOT NULL
    CHECK (execution_result IN ('success', 'rejected', 'error')),
  rejection_reason      TEXT,                  -- populated when FSM/gates block the action
  error_detail          TEXT,                  -- populated on unexpected errors
  trace_id              UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_action_log ENABLE ROW LEVEL SECURITY;

-- Operators can read their own actions; service_role reads all
CREATE POLICY "operator_action_log: operator read own"
  ON public.operator_action_log
  FOR SELECT
  USING (operator_id = auth.uid());

-- Only service_role can insert (prevents users from faking log entries)
CREATE POLICY "operator_action_log: no direct insert"
  ON public.operator_action_log
  FOR INSERT
  WITH CHECK (false);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_action_log_idempotency
  ON public.operator_action_log(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operator_action_log_operator
  ON public.operator_action_log(operator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operator_action_log_target
  ON public.operator_action_log(target_resource_type, target_resource_id);

COMMENT ON TABLE public.operator_action_log IS
  'Stage 10: Immutable audit trail for all operator/admin privileged actions.';

-- =============================================================
-- 5. ALIGN transition_session_fsm WITH RUNTIME SIGNATURE
--
-- Stage 2 migration deployed the function WITHOUT:
--   - p_caller_office_id (required for worker validation)
--   - p_execution_context (added in Stage 10)
--
-- The session-processor code has been calling p_caller_office_id
-- but it was silently ignored because the param name differed.
-- This migration fixes the authoritative DB function signature.
-- =============================================================

CREATE OR REPLACE FUNCTION public.transition_session_fsm(
  p_session_id       UUID,
  p_target_status    public.session_status,
  p_target_step      TEXT    DEFAULT NULL,
  p_reason           TEXT    DEFAULT NULL,
  p_metadata         JSONB   DEFAULT NULL,
  p_caller_office_id UUID    DEFAULT NULL,
  p_execution_context TEXT   DEFAULT 'system'
)
RETURNS void AS $$
DECLARE
  v_current_status  public.session_status;
  v_current_step    TEXT;
  v_lock_at         TIMESTAMPTZ;
  v_office_id       UUID;
  v_is_valid        BOOLEAN := FALSE;
  v_executor_id     UUID    := auth.uid();
BEGIN
  -- 1. Get current state with FOR UPDATE lock (prevents concurrent transitions)
  SELECT status, processing_step, processing_lock_at, office_id
  INTO   v_current_status, v_current_step, v_lock_at, v_office_id
  FROM   public.sessions
  WHERE  id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session % not found.', p_session_id;
  END IF;

  -- 2. Cross-tenant office validation (when caller_office_id is provided)
  --    Workers and operators must pass their office to prevent cross-tenant FSM abuse.
  IF p_caller_office_id IS NOT NULL AND v_office_id != p_caller_office_id THEN
    RAISE EXCEPTION 'CROSS_TENANT_FSM_VIOLATION: Caller office % does not match session office %',
      p_caller_office_id, v_office_id;
  END IF;

  -- 3. Concurrency lock (reject only if lock is active < 5 minutes for a different step)
  IF v_lock_at IS NOT NULL
     AND v_lock_at > now() - interval '5 minutes'
     AND (p_target_step IS NOT NULL AND p_target_step != v_current_step) THEN
    RAISE EXCEPTION 'CONCURRENCY_LOCK_ACTIVE: Session locked in step "%" since %',
      v_current_step, v_lock_at;
  END IF;

  -- 4. Idempotency: already in target state → no-op
  IF p_target_status = v_current_status
     AND (p_target_step IS NULL OR p_target_step = v_current_step) THEN
    RETURN;
  END IF;

  -- 5. FSM Transition Matrix (strict — no unplanned jumps)
  CASE v_current_status
    WHEN 'created' THEN
      IF p_target_status = 'recording' THEN v_is_valid := TRUE; END IF;
    WHEN 'recording' THEN
      IF p_target_status = 'uploading' THEN v_is_valid := TRUE; END IF;
    WHEN 'uploading' THEN
      IF p_target_status = 'ready_for_integrity_check' THEN v_is_valid := TRUE; END IF;
    WHEN 'ready_for_integrity_check' THEN
      IF p_target_status IN ('ready_for_transcription', 'processing') THEN v_is_valid := TRUE; END IF;
    WHEN 'ready_for_transcription' THEN
      IF p_target_status IN ('processing', 'transcribed') THEN v_is_valid := TRUE; END IF;
    WHEN 'processing' THEN
      IF p_target_status IN (
        'transcribed', 'analyzed', 'failed', 'outputs_generated',
        'snapshot_created', 'context_ready'
      ) THEN v_is_valid := TRUE; END IF;
    WHEN 'transcribed' THEN
      IF p_target_status = 'context_ready' THEN v_is_valid := TRUE; END IF;
    WHEN 'context_ready' THEN
      IF p_target_status IN ('snapshot_created', 'processing') THEN v_is_valid := TRUE; END IF;
    WHEN 'snapshot_created' THEN
      IF p_target_status IN ('analyzing', 'outputs_generated', 'processing') THEN v_is_valid := TRUE; END IF;
    WHEN 'analyzing' THEN
      IF p_target_status = 'outputs_generated' THEN v_is_valid := TRUE; END IF;
    WHEN 'outputs_generated' THEN
      IF p_target_status IN ('approved', 'archived', 'snapshot_created', 'processing') THEN v_is_valid := TRUE; END IF;
    WHEN 'approved' THEN
      IF p_target_status = 'archived' THEN v_is_valid := TRUE; END IF;
    ELSE NULL;
  END CASE;

  -- Global override: any state can transition to 'failed'
  IF p_target_status = 'failed' THEN v_is_valid := TRUE; END IF;

  -- Operator override: cancel → failed (only when execution_context = 'operator')
  IF p_execution_context = 'operator' AND p_target_status = 'failed' THEN
    v_is_valid := TRUE;
  END IF;

  IF NOT v_is_valid THEN
    RAISE EXCEPTION 'INVALID_FSM_TRANSITION: Cannot move from % to % (context: %)',
      v_current_status, p_target_status, p_execution_context;
  END IF;

  -- 6. Apply transition
  UPDATE public.sessions
  SET
    status             = p_target_status,
    processing_step    = COALESCE(p_target_step, processing_step),
    processing_lock_at = CASE WHEN p_target_step IS NULL THEN NULL ELSE now() END,
    updated_at         = now()
  WHERE id = p_session_id;

  -- 7. Audit log — enriched with execution context (Stage 10)
  INSERT INTO public.session_audit_logs (
    session_id, office_id, action, resource_type, resource_id,
    performed_by, old_value, new_value, metadata,
    execution_context, trigger_source
  ) VALUES (
    p_session_id,
    v_office_id,
    'STATUS_TRANSITION',
    'session',
    p_session_id,
    v_executor_id,
    jsonb_build_object('status', v_current_status, 'step', v_current_step),
    jsonb_build_object('status', p_target_status,  'step', p_target_step),
    jsonb_build_object(
      'transition_reason', p_reason,
      'meta',              p_metadata,
      'execution_context', p_execution_context,
      'caller_office_id',  p_caller_office_id
    ),
    p_execution_context,
    CASE
      WHEN p_execution_context = 'user'     THEN 'http_user'
      WHEN p_execution_context = 'worker'   THEN 'http_worker'
      WHEN p_execution_context = 'operator' THEN 'http_operator'
      ELSE 'db_trigger'
    END
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.transition_session_fsm IS
  'Stage 10: Aligned FSM with p_caller_office_id cross-tenant validation and p_execution_context audit enrichment';

-- =============================================================
-- 6. INDEX HYGIENE
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_execution_context
  ON public.audit_logs(execution_context, created_at DESC)
  WHERE execution_context IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_audit_logs_execution_context
  ON public.session_audit_logs(execution_context, created_at DESC)
  WHERE execution_context IS NOT NULL;

COMMIT;
