-- Migration: Agent Orchestration & Flow Builder Base
-- Data: 2026-05-01

-- 1. Agent Profiles
CREATE TABLE IF NOT EXISTS public.agent_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'whatsapp', -- whatsapp, web, etc
    role TEXT, -- concierge, legal_assistant, clinical_support
    is_active BOOLEAN DEFAULT true,
    system_prompt TEXT,
    tone TEXT DEFAULT 'profissional',
    rules_json JSONB DEFAULT '[]'::jsonb,
    handoff_policy TEXT DEFAULT 'manual', -- manual, automatic_on_failure, always_human
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Automation Flows
CREATE TABLE IF NOT EXISTS public.automation_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    entry_trigger TEXT DEFAULT 'new_message',
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Automation Flow Nodes
CREATE TABLE IF NOT EXISTS public.automation_flow_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL, -- message, question, condition, handoff, crm_action
    label TEXT,
    config_json JSONB DEFAULT '{}'::jsonb,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Automation Flow Edges
CREATE TABLE IF NOT EXISTS public.automation_flow_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES public.automation_flow_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES public.automation_flow_nodes(id) ON DELETE CASCADE,
    condition_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_agent_profiles_office ON public.agent_profiles(office_id);
CREATE INDEX IF NOT EXISTS idx_automation_flows_office ON public.automation_flows(office_id);
CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow_id ON public.automation_flow_nodes(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_edges_flow_id ON public.automation_flow_edges(flow_id);

-- RLS Policies
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_flow_edges ENABLE ROW LEVEL SECURITY;

-- 1. Policies for tables WITH office_id
CREATE POLICY "Office members can manage agent_profiles" ON public.agent_profiles
    FOR ALL USING (
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Office members can manage automation_flows" ON public.automation_flows
    FOR ALL USING (
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
    );

-- 2. Policies for tables WITHOUT office_id (linked via flow_id)
CREATE POLICY "Office members can manage flow_nodes" ON public.automation_flow_nodes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.automation_flows f 
            WHERE f.id = flow_id AND f.office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Office members can manage flow_edges" ON public.automation_flow_edges
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.automation_flows f 
            WHERE f.id = flow_id AND f.office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_update_agent_profiles_timestamp
    BEFORE UPDATE ON public.agent_profiles
    FOR EACH ROW EXECUTE PROCEDURE update_timestamp_column();

CREATE TRIGGER tr_update_automation_flows_timestamp
    BEFORE UPDATE ON public.automation_flows
    FOR EACH ROW EXECUTE PROCEDURE update_timestamp_column();
