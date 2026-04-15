-- Migration: Message Logs Table
-- Centraliza o histórico de mensagens (WhatsApp, Email) para a Timeline Única

CREATE TABLE IF NOT EXISTS public.message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'whatsapp_evolution', 'whatsapp_n8n', 'sendgrid', etc.
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    content TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    external_id TEXT, -- ID do provedor original
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for timeline performance
CREATE INDEX IF NOT EXISTS idx_message_logs_client_id ON public.message_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON public.message_logs(created_at DESC);

-- RLS
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view message logs of their office"
    ON public.message_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.office_members
            WHERE office_members.office_id = message_logs.office_id
            AND office_members.user_id = auth.uid()
            AND office_members.is_active = true
        )
    );

-- Atualizar a View de Timeline para incluir message_logs (Redefinindo a View)
CREATE OR REPLACE VIEW public.unified_client_events AS
-- 1. Consultas Médicas
SELECT 
    c.id,
    c.office_id,
    p.client_id,
    c.data_consulta as event_date,
    'medical' as module,
    'consulta' as event_type,
    'Consulta Clínica: ' || COALESCE(c.queixa_principal, 'Sem queixa registrada') as title,
    c.status,
    jsonb_build_object(
        'profissional_id', c.profissional_id,
        'paciente_id', p.id,
        'sintomas', c.sintomas
    ) as metadata
FROM public.consultas c
JOIN public.pacientes p ON c.paciente_id = p.id

UNION ALL

-- 2. Processos Jurídicos
SELECT 
    id,
    office_id,
    client_id,
    created_at as event_date,
    'legal' as module,
    'processo' as event_type,
    'Processo: ' || title as title,
    status,
    jsonb_build_object(
        'area', area,
        'cnj_number', cnj_number,
        'side', side
    ) as metadata
FROM public.cases
WHERE deleted_at IS NULL

UNION ALL

-- 3. Mensagens de WhatsApp (Histórico Unificado)
SELECT 
    id,
    office_id,
    client_id,
    created_at as event_date,
    'comm' as module,
    'whatsapp' as event_type,
    CASE WHEN direction = 'outbound' THEN 'Mensagem Enviada: ' ELSE 'Mensagem Recebida: ' END || content as title,
    status,
    metadata
FROM public.message_logs

UNION ALL

-- 4. Análises de Íris (Iridologia)
SELECT 
    ia.id,
    ia.office_id,
    p.client_id,
    ia.created_at as event_date,
    'medical' as module,
    'analise_iris' as event_type,
    'Análise de Íris (' || ia.analysis_type || ')' as title,
    ia.status,
    jsonb_build_object(
        'ai_model', ia.ai_model,
        'findings_count', jsonb_array_length(ia.findings)
    ) as metadata
FROM public.iris_analyses ia
JOIN public.pacientes p ON ia.patient_id = p.id

UNION ALL

-- 5. Laudos Médicos
SELECT 
    mr.id,
    mr.office_id,
    p.client_id,
    mr.created_at as event_date,
    'medical' as module,
    'laudo' as event_type,
    'Laudo: ' || mr.title as title,
    mr.status,
    jsonb_build_object(
        'report_type', mr.report_type,
        'signed', (status = 'signed')
    ) as metadata
FROM public.medical_reports mr
JOIN public.pacientes p ON mr.patient_id = p.id;
