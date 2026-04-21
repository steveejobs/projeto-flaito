-- Migration: Central Operacional Core
-- Data: 2026-05-02

-- 1. Expansão de whatsapp_conversations
ALTER TABLE public.whatsapp_conversations 
    DROP CONSTRAINT IF EXISTS whatsapp_conversations_status_check;

ALTER TABLE public.whatsapp_conversations
    ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'critica')),
    ADD COLUMN IF NOT EXISTS human_required BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_ai_response_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_human_action_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Atualizar status permitidos
ALTER TABLE public.whatsapp_conversations 
    ADD CONSTRAINT whatsapp_conversations_status_check 
    CHECK (status IN ('nova', 'respondida_ia', 'aguardando_cliente', 'humano_necessario', 'em_atendimento_humano', 'encerrada', 'active', 'human_escalated', 'closed'));

-- 2. Tabela de Notas Internas
CREATE TABLE IF NOT EXISTS public.conversation_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES auth.users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Eventos e Auditoria
CREATE TABLE IF NOT EXISTS public.conversation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'user', 'ai')),
    actor_user_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL, -- takeover, status_change, transfer, human_requested, closed, reopened
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_conv_notes_conversation ON public.conversation_notes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_events_conversation ON public.conversation_events(conversation_id);

-- RLS
ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Office members can manage notes" ON public.conversation_notes
    FOR ALL USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));

CREATE POLICY "Office members can view events" ON public.conversation_events
    FOR SELECT USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));

-- 4. Função para Reabertura Automática
CREATE OR REPLACE FUNCTION fn_reopen_conversation_on_inbound()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a conversa estiver encerrada e chega uma mensagem inbound, reabre
    IF NEW.direction = 'inbound' THEN
        UPDATE public.whatsapp_conversations
        SET status = 'nova',
            closed_at = NULL,
            human_required = true -- Se já foi encerrada, melhor um humano olhar a volta
        FROM public.whatsapp_conversations c
        WHERE c.id = NEW.conversation_id AND c.status = 'encerrada';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_reopen_conversation_on_message
    AFTER INSERT ON public.whatsapp_messages
    FOR EACH ROW EXECUTE PROCEDURE fn_reopen_conversation_on_inbound();

-- 5. Função de Auditoria Automática de Status
CREATE OR REPLACE FUNCTION fn_audit_conversation_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.conversation_events (conversation_id, office_id, actor_type, event_type, metadata)
        VALUES (NEW.id, NEW.office_id, 'system', 'status_change', jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_audit_conversation_status
    AFTER UPDATE ON public.whatsapp_conversations
    FOR EACH ROW EXECUTE PROCEDURE fn_audit_conversation_status_change();
