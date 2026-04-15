-- Migration: 20260414120000_stage9_p0_medical_invalidation.sql
-- Stage 9: P0 Security Hardening — Medical Certification Invalidation
-- Closes: F-003 ("Laudo Frankenstein" — certified outputs remain valid after snapshot change)
-- Strategy: When current_snapshot_id changes on a session, automatically
--           supersede all certified medical outputs for the old snapshot.
--           Also adds a backend gate that prevents certifying superseded outputs.

BEGIN;

-- ============================================================
-- 1. EXTEND medical_session_outputs WITH SUPERSEDE STATE
-- ============================================================
ALTER TABLE public.medical_session_outputs
    ADD COLUMN IF NOT EXISTS is_superseded     BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS superseded_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS superseded_reason TEXT;

-- Index: fast lookup of superseded outputs per session
CREATE INDEX IF NOT EXISTS idx_medical_outputs_superseded
    ON public.medical_session_outputs (session_id, is_superseded)
    WHERE is_superseded = true;

-- Index: fast lookup of certified outputs per snapshot
CREATE INDEX IF NOT EXISTS idx_medical_outputs_finalized_snapshot
    ON public.medical_session_outputs (session_id, snapshot_id, is_finalized)
    WHERE is_finalized = true;

-- ============================================================
-- 2. TRIGGER: Auto-Supersede Certifications on Snapshot Change
--    Fires AFTER UPDATE on sessions.current_snapshot_id.
--    Marks all finalized outputs for the previous snapshot as
--    superseded, and inserts an audit event for each one.
-- ============================================================

CREATE OR REPLACE FUNCTION public.tr_invalidate_certifications_on_new_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_superseded_row public.medical_session_outputs%ROWTYPE;
BEGIN
    -- Only fire when current_snapshot_id actually changes to a new, non-null value
    IF OLD.current_snapshot_id IS NOT DISTINCT FROM NEW.current_snapshot_id THEN
        RETURN NEW;
    END IF;
    IF NEW.current_snapshot_id IS NULL OR OLD.current_snapshot_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Supersede all certified outputs on the OLD snapshot
    FOR v_superseded_row IN
        UPDATE public.medical_session_outputs
        SET
            is_superseded     = true,
            superseded_at     = now(),
            superseded_reason = format(
                'AUTO_SUPERSEDED: New snapshot %s generated for session %s at %s. Previous snapshot: %s.',
                NEW.current_snapshot_id,
                NEW.id,
                now(),
                OLD.current_snapshot_id
            )
        WHERE  session_id   = NEW.id
          AND  snapshot_id  = OLD.current_snapshot_id
          AND  is_finalized = true
          AND  is_superseded = false
        RETURNING *
    LOOP
        -- Audit trail: one entry per superseded output
        INSERT INTO public.session_audit_logs (
            session_id,
            office_id,
            action,
            resource_type,
            resource_id,
            performed_by,
            old_value,
            new_value,
            metadata
        ) VALUES (
            NEW.id,
            NEW.office_id,
            'CERTIFICATION_SUPERSEDED',
            'medical_session_output',
            v_superseded_row.id,
            NULL, -- system action, no human performer
            jsonb_build_object(
                'snapshot_id',  OLD.current_snapshot_id,
                'certified_at', v_superseded_row.certified_at,
                'certified_by', v_superseded_row.certified_by
            ),
            jsonb_build_object(
                'new_snapshot_id',   NEW.current_snapshot_id,
                'superseded_at',     now()
            ),
            jsonb_build_object(
                'trigger', 'tr_invalidate_certifications_on_new_snapshot',
                'reason',  'Automatic invalidation: session snapshot advanced'
            )
        );
    END LOOP;

    RETURN NEW;
END;
$$;

-- Register the trigger on sessions
DROP TRIGGER IF EXISTS tr_invalidate_certif_on_snapshot ON public.sessions;
CREATE TRIGGER tr_invalidate_certif_on_snapshot
    AFTER UPDATE OF current_snapshot_id ON public.sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.tr_invalidate_certifications_on_new_snapshot();

-- ============================================================
-- 3. BACKEND CERTIFICATION GATE
--    Server-side RPC called inside certify_medical_output.
--    Raises an exception if the target output is superseded,
--    preventing any code path from certifying stale outputs.
-- ============================================================

CREATE OR REPLACE FUNCTION public.assert_medical_output_certifiable(p_output_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_output public.medical_session_outputs%ROWTYPE;
BEGIN
    SELECT * INTO v_output
    FROM   public.medical_session_outputs
    WHERE  id = p_output_id
    FOR SHARE; -- shared lock prevents concurrent supersede during check

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEDICAL_OUTPUT_NOT_FOUND: %', p_output_id;
    END IF;

    IF v_output.is_superseded = true THEN
        RAISE EXCEPTION
            'PROHIBITED_SUPERSEDED_CERTIFICATION: Output % was superseded at % — Reason: %',
            p_output_id,
            v_output.superseded_at,
            v_output.superseded_reason;
    END IF;

    IF v_output.is_finalized = true THEN
        RAISE EXCEPTION
            'PROHIBITED_DOUBLE_CERTIFICATION: Output % is already finalized.',
            p_output_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_medical_output_certifiable(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_medical_output_certifiable(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_medical_output_certifiable(UUID) TO service_role;

-- ============================================================
-- 4. BACKFILL: Mark currently stale certifications
--    Identify certified outputs whose session's current_snapshot_id
--    is DIFFERENT from their own snapshot_id. These are already
--    "Frankenstein" certified outputs that existed before this fix.
-- ============================================================

-- Run as a separate statement so the migration is idempotent
-- and will only supersede outputs that are genuinely stale.
UPDATE public.medical_session_outputs mso
SET
    is_superseded     = true,
    superseded_at     = now(),
    superseded_reason = format(
        'BACKFILL_STAGE9: Output certified on snapshot %s, but session current snapshot is now %s.',
        mso.snapshot_id,
        s.current_snapshot_id
    )
FROM public.sessions s
WHERE  s.id                    = mso.session_id
  AND  mso.is_finalized        = true
  AND  mso.is_superseded       = false
  AND  s.current_snapshot_id   IS NOT NULL
  AND  s.current_snapshot_id  != mso.snapshot_id;

COMMIT;
