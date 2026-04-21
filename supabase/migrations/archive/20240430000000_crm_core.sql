-- ==========================================
-- CRM CORE TABLES
-- ==========================================

-- 1. Tabela de Leads
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active', -- active, converted, lost
    pipeline_stage TEXT NOT NULL DEFAULT 'novo_contato', -- novo_contato, qualificacao, briefing_agendado, proposta_enviada, fechado
    source TEXT,
    notes TEXT,
    ai_summary TEXT,
    last_interaction_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Atividades/Histórico
CREATE TABLE IF NOT EXISTS public.crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- stage_change, note, automation_move
    description TEXT,
    previous_stage TEXT,
    current_stage TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Habilitar RLS
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Segurança (Isolamento por Office)

-- Leads
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_leads' AND policyname = 'Leads are viewable by office members') THEN
        CREATE POLICY "Leads are viewable by office members" ON public.crm_leads
            FOR SELECT USING (
                office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_leads' AND policyname = 'Leads are insertable by office members') THEN
        CREATE POLICY "Leads are insertable by office members" ON public.crm_leads
            FOR INSERT WITH CHECK (
                office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_leads' AND policyname = 'Leads are updatable by office members') THEN
        CREATE POLICY "Leads are updatable by office members" ON public.crm_leads
            FOR UPDATE USING (
                office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
            );
    END IF;
END $$;

-- Atividades
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_activities' AND policyname = 'Activities are viewable by office members') THEN
        CREATE POLICY "Activities are viewable by office members" ON public.crm_activities
            FOR SELECT USING (
                office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_activities' AND policyname = 'Activities are insertable by office members') THEN
        CREATE POLICY "Activities are insertable by office members" ON public.crm_activities
            FOR INSERT WITH CHECK (
                office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
            );
    END IF;
END $$;

-- 5. Indexes para Performance
CREATE INDEX IF NOT EXISTS idx_crm_leads_office_id ON public.crm_leads(office_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_client_id ON public.crm_leads(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead_id ON public.crm_activities(lead_id);
