-- Migration: 20260414100000_stage9_p0_security_fsm.sql
-- Stage 9: P0 Security Hardening — FSM Ownership Enforcement
-- Closes: F-001 (cross-tenant mutation via transition_session_fsm)
-- Strategy: Validate auth.uid() presence for user flows; require explicit
--           p_caller_office_id for worker flows (service_role). Never trust
--           the caller without checking session ownership.

BEGIN;

-- ============================================================
-- 1. HARDEN transition_session_fsm
--    Add p_caller_office_id parameter and enforce ownership
--    before any state mutation occurs.
-- ============================================================

CREATE OR REPLACE FUNCTION public.transition_session_fsm(
    p_session_id      UUID,
    p_target_status   public.session_status,
    p_target_step     TEXT          DEFAULT NULL,
    p_reason          TEXT          DEFAULT NULL,
    p_performed_by    UUID          DEFAULT NULL,
    p_metadata        JSONB         DEFAULT NULL,
    p_caller_office_id UUID         DEFAULT NULL   -- NEW: required for worker calls
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_status   public.session_status;
    v_current_step     TEXT;
    v_lock_at          TIMESTAMPTZ;
    v_office_id        UUID;
    v_is_valid         BOOLEAN := FALSE;
    v_executor_id      UUID;
    v_caller_uid       UUID;
BEGIN
    -- --------------------------------------------------------
    -- 0. RESOLVE CALLER IDENTITY
    --    auth.uid() returns NULL when called from service_role
    --    context (workers). This is intentional — workers must
    --    use p_caller_office_id for validation instead.
    -- --------------------------------------------------------
    v_caller_uid  := auth.uid();
    v_executor_id := COALESCE(p_performed_by, v_caller_uid);

    -- --------------------------------------------------------
    -- 1. OWNERSHIP GATE — User Flow
    --    When auth.uid() is present, the caller is an authenticated
    --    user. Validate they belong to the session's office.
    --    Fail immediately if they do not own the session.
    -- --------------------------------------------------------
    IF v_caller_uid IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM   public.sessions s
            JOIN   public.office_members om ON s.office_id = om.office_id
            WHERE  s.id          = p_session_id
              AND  om.user_id    = v_caller_uid
              AND  om.is_active  = true
        ) THEN
            RAISE EXCEPTION 'ACCESS_DENIED: Session % does not belong to caller office (uid=%)',
                p_session_id, v_caller_uid;
        END IF;
    END IF;

    -- --------------------------------------------------------
    -- 2. OWNERSHIP GATE — Worker Flow (service_role)
    --    When no auth.uid() is present, the caller is a worker.
    --    Workers MUST supply p_caller_office_id.  Validate that
    --    the session truly belongs to that office before proceeding.
    -- --------------------------------------------------------
    IF v_caller_uid IS NULL THEN
        IF p_caller_office_id IS NULL THEN
            RAISE EXCEPTION 'WORKER_SECURITY_ERROR: p_caller_office_id is required for service_role calls on session %',
                p_session_id;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM   public.sessions
            WHERE  id        = p_session_id
              AND  office_id = p_caller_office_id
        ) THEN
            RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Session % does not belong to office % (worker)',
                p_session_id, p_caller_office_id;
        END IF;
    END IF;

    -- --------------------------------------------------------
    -- 3. FETCH CURRENT STATE WITH ROW LOCK
    --    Only reached after ownership is confirmed above.
    -- --------------------------------------------------------
    SELECT status, processing_step, processing_lock_at, office_id
    INTO   v_current_status, v_current_step, v_lock_at, v_office_id
    FROM   public.sessions
    WHERE  id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SESSION_NOT_FOUND: %', p_session_id;
    END IF;

    -- --------------------------------------------------------
    -- 4. CONCURRENCY LOCK CHECK
    -- --------------------------------------------------------
    IF v_lock_at IS NOT NULL
       AND v_lock_at > now() - interval '5 minutes'
       AND (p_target_step IS NOT NULL AND p_target_step != v_current_step)
    THEN
        RAISE EXCEPTION 'CONCURRENCY_LOCK_ACTIVE: Session locked in step "%" since %',
            v_current_step, v_lock_at;
    END IF;

    -- --------------------------------------------------------
    -- 5. IDEMPOTENCY: already in target state → silent success
    -- --------------------------------------------------------
    IF p_target_status = v_current_status
       AND (p_target_step IS NULL OR p_target_step = v_current_step)
    THEN
        RETURN;
    END IF;

    -- --------------------------------------------------------
    -- 6. FSM TRANSITION MATRIX (unchanged from Stage 2)
    -- --------------------------------------------------------
    CASE v_current_status
        WHEN 'created'                  THEN IF p_target_status = 'recording'             THEN v_is_valid := TRUE; END IF;
        WHEN 'recording'                THEN IF p_target_status = 'uploading'              THEN v_is_valid := TRUE; END IF;
        WHEN 'uploading'                THEN IF p_target_status = 'ready_for_integrity_check' THEN v_is_valid := TRUE; END IF;
        WHEN 'ready_for_integrity_check' THEN IF p_target_status IN ('ready_for_transcription','processing') THEN v_is_valid := TRUE; END IF;
        WHEN 'ready_for_transcription'  THEN IF p_target_status IN ('processing','transcribed')              THEN v_is_valid := TRUE; END IF;
        WHEN 'processing'               THEN IF p_target_status IN ('transcribed','analyzed','failed','outputs_generated','snapshot_created','context_ready') THEN v_is_valid := TRUE; END IF;
        WHEN 'transcribed'              THEN IF p_target_status = 'context_ready'          THEN v_is_valid := TRUE; END IF;
        WHEN 'context_ready'            THEN IF p_target_status IN ('snapshot_created','processing') THEN v_is_valid := TRUE; END IF;
        WHEN 'snapshot_created'         THEN IF p_target_status IN ('analyzing','outputs_generated','processing') THEN v_is_valid := TRUE; END IF;
        WHEN 'analyzing'                THEN IF p_target_status = 'outputs_generated'      THEN v_is_valid := TRUE; END IF;
        WHEN 'outputs_generated'        THEN IF p_target_status IN ('approved','archived','snapshot_created','processing') THEN v_is_valid := TRUE; END IF;
        WHEN 'approved'                 THEN IF p_target_status = 'archived'               THEN v_is_valid := TRUE; END IF;
        ELSE NULL;
    END CASE;

    -- Global override: any state may transition to 'failed'
    IF p_target_status = 'failed' THEN v_is_valid := TRUE; END IF;

    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'INVALID_FSM_TRANSITION: Cannot move session % from % to %',
            p_session_id, v_current_status, p_target_status;
    END IF;

    -- --------------------------------------------------------
    -- 7. APPLY TRANSITION
    -- --------------------------------------------------------
    UPDATE public.sessions
    SET
        status             = p_target_status,
        processing_step    = COALESCE(p_target_step, processing_step),
        processing_lock_at = CASE WHEN p_target_step IS NULL THEN NULL ELSE now() END,
        updated_at         = now()
    WHERE id = p_session_id;

    -- --------------------------------------------------------
    -- 8. MANDATORY AUDIT LOG
    -- --------------------------------------------------------
    INSERT INTO public.session_audit_logs (
        session_id, office_id, action, resource_type, resource_id,
        performed_by, old_value, new_value, metadata
    ) VALUES (
        p_session_id, v_office_id,
        'STATUS_TRANSITION', 'session', p_session_id,
        v_executor_id,
        jsonb_build_object('status', v_current_status, 'step', v_current_step),
        jsonb_build_object('status', p_target_status,  'step', p_target_step),
        jsonb_build_object(
            'transition_reason',   p_reason,
            'caller_office_id',    p_caller_office_id,
            'worker_call',         (v_caller_uid IS NULL),
            'meta',                p_metadata
        )
    );

END;
$$;

-- Revoke broad access: only authenticated users and service_role may call this
REVOKE ALL ON FUNCTION public.transition_session_fsm(UUID, public.session_status, TEXT, TEXT, UUID, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_session_fsm(UUID, public.session_status, TEXT, TEXT, UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_session_fsm(UUID, public.session_status, TEXT, TEXT, UUID, JSONB, UUID) TO service_role;

COMMIT;
