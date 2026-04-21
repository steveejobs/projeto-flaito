-- Migration: Notifications Engine
-- Tables for scheduled alerts and office configurations

-- 1. Configurações de Notificação por Escritório
CREATE TABLE IF NOT EXISTS public.notificacao_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    alerta_antecedencia_dias INTEGER DEFAULT 2, -- Padrão: 2 dias antes
    whatsapp_habilitado BOOLEAN DEFAULT false,
    sms_habilitado BOOLEAN DEFAULT false,
    email_habilitado BOOLEAN DEFAULT false,
    api_endpoint TEXT, -- Endpoint da API de mensageria personalizada (se houver)
    api_token TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(office_id)
);

-- 2. Fila de Notificações (Pendentes e Processadas)
CREATE TABLE IF NOT EXISTS public.notificacoes_fila (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('CONSULTA', 'AGENDA_ITEM')),
    resource_id UUID NOT NULL,
    destinatario_nome TEXT,
    destinatario_telefone TEXT,
    mensagem TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'RETRYING', 'CANCELLED')),
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    payload_envio JSONB, -- Payload enviado à API
    resposta_provedor JSONB, -- Resposta da API
    logs JSONB DEFAULT '[]'::jsonb,
    idempotency_key TEXT UNIQUE, -- resource_id + scheduled_at (formatado)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS POLICIES
ALTER TABLE public.notificacao_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_fila ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage notification config for their office"
    ON public.notificacao_config FOR ALL
    USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Users can view notification queue for their office"
    ON public.notificacoes_fila FOR SELECT
    USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true));

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_notificacoes_scheduled ON public.notificacoes_fila(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_notificacoes_office ON public.notificacoes_fila(office_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_resource ON public.notificacoes_fila(resource_type, resource_id);

-- FUNCTION to generate idempotency key
CREATE OR REPLACE FUNCTION public.generate_notificacao_idempotency_key()
RETURNS TRIGGER AS $$
BEGIN
    NEW.idempotency_key := NEW.resource_id::text || '_' || to_char(NEW.scheduled_at, 'YYYYMMDD');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_notificacao_idempotency
BEFORE INSERT ON public.notificacoes_fila
FOR EACH ROW
EXECUTE FUNCTION public.generate_notificacao_idempotency_key();
