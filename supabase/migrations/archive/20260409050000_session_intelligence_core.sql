-- Migration: Session Intelligence Core
-- Path: supabase/migrations/20260409050000_session_intelligence_core.sql

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE session_type AS ENUM ('legal_meeting', 'medical_consultation', 'generic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE session_status AS ENUM (
        'created', 'recording', 'uploading', 'processing', 'transcribed', 
        'analyzed', 'archived', 'interrupted', 'failed'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabela Core: sessions
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    session_type session_type NOT NULL DEFAULT 'generic',
    title TEXT NOT NULL,
    linked_entity_type TEXT, -- 'client', 'case', 'process', 'paciente', 'consulta'
    linked_entity_id UUID,
    linked_later BOOLEAN DEFAULT FALSE,
    confidentiality_level TEXT DEFAULT 'normal',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    status session_status NOT NULL DEFAULT 'created',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    final_audio_path TEXT,
    final_audio_hash TEXT,
    processing_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela: session_recording_chunks
CREATE TABLE IF NOT EXISTS public.session_recording_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    duration NUMERIC,
    size_bytes BIGINT,
    checksum_sha256 TEXT,
    upload_status TEXT DEFAULT 'pending', -- pending, uploaded, failed
    retry_count INTEGER DEFAULT 0,
    confirmed_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela: session_transcriptions
CREATE TABLE IF NOT EXISTS public.session_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_type TEXT NOT NULL, -- raw_stt, diarized, speaker_mapped, corrected
    raw_text TEXT,
    structured_json JSONB,
    confidence_score NUMERIC,
    language TEXT,
    provider TEXT,
    provider_job_id TEXT,
    source_transcription_id UUID REFERENCES public.session_transcriptions(id),
    is_locked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela: session_speakers
CREATE TABLE IF NOT EXISTS public.session_speakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    speaker_label TEXT NOT NULL,
    mapped_name TEXT,
    role TEXT,
    mapped_by UUID REFERENCES auth.users(id),
    mapped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(session_id, speaker_label)
);

-- 6. Tabela: session_segments
CREATE TABLE IF NOT EXISTS public.session_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    transcription_id UUID NOT NULL REFERENCES public.session_transcriptions(id) ON DELETE CASCADE,
    speaker_label TEXT,
    speaker_id UUID REFERENCES public.session_speakers(id),
    resolved_speaker_name TEXT,
    text TEXT,
    start_time NUMERIC NOT NULL,
    end_time NUMERIC NOT NULL,
    confidence NUMERIC
);

-- 11. MIGRACÃO DE DADOS (Meetings -> Sessions)
DO $$ 
BEGIN
    -- Se a tabela meetings existir, migra
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meetings') THEN
        
        -- Migrar Meetings
        INSERT INTO public.sessions (
            id, office_id, session_type, title, linked_entity_type, linked_entity_id, 
            created_by, status, started_at, ended_at, duration_seconds, 
            final_audio_path, final_audio_hash, processing_error, linked_later, created_at
        )
        SELECT 
            id, office_id, 'legal_meeting'::session_type, title, 
            CASE 
                WHEN process_id IS NOT NULL THEN 'process'
                WHEN case_id IS NOT NULL THEN 'case'
                WHEN client_id IS NOT NULL THEN 'client'
                ELSE NULL
            END,
            COALESCE(process_id, case_id, client_id),
            created_by, status::text::session_status, started_at, ended_at, duration_seconds, 
            final_audio_path, final_audio_hash, processing_error, linked_later, created_at
        FROM public.meetings
        ON CONFLICT (id) DO NOTHING;

        -- Migrar Chunks
        INSERT INTO public.session_recording_chunks (
            id, session_id, chunk_index, storage_path, duration, size_bytes, 
            checksum_sha256, upload_status, retry_count, confirmed_at, uploaded_at
        )
        SELECT 
            id, meeting_id, chunk_index, storage_path, duration, size_bytes, 
            checksum, upload_status::text, retry_count, confirmed_at, uploaded_at
        FROM public.meeting_recording_chunks
        ON CONFLICT (id) DO NOTHING;

        -- Migrar Transcriptions
        INSERT INTO public.session_transcriptions (
            id, session_id, version_number, version_type, raw_text, structured_json, 
            confidence_score, language, provider, provider_job_id, source_transcription_id, created_at
        )
        SELECT 
            id, meeting_id, version_number, version_type::text, raw_text, structured_json, 
            confidence_score, language, provider, provider_job_id, source_transcription_id, created_at
        FROM public.meeting_transcriptions
        ON CONFLICT (id) DO NOTHING;

        -- Migrar Speakers
        INSERT INTO public.session_speakers (
            id, session_id, speaker_label, mapped_name, role, mapped_by, mapped_at, created_at
        )
        SELECT 
            id, meeting_id, speaker_label, mapped_name, role, mapped_by, mapped_at, created_at
        FROM public.meeting_speakers
        ON CONFLICT (id) DO NOTHING;

        -- Migrar Segments
        INSERT INTO public.session_segments (
            id, session_id, transcription_id, speaker_label, speaker_id, 
            resolved_speaker_name, text, start_time, end_time, confidence
        )
        SELECT 
            id, meeting_id, transcription_id, speaker_label, speaker_id, 
            resolved_speaker_name, text, start_time, end_time, confidence
        FROM public.meeting_segments
        ON CONFLICT (id) DO NOTHING;

    END IF;
END $$;

-- 12. VIEW DE COMPATIBILIDADE
CREATE OR REPLACE VIEW public.vw_meetings AS
SELECT 
    id, office_id, title, status::text as status, started_at, ended_at, 
    duration_seconds, final_audio_path, final_audio_hash, processing_error, 
    linked_later, created_at
FROM public.sessions
WHERE session_type = 'legal_meeting';

-- 13. RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_recording_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sessions isolation" ON public.sessions 
    FOR ALL USING (office_id IN (SELECT auth_utils.get_user_offices()));

CREATE POLICY "Chunks isolation" ON public.session_recording_chunks 
    FOR ALL USING (session_id IN (SELECT id FROM public.sessions));

CREATE POLICY "Transcriptions isolation" ON public.session_transcriptions 
    FOR ALL USING (session_id IN (SELECT id FROM public.sessions));

CREATE POLICY "Speakers isolation" ON public.session_speakers 
    FOR ALL USING (session_id IN (SELECT id FROM public.sessions));

CREATE POLICY "Segments isolation" ON public.session_segments 
    FOR ALL USING (session_id IN (SELECT id FROM public.sessions));

-- 14. BUCKET STORAGE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'session-recordings', 
    'session-recordings', 
    false, 
    524288000, 
    '{"audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/x-m4a"}'
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Sessions recording access" ON storage.objects
    FOR ALL USING (
        bucket_id = 'session-recordings' 
        AND (storage.foldername(name))[1] IN (
            SELECT office_id::text FROM public.sessions
        )
    );
