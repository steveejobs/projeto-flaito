-- Migration: Session Intelligence Governance & Outputs
-- Path: supabase/migrations/20260409051000_session_context_and_outputs.sql

-- 1. ENUMS Adicionais
DO $$ BEGIN
    CREATE TYPE context_source_type AS ENUM (
        'audio', 'legal_document', 'medical_record', 'exam', 'image', 'prior_note'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE medical_output_status AS ENUM (
        'ai_draft', 'pending_medical_review', 'approved_signed', 
        'approved_with_edits', 'rejected'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabela: session_context_sources
CREATE TABLE IF NOT EXISTS public.session_context_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    context_version INTEGER NOT NULL DEFAULT 1,
    source_type context_source_type NOT NULL,
    source_id UUID, -- Referência dinâmica (legal_document_id, query_result_id, etc)
    source_hash TEXT,
    relevance_score NUMERIC,
    content_snapshot TEXT, -- Trecho do conteúdo usado
    included_by UUID REFERENCES auth.users(id),
    included_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela: session_context_versions
CREATE TABLE IF NOT EXISTS public.session_context_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    context_snapshot JSONB NOT NULL, -- O "Prompt Final" ou Objeto de Contexto consolidado
    context_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(session_id, version_number)
);

-- 4. Tabela: legal_session_outputs (Domínio Jurídico)
CREATE TABLE IF NOT EXISTS public.legal_session_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    transcription_id UUID REFERENCES public.session_transcriptions(id),
    context_version_id UUID REFERENCES public.session_context_versions(id),
    dossier_snapshot JSONB,
    summary TEXT,
    oral_claims_json JSONB,
    document_supported_facts_json JSONB,
    evidence_gaps_json JSONB,
    contradictions_json JSONB,
    draft_document TEXT, -- A minuta da petição/peça
    document_type TEXT, -- Tipo da peça sugerida
    citations_json JSONB, -- [ {text, source_type, speaker, document_id...} ]
    model_used TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela: medical_session_outputs (Domínio Médico)
CREATE TABLE IF NOT EXISTS public.medical_session_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    transcription_id UUID REFERENCES public.session_transcriptions(id),
    context_version_id UUID REFERENCES public.session_context_versions(id),
    clinical_snapshot JSONB,
    structured_summary TEXT,
    clinical_findings_json JSONB,
    pre_report_draft TEXT,
    pre_laud_draft TEXT,
    pre_diagnosis TEXT,
    missing_data_json JSONB,
    model_used TEXT,
    status medical_output_status NOT NULL DEFAULT 'ai_draft',
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Tabela: session_audit_logs (Imutável)
CREATE TABLE IF NOT EXISTS public.session_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- CREATE, UPLOAD_CHUNK, TRANSCRIBE, MAP_SPEAKER, ANALYZE, APPROVE_MEDICAL
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. RLS
ALTER TABLE public.session_context_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_context_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_session_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_session_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Context sources isolation" ON public.session_context_sources 
    FOR ALL USING (session_id IN (SELECT id FROM public.sessions));

CREATE POLICY "Context versions isolation" ON public.session_context_versions 
    FOR ALL USING (session_id IN (SELECT id FROM public.sessions));

CREATE POLICY "Legal outputs isolation" ON public.legal_session_outputs 
    FOR ALL USING (session_id IN (SELECT id FROM public.sessions));

CREATE POLICY "Medical outputs isolation" ON public.medical_session_outputs 
    FOR ALL USING (session_id IN (SELECT id FROM public.sessions));

CREATE POLICY "Audit logs session isolation" ON public.session_audit_logs 
    FOR ALL USING (office_id IN (SELECT auth_utils.get_user_offices()));

-- 8. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_session_context_session_id ON public.session_context_sources(session_id);
CREATE INDEX IF NOT EXISTS idx_legal_outputs_session_id ON public.legal_session_outputs(session_id);
CREATE INDEX IF NOT EXISTS idx_medical_outputs_session_id ON public.medical_session_outputs(session_id);
CREATE INDEX IF NOT EXISTS idx_session_audit_session_id ON public.session_audit_logs(session_id);
