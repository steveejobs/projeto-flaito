-- Migration: 20260414110000_stage9_p0_storage_rls.sql
-- Stage 9: P0 Security Hardening — Storage Isolation + Transitive RLS
-- Closes: F-005 (storage cross-tenant via weak path parsing)
-- Also hardens transitive RLS on all session-child tables (F-012 partial fix).

BEGIN;

-- ============================================================
-- 1. STORAGE BUCKET — Enforce Private
-- ============================================================
UPDATE storage.buckets
SET    public = false
WHERE  id IN ('session-recordings', 'medical-documents', 'legal-documents');

-- ============================================================
-- 2. DROP VULNERABLE STORAGE POLICY
--    The original policy returned office_id from ALL sessions,
--    not just the caller's offices. Any authenticated user could
--    read any recording bucket path.
-- ============================================================
DROP POLICY IF EXISTS "Sessions recording access" ON storage.objects;

-- ============================================================
-- 3. SECURE STORAGE POLICIES — session-recordings bucket
--    Validates BOTH: (a) path segment matches office_id,
--    (b) that office_id truly belongs to the caller.
-- ============================================================

-- SELECT (download)
CREATE POLICY "session_recordings_select_own_office"
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'session-recordings'
    AND (storage.foldername(name))[1] IN (
        SELECT om.office_id::text
        FROM   public.office_members om
        WHERE  om.user_id   = auth.uid()
          AND  om.is_active = true
    )
);

-- INSERT (upload)
CREATE POLICY "session_recordings_insert_own_office"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'session-recordings'
    AND (storage.foldername(name))[1] IN (
        SELECT om.office_id::text
        FROM   public.office_members om
        WHERE  om.user_id   = auth.uid()
          AND  om.is_active = true
    )
);

-- UPDATE (upsert, replace)
CREATE POLICY "session_recordings_update_own_office"
ON storage.objects
FOR UPDATE
USING (
    bucket_id = 'session-recordings'
    AND (storage.foldername(name))[1] IN (
        SELECT om.office_id::text
        FROM   public.office_members om
        WHERE  om.user_id   = auth.uid()
          AND  om.is_active = true
    )
)
WITH CHECK (
    bucket_id = 'session-recordings'
    AND (storage.foldername(name))[1] IN (
        SELECT om.office_id::text
        FROM   public.office_members om
        WHERE  om.user_id   = auth.uid()
          AND  om.is_active = true
    )
);

-- DELETE
CREATE POLICY "session_recordings_delete_own_office"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'session-recordings'
    AND (storage.foldername(name))[1] IN (
        SELECT om.office_id::text
        FROM   public.office_members om
        WHERE  om.user_id   = auth.uid()
          AND  om.is_active = true
    )
);

-- ============================================================
-- 4. REWRITE TRANSITIVE RLS POLICIES ON SESSION CHILD TABLES
--    Replace weak "session_id IN (SELECT id FROM sessions)"
--    with explicit JOIN through office_members. This closes the
--    implicit trust chain that could be bypassed in SECURITY
--    DEFINER contexts.
-- ============================================================

-- ---- 4.1 session_recording_chunks -------------------------
DROP POLICY IF EXISTS "Chunks isolation" ON public.session_recording_chunks;
CREATE POLICY "chunks_office_isolation"
ON public.session_recording_chunks
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM   public.sessions s
        JOIN   public.office_members om ON s.office_id = om.office_id
        WHERE  s.id          = session_recording_chunks.session_id
          AND  om.user_id    = auth.uid()
          AND  om.is_active  = true
    )
);

-- ---- 4.2 session_transcriptions ---------------------------
DROP POLICY IF EXISTS "Transcriptions isolation" ON public.session_transcriptions;
CREATE POLICY "transcriptions_office_isolation"
ON public.session_transcriptions
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM   public.sessions s
        JOIN   public.office_members om ON s.office_id = om.office_id
        WHERE  s.id          = session_transcriptions.session_id
          AND  om.user_id    = auth.uid()
          AND  om.is_active  = true
    )
);

-- ---- 4.3 session_speakers ---------------------------------
DROP POLICY IF EXISTS "Speakers isolation" ON public.session_speakers;
CREATE POLICY "speakers_office_isolation"
ON public.session_speakers
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM   public.sessions s
        JOIN   public.office_members om ON s.office_id = om.office_id
        WHERE  s.id          = session_speakers.session_id
          AND  om.user_id    = auth.uid()
          AND  om.is_active  = true
    )
);

-- ---- 4.4 session_segments ---------------------------------
DROP POLICY IF EXISTS "Segments isolation" ON public.session_segments;
CREATE POLICY "segments_office_isolation"
ON public.session_segments
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM   public.sessions s
        JOIN   public.office_members om ON s.office_id = om.office_id
        WHERE  s.id          = session_segments.session_id
          AND  om.user_id    = auth.uid()
          AND  om.is_active  = true
    )
);

-- ---- 4.5 session_context_sources --------------------------
DROP POLICY IF EXISTS "Context sources isolation" ON public.session_context_sources;
CREATE POLICY "context_sources_office_isolation"
ON public.session_context_sources
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM   public.sessions s
        JOIN   public.office_members om ON s.office_id = om.office_id
        WHERE  s.id          = session_context_sources.session_id
          AND  om.user_id    = auth.uid()
          AND  om.is_active  = true
    )
);

-- ---- 4.6 session_context_versions -------------------------
DROP POLICY IF EXISTS "Context versions isolation" ON public.session_context_versions;
CREATE POLICY "context_versions_office_isolation"
ON public.session_context_versions
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM   public.sessions s
        JOIN   public.office_members om ON s.office_id = om.office_id
        WHERE  s.id          = session_context_versions.session_id
          AND  om.user_id    = auth.uid()
          AND  om.is_active  = true
    )
);

-- ---- 4.7 legal_session_outputs ----------------------------
DROP POLICY IF EXISTS "Legal outputs isolation" ON public.legal_session_outputs;
CREATE POLICY "legal_outputs_office_isolation"
ON public.legal_session_outputs
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM   public.sessions s
        JOIN   public.office_members om ON s.office_id = om.office_id
        WHERE  s.id          = legal_session_outputs.session_id
          AND  om.user_id    = auth.uid()
          AND  om.is_active  = true
    )
);

-- ---- 4.8 medical_session_outputs --------------------------
DROP POLICY IF EXISTS "Medical outputs isolation" ON public.medical_session_outputs;
CREATE POLICY "medical_outputs_office_isolation"
ON public.medical_session_outputs
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM   public.sessions s
        JOIN   public.office_members om ON s.office_id = om.office_id
        WHERE  s.id          = medical_session_outputs.session_id
          AND  om.user_id    = auth.uid()
          AND  om.is_active  = true
    )
);

-- ---- 4.9 session_processing_snapshots ---------------------
DROP POLICY IF EXISTS "Snapshots isolation" ON public.session_processing_snapshots;
CREATE POLICY "snapshots_office_isolation"
ON public.session_processing_snapshots
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM   public.sessions s
        JOIN   public.office_members om ON s.office_id = om.office_id
        WHERE  s.id          = session_processing_snapshots.session_id
          AND  om.user_id    = auth.uid()
          AND  om.is_active  = true
    )
);

-- ============================================================
-- 5. SUPPORTING INDEXES for RLS performance
--    The EXISTS + JOIN pattern needs covering indexes to avoid
--    sequential scans on large tables.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sessions_office_id_id
    ON public.sessions (office_id, id);

CREATE INDEX IF NOT EXISTS idx_office_members_user_office_active
    ON public.office_members (user_id, office_id, is_active);

COMMIT;
