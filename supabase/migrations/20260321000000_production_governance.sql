-- Migration: Production Governance (Audit & Templates)
-- Created: 2026-03-21 00:00:00

-- 1. Tabela de Log de Auditoria Estruturada
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'TEMPLATE', 'OFFICE_CONFIG', 'USER_ROLE'
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    actor_user_id UUID REFERENCES auth.users(id),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    before_snapshot JSONB,
    after_snapshot JSONB,
    correlation_id TEXT, -- ID para agrupar log de app e DB
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para buscas rápidas por entidade e escritório
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_office ON public.audit_logs(office_id);

-- 2. Tabela de Histórico de Templates (Snapshots)
CREATE TABLE IF NOT EXISTS public.message_template_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para histórico por template
CREATE INDEX IF NOT EXISTS idx_template_history_id ON public.message_template_history(template_id);

-- 3. Trigger para versionamento automático e registro de histórico
CREATE OR REPLACE FUNCTION public.fn_audit_template_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Se for UPDATE, salvar versão anterior no histórico
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.content <> NEW.content OR OLD.name <> NEW.name) THEN
            -- Incrementar versão
            NEW.version := OLD.version + 1;
            NEW.updated_at := now();
            
            -- Registrar histórico
            INSERT INTO public.message_template_history (
                template_id, 
                office_id, 
                content, 
                version, 
                created_by,
                created_at
            ) VALUES (
                OLD.id,
                OLD.office_id,
                OLD.content,
                OLD.version,
                auth.uid(),
                now()
            );

            -- Registrar auditoria geral
            INSERT INTO public.audit_logs (
                entity_type,
                entity_id,
                action,
                actor_user_id,
                office_id,
                before_snapshot,
                after_snapshot
            ) VALUES (
                'TEMPLATE',
                OLD.id::text,
                'UPDATE',
                auth.uid(),
                OLD.office_id,
                to_jsonb(OLD),
                to_jsonb(NEW)
            );
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
        -- Registrar auditoria de criação
        INSERT INTO public.audit_logs (
            entity_type,
            entity_id,
            action,
            actor_user_id,
            office_id,
            after_snapshot
        ) VALUES (
            'TEMPLATE',
            NEW.id::text,
            'INSERT',
            auth.uid(),
            NEW.office_id,
            to_jsonb(NEW)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativar trigger na tabela de templates
DROP TRIGGER IF EXISTS trg_audit_templates ON public.message_templates;
CREATE TRIGGER trg_audit_templates
    BEFORE INSERT OR UPDATE ON public.message_templates
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_template_changes();

-- RLS Políticas para Auditoria
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_template_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs of their office" ON public.audit_logs
    FOR SELECT USING (
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OWNER') AND is_active = true)
    );

CREATE POLICY "Users can view template history of their office" ON public.message_template_history
    FOR SELECT USING (
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
    );
