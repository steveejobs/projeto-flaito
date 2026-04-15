-- Migração: Mensageria Fase 2 - Anexos, Engajamento e Idempotência
-- Data: 2026-03-20

-- 1. Idempotência de Webhooks
CREATE TABLE IF NOT EXISTS public.webhook_processed_events (
    event_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT now(),
    office_id UUID REFERENCES public.offices(id)
);

-- Ativar RLS
ALTER TABLE public.webhook_processed_events ENABLE ROW LEVEL SECURITY;

-- 2. Evolução do message_logs para suporte a engajamento e classificação
ALTER TABLE public.message_logs 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS classification TEXT CHECK (classification IN ('CONFIRMATION', 'CANCELLATION', 'RESCHEDULE', 'DOUBT', 'OTHER', 'HUMAN_INTERVENTION_REQUIRED')),
ADD COLUMN IF NOT EXISTS engagement_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- 3. Evolução de message_templates para anexos estáticos
ALTER TABLE public.message_templates
ADD COLUMN IF NOT EXISTS static_attachments JSONB DEFAULT '[]';

-- 4. Índices sugeridos para performance de anexos dinâmicos e busca por client_id
-- Índices para pacientes (para busca de laudos/protocolos via client_id)
CREATE INDEX IF NOT EXISTS idx_pacientes_client_id ON public.pacientes(client_id);

-- Índices compostos para busca de "último registro" conforme solicitado no plano
CREATE INDEX IF NOT EXISTS idx_medical_reports_patient_date ON public.medical_reports(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_protocols_patient_date ON public.patient_protocols(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_judicial_notices_case_date ON public.cases(client_id, created_at DESC);

-- Índice para busca rápida de logs por external_id (Z-API messageId)
CREATE INDEX IF NOT EXISTS idx_message_logs_external_id ON public.message_logs(external_id);

-- 5. Atualização do enum de tipos de automação (se necessário expandir triggers)
-- Nota: Supabase migrations recomendam não alterar ENUMs diretamente se possível, mas automation_rules.event_type é TEXT no nosso schema anterior.

-- Comentários de auditoria
COMMENT ON COLUMN public.message_logs.engagement_score IS 'Score de 0 a 100 baseado na rapidez de leitura/resposta';
COMMENT ON COLUMN public.message_logs.classification IS 'Classificação automática baseada em keywords ou IA';

-- Permissões básicas para RLS (Assumindo que herda do office_id)
CREATE POLICY "Users can view webhook events of their office" 
    ON public.webhook_processed_events FOR SELECT 
    USING (office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid()));
