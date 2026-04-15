-- Migração para WhatsApp Inteligente + CRM Integration
-- Data: 2024-05-01

-- 1. Tabela de Conversas (Estado do Atendimento)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
    normalized_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'human_escalated', 'closed')),
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Tabela de Mensagens (Histórico Auditável)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    external_id TEXT UNIQUE, -- Para idempotência (provido pelo WhatsApp/Simulador)
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    content TEXT NOT NULL,
    intent_detected TEXT, -- novo_lead, agendamento, acompanhamento_processo, duvida_geral, escalar_humano
    intent_confidence NUMERIC(3,2),
    processed_at TIMESTAMPTZ,
    sender_phone TEXT,
    receiver_phone TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Índices para Performance e Busca
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone ON public.whatsapp_conversations(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_office ON public.whatsapp_conversations(office_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_external_id ON public.whatsapp_messages(external_id);

-- 4. Row Level Security (RLS)
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para whatsapp_conversations
DO $$ BEGIN
    CREATE POLICY "Conversas: Select por Office ID" ON public.whatsapp_conversations
    FOR SELECT USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Políticas para whatsapp_messages
DO $$ BEGIN
    CREATE POLICY "Mensagens: Select por Office ID" ON public.whatsapp_messages
    FOR SELECT USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. Trigger para updated_at em conversations
CREATE OR REPLACE FUNCTION update_whatsapp_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_update_whatsapp_conversation_timestamp
    BEFORE UPDATE ON public.whatsapp_conversations
    FOR EACH ROW
    EXECUTE PROCEDURE update_whatsapp_conversation_timestamp();

-- 6. Comentários para documentação
COMMENT ON TABLE public.whatsapp_conversations IS 'Estado centralizado de conversas por WhatsApp.';
COMMENT ON TABLE public.whatsapp_messages IS 'Registro histórico de mensagens enviadas e recebidas com classificação de IA.';
