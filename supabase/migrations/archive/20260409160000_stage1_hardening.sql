-- Migration: Stage 1 Production Blocker Hardening
-- Path: supabase/migrations/20260409160000_stage1_hardening.sql

-- 1. ENHANCE SESSIONS TABLE
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS total_chunks_expected INTEGER,
ADD COLUMN IF NOT EXISTS total_chunks_received INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS aggregate_session_hash TEXT,
ADD COLUMN IF NOT EXISTS processing_step TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS processing_lock_at TIMESTAMPTZ;

-- 2. ENFORCE CHUNK UNIQUENESS AND IDEMPOTENCY
-- We add a unique constraint to prevent duplicate chunk indices for the same session
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_session_chunk_index') THEN
        ALTER TABLE public.session_recording_chunks 
        ADD CONSTRAINT unique_session_chunk_index UNIQUE(session_id, chunk_index);
    END IF;
END $$;

-- 3. ENHANCE MEDICAL OUTPUTS TABLE
ALTER TABLE public.medical_session_outputs 
ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS content_hash TEXT,
ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT FALSE;

-- 4. SERVER-SIDE IMMUTABILITY TRIGGER
-- Prevents updates to finalized medical reports
CREATE OR REPLACE FUNCTION protect_finalized_medical_output()
RETURNS TRIGGER AS $$
BEGIN
    -- If the record is already finalized, reject all updates
    IF OLD.is_finalized = TRUE THEN
        RAISE EXCEPTION 'This medical output is finalized and cannot be modified.';
    END IF;

    -- If trying to set is_finalized to false after it was true (security guard)
    IF OLD.is_finalized = TRUE AND NEW.is_finalized = FALSE THEN
        RAISE EXCEPTION 'Cannot un-finalize a medical output.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_finalized_medical ON public.medical_session_outputs;
CREATE TRIGGER trg_protect_finalized_medical
BEFORE UPDATE ON public.medical_session_outputs
FOR EACH ROW EXECUTE FUNCTION protect_finalized_medical_output();

-- 5. RPC: INCREMENTO ATÔMICO DE CHUNKS
CREATE OR REPLACE FUNCTION public.increment_session_chunks(session_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.sessions
    SET total_chunks_received = total_chunks_received + 1
    WHERE id = session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. HELPER ACTION: ATOMIC LOCK ACQUISITION
-- Not a table, but a documentation of the pattern we will use in Supabase Functions via RPC or direct UPDATE
-- UPDATE sessions SET processing_lock_at = now(), processing_step = 'X' WHERE id = Y AND (processing_lock_at IS NULL OR processing_lock_at < now() - interval '5 minutes');
