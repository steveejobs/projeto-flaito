-- Migration: Stage 2 Session Intelligence Hardening (FINAL)
-- Path: supabase/migrations/20260409170000_stage2_hardening_fsm.sql

BEGIN;

-- 1. EXTEND ENUMS
ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'ready_for_integrity_check';
ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'ready_for_transcription';
ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'context_ready';
ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'snapshot_created';
ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'analyzing';
ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'outputs_generated';
ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'approved';

-- 2. UPDATE SESSIONS FOR CONCURRENCY AND HEAD TRACKING (Mandatory #3)
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS current_snapshot_id UUID,
ADD COLUMN IF NOT EXISTS processing_step TEXT,
ADD COLUMN IF NOT EXISTS processing_lock_at TIMESTAMPTZ;

-- 3. CREATE SNAPSHOT TABLE (WITH FULL LINEAGE - Mandatory #5)
CREATE TABLE IF NOT EXISTS public.session_processing_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    transcription_id UUID NOT NULL REFERENCES public.session_transcriptions(id),
    context_version INTEGER NOT NULL,
    context_hash TEXT NOT NULL, 
    snapshot_hash TEXT NOT NULL, -- Mandatory #4: sha256(canonical_json)
    ordered_sources_json JSONB NOT NULL, -- Included sources
    excluded_sources_json JSONB, -- Excluded sources + reason (Mandatory #5)
    prompt_metadata_json JSONB,
    model_metadata_json JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add constraint to sessions after table creation
ALTER TABLE public.sessions 
DROP CONSTRAINT IF EXISTS fk_current_snapshot,
ADD CONSTRAINT fk_current_snapshot 
FOREIGN KEY (current_snapshot_id) REFERENCES public.session_processing_snapshots(id) ON DELETE SET NULL;

-- 4. UPDATE OUTPUT TABLES WITH EXTENDED LINKAGE (Mandatory #6)
-- Legal Outputs
ALTER TABLE public.legal_session_outputs 
ADD COLUMN IF NOT EXISTS snapshot_id UUID REFERENCES public.session_processing_snapshots(id),
ADD COLUMN IF NOT EXISTS transcription_id UUID REFERENCES public.session_transcriptions(id),
ADD COLUMN IF NOT EXISTS context_version INTEGER,
ADD COLUMN IF NOT EXISTS context_hash TEXT,
ADD COLUMN IF NOT EXISTS output_hash TEXT, -- Mandatory #4
ADD COLUMN IF NOT EXISTS parent_output_id UUID REFERENCES public.legal_session_outputs(id), -- Mandatory #6
ADD COLUMN IF NOT EXISTS model_used TEXT,
ADD COLUMN IF NOT EXISTS generation_timestamp TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS reprocess_reason TEXT,
ADD COLUMN IF NOT EXISTS reprocessed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reprocessed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Medical Outputs
ALTER TABLE public.medical_session_outputs 
ADD COLUMN IF NOT EXISTS output_hash TEXT; 
ALTER TABLE public.medical_session_outputs 
ADD COLUMN IF NOT EXISTS snapshot_id UUID REFERENCES public.session_processing_snapshots(id),
ADD COLUMN IF NOT EXISTS transcription_id UUID REFERENCES public.session_transcriptions(id),
ADD COLUMN IF NOT EXISTS context_version INTEGER,
ADD COLUMN IF NOT EXISTS context_hash TEXT,
ADD COLUMN IF NOT EXISTS parent_output_id UUID REFERENCES public.medical_session_outputs(id),
ADD COLUMN IF NOT EXISTS model_used TEXT,
ADD COLUMN IF NOT EXISTS generation_timestamp TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS reprocess_reason TEXT,
ADD COLUMN IF NOT EXISTS reprocessed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reprocessed_at TIMESTAMPTZ;

-- 5. REFINED FSM TRANSITION FUNCTION (HARDENED CONCURRENCY - Mandatory #1)
CREATE OR REPLACE FUNCTION public.transition_session_fsm(
    p_session_id UUID,
    p_target_status public.session_status,
    p_target_step TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_performed_by UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_current_status public.session_status;
    v_current_step TEXT;
    v_lock_at TIMESTAMPTZ;
    v_office_id UUID;
    v_is_valid BOOLEAN := FALSE;
    v_executor_id UUID := COALESCE(p_performed_by, auth.uid());
BEGIN
    -- 1. Get current state with FOR UPDATE lock (row-level)
    SELECT status, processing_step, processing_lock_at, office_id 
    INTO v_current_status, v_current_step, v_lock_at, v_office_id
    FROM public.sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session % not found.', p_session_id;
    END IF;

    -- 2. MANDATORY LOCK RULE (#1): Reject only if lock is active < 5 minutes
    -- Permite transições se o lock expirou ou se é o mesmo passo (idempotência)
    IF v_lock_at IS NOT NULL 
       AND v_lock_at > now() - interval '5 minutes' 
       AND (p_target_step IS NOT NULL AND p_target_step != v_current_step) THEN
        RAISE EXCEPTION 'CONCURRENCY_LOCK_ACTIVE: Session locked in step "%" since %', v_current_step, v_lock_at;
    END IF;

    -- 3. Idempotência: Se já está no estado alvo, ignora
    IF p_target_status = v_current_status AND (p_target_step IS NULL OR p_target_step = v_current_step) THEN
        RETURN;
    END IF;

    -- 4. FSM Matrix (Strict Transitions)
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
            IF p_target_status IN ('transcribed', 'analyzed', 'failed', 'outputs_generated', 'snapshot_created', 'context_ready') THEN v_is_valid := TRUE; END IF;
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
        ELSE
            NULL;
    END CASE;

    -- Global Overrides
    IF p_target_status = 'failed' THEN v_is_valid := TRUE; END IF;

    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'INVALID_FSM_TRANSITION: Cannot move from % to %', v_current_status, p_target_status;
    END IF;

    -- 5. Apply transition
    UPDATE public.sessions
    SET 
        status = p_target_status,
        processing_step = COALESCE(p_target_step, processing_step),
        processing_lock_at = CASE WHEN p_target_step IS NULL THEN NULL ELSE now() END,
        updated_at = now()
    WHERE id = p_session_id;

    -- 6. AUDIT LOG (Mandatory #1: transition_reason + performed_by)
    INSERT INTO public.session_audit_logs (
        session_id, office_id, action, resource_type, resource_id, performed_by, old_value, new_value, metadata
    ) VALUES (
        p_session_id, v_office_id, 'STATUS_TRANSITION', 'session', p_session_id, v_executor_id,
        jsonb_build_object('status', v_current_status, 'step', v_current_step),
        jsonb_build_object('status', p_target_status, 'step', p_target_step),
        jsonb_build_object('transition_reason', p_reason, 'meta', p_metadata)
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS
ALTER TABLE public.session_processing_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Snapshots isolation" ON public.session_processing_snapshots 
    FOR ALL USING (session_id IN (SELECT id FROM public.sessions));

-- 7. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_snapshots_session_id ON public.session_processing_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_hash ON public.session_processing_snapshots(snapshot_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_current_snapshot ON public.sessions(current_snapshot_id);

COMMIT;
