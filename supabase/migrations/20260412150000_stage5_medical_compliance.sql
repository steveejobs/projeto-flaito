-- Migration: 20260412150000_stage5_medical_compliance.sql
-- Description: Implementação de logs de auditoria e gates de conformidade médica.

-- 1. Tabela de Auditoria de Revisão Médica
CREATE TABLE IF NOT EXISTS public.medical_review_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    output_id UUID NOT NULL REFERENCES public.medical_session_outputs(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    review_duration_seconds INTEGER,
    content_hash_at_review TEXT NOT NULL,
    snapshot_id UUID REFERENCES public.session_processing_snapshots(id),
    reviewer_notes TEXT,
    action_performed TEXT NOT NULL, -- 'VIEW', 'EDIT', 'APPROVE', 'REJECT'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Expansão de medical_session_outputs para Auditoria
ALTER TABLE public.medical_session_outputs 
ADD COLUMN IF NOT EXISTS review_duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS professional_tag_snapshot TEXT, -- "Nome do Médico - CRM/UF 12345"
ADD COLUMN IF NOT EXISTS language_safety_version TEXT DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS certification_hash TEXT, -- Hash final da certificação vinculada ao CRM
ADD COLUMN IF NOT EXISTS certified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS certified_by UUID REFERENCES auth.users(id);

-- 3. Índices de Auditoria
CREATE INDEX IF NOT EXISTS idx_medical_review_logs_session_id ON public.medical_review_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_medical_review_logs_output_id ON public.medical_review_logs(output_id);
CREATE INDEX IF NOT EXISTS idx_medical_review_logs_reviewer ON public.medical_review_logs(reviewer_id);

-- 4. RLS (Read-only para o log, exceto para o sistema)
ALTER TABLE public.medical_review_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office_isolation_medical_logs" ON public.medical_review_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sessions s
            INNER JOIN public.offices o ON s.office_id = o.id
            INNER JOIN public.office_members om ON o.id = om.office_id
            WHERE s.id = public.medical_review_logs.session_id
            AND om.user_id = auth.uid()
        )
    );

COMMENT ON TABLE public.medical_review_logs IS 'Trilha de auditoria detalhada de cada interação humana com o laudo médico assistivo.';
