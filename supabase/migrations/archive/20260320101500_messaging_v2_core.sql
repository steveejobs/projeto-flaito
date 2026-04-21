-- Migration: Messaging Evolution V1 (Templates & Automations)

-- 1. Categorias de Templates
CREATE TABLE IF NOT EXISTS public.message_template_categories (
    id TEXT PRIMARY KEY, -- 'AGENDA', 'MEDICAL', 'LEGAL', 'GENERAL'
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.message_template_categories (id, name, description)
VALUES 
    ('AGENDA', 'Agenda e Lembretes', 'Templates para compromissos e alertas de horário'),
    ('MEDICAL', 'Clínico/Saúde', 'Templates para laudos, protocolos e recomendações'),
    ('LEGAL', 'Jurídico', 'Templates para processos, prazos e varas'),
    ('GENERAL', 'Comunicação Geral', 'Templates livres de uso geral')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela de Templates
CREATE TABLE IF NOT EXISTS public.message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE, -- NULL se for system global
    category_id TEXT NOT NULL REFERENCES public.message_template_categories(id),
    name TEXT NOT NULL,
    content TEXT NOT NULL, -- Ex: "Olá {{client_name}}, seu agendamento..."
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_templates_office ON public.message_templates(office_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.message_templates(category_id);

-- 3. Tabela de Regras de Automação
CREATE TABLE IF NOT EXISTS public.automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES public.message_templates(id),
    name TEXT NOT NULL,
    resource_type TEXT NOT NULL, -- 'CONSULTA', 'LAUDO', 'CASE', 'PROTOCOL'
    event_type TEXT NOT NULL, -- 'CREATED', 'STATUS_CHANGED', 'TIME_TRIGGER'
    offset_days INTEGER DEFAULT 0, -- Para TIME_TRIGGER (ex: -2 para lembrete)
    settings JSONB DEFAULT '{}'::jsonb, -- Condições extras
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Ajustes em notificacoes_fila
-- Dropping old constraint if it exists and adding expanded one
DO $$ 
BEGIN 
    ALTER TABLE public.notificacoes_fila DROP CONSTRAINT IF EXISTS notificacoes_fila_resource_type_check;
EXCEPTION 
    WHEN undefined_object THEN NULL; 
END $$;

ALTER TABLE public.notificacoes_fila 
    ADD CONSTRAINT notificacoes_fila_resource_type_check 
    CHECK (resource_type IN ('CONSULTA', 'AGENDA_ITEM', 'CASE', 'LAUDO', 'PROTOCOL', 'CLIENTE'));

-- Adicionando link opcional para template usado
ALTER TABLE public.notificacoes_fila ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.message_templates(id);

-- 5. Ajustes em message_logs
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS origin_context TEXT CHECK (origin_context IN ('LEGAL', 'MEDICAL', 'AGENDA', 'GENERAL'));
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS trigger_mode TEXT DEFAULT 'MANUAL' CHECK (trigger_mode IN ('MANUAL', 'AUTOMATIC'));
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS triggered_by_user UUID REFERENCES auth.users(id);
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.message_templates(id);
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS template_version INTEGER;

-- 6. RLS Policies
ALTER TABLE public.message_template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

-- Categories are public viewable
CREATE POLICY "Anyone can view categories" ON public.message_template_categories FOR SELECT USING (true);

-- Templates
CREATE POLICY "Users can manage templates of their office" ON public.message_templates
    FOR ALL USING (
        office_id IS NULL OR 
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
    );

-- Rules
CREATE POLICY "Users can manage rules of their office" ON public.automation_rules
    FOR ALL USING (
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
    );

-- 7. Seed de Templates Padrão (Exemplo)
INSERT INTO public.message_templates (id, category_id, name, content, is_system, is_active)
VALUES (
    'd290f1ee-6c54-4b01-90e6-d701748f0851',
    'AGENDA',
    'Lembrete de Consulta Padrão',
    'Olá {{client_name}}, lembramos da sua consulta no dia {{appointment_date}} às {{appointment_time}} na {{office_name}}.',
    true,
    true
) ON CONFLICT (id) DO NOTHING;
