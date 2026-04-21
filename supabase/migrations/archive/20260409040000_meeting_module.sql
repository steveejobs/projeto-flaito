-- Migration: Reunião Jurídica Inteligente (Missão Crítica)
-- Path: supabase/migrations/20260409040000_meeting_module.sql

-- 1. ENUMS e Tipos
DO $$ BEGIN
    CREATE TYPE meeting_status AS ENUM (
        'created', 'recording', 'uploading', 'processing', 'transcribed', 
        'analyzed', 'archived', 'interrupted', 'failed'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE transcription_version_type AS ENUM (
        'raw_stt', 'diarized', 'speaker_mapped', 'corrected'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE chunk_upload_status AS ENUM (
        'pending', 'uploaded', 'failed'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabela: meetings
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    status meeting_status NOT NULL DEFAULT 'created',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    final_audio_path TEXT,
    final_audio_hash TEXT,
    audio_hash_aggregate TEXT,
    processing_error TEXT,
    linked_later BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela: meeting_recording_chunks
CREATE TABLE IF NOT EXISTS public.meeting_recording_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    duration NUMERIC,
    size_bytes BIGINT,
    checksum TEXT,
    upload_status chunk_upload_status NOT NULL DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    confirmed_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela: meeting_transcriptions
CREATE TABLE IF NOT EXISTS public.meeting_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_type transcription_version_type NOT NULL,
    raw_text TEXT,
    structured_json JSONB,
    confidence_score NUMERIC,
    language TEXT,
    provider TEXT,
    provider_job_id TEXT,
    source_transcription_id UUID REFERENCES public.meeting_transcriptions(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela: meeting_speakers
CREATE TABLE IF NOT EXISTS public.meeting_speakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    speaker_label TEXT NOT NULL, -- ex: "Speaker 0"
    mapped_name TEXT,
    role TEXT,
    mapped_by UUID REFERENCES auth.users(id),
    mapped_at TIMESTAMPTZ,
    voice_profile_id TEXT,
    confidence_override_reason TEXT,
    UNIQUE(meeting_id, speaker_label)
);

-- 6. Tabela: meeting_segments
CREATE TABLE IF NOT EXISTS public.meeting_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    transcription_id UUID NOT NULL REFERENCES public.meeting_transcriptions(id) ON DELETE CASCADE,
    speaker_label TEXT,
    speaker_id UUID REFERENCES public.meeting_speakers(id),
    resolved_speaker_name TEXT,
    text TEXT,
    start_time NUMERIC NOT NULL,
    end_time NUMERIC NOT NULL,
    confidence NUMERIC
);

-- 7. Tabela: meeting_analysis
CREATE TABLE IF NOT EXISTS public.meeting_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    transcription_id UUID NOT NULL REFERENCES public.meeting_transcriptions(id) ON DELETE CASCADE,
    analysis_version INTEGER NOT NULL DEFAULT 1,
    model_used TEXT,
    summary TEXT,
    facts TEXT,
    risks TEXT,
    tasks TEXT,
    commitments TEXT,
    citations_json JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Tabela: meeting_audit_logs
CREATE TABLE IF NOT EXISTS public.meeting_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. RLS (Row Level Security)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_recording_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas baseadas em office_id
CREATE POLICY "Meetings isolation" ON public.meetings 
    FOR ALL USING (office_id IN (SELECT auth_utils.get_user_offices()));

CREATE POLICY "Chunks isolation" ON public.meeting_recording_chunks 
    FOR ALL USING (meeting_id IN (SELECT id FROM public.meetings));

CREATE POLICY "Transcriptions isolation" ON public.meeting_transcriptions 
    FOR ALL USING (meeting_id IN (SELECT id FROM public.meetings));

CREATE POLICY "Speakers isolation" ON public.meeting_speakers 
    FOR ALL USING (meeting_id IN (SELECT id FROM public.meetings));

CREATE POLICY "Segments isolation" ON public.meeting_segments 
    FOR ALL USING (meeting_id IN (SELECT id FROM public.meetings));

CREATE POLICY "Analysis isolation" ON public.meeting_analysis 
    FOR ALL USING (meeting_id IN (SELECT id FROM public.meetings));

CREATE POLICY "Audit isolation" ON public.meeting_audit_logs 
    FOR ALL USING (office_id IN (SELECT auth_utils.get_user_offices()));

-- 10. Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'meeting-recordings', 
    'meeting-recordings', 
    false, 
    524288000, -- 500MB por arquivo (ajustável)
    '{"audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/x-m4a"}'
)
ON CONFLICT (id) DO NOTHING;

-- Policies para o Bucket
-- Nota: Supabase storage policies usam storage.objects
CREATE POLICY "Meetings recording access" ON storage.objects
    FOR ALL USING (
        bucket_id = 'meeting-recordings' 
        AND (storage.foldername(name))[1] IN (
            SELECT office_id::text FROM public.meetings
        )
    );

-- 11. Índices para performance
CREATE INDEX IF NOT EXISTS idx_meetings_office_id ON public.meetings(office_id);
CREATE INDEX IF NOT EXISTS idx_meeting_chunks_meeting_id ON public.meeting_recording_chunks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_meeting_id ON public.meeting_transcriptions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_segments_transcription_id ON public.meeting_segments(transcription_id);
