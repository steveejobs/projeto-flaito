-- Expansão de agent_profiles para configurações avançadas
ALTER TABLE agent_profiles 
ADD COLUMN IF NOT EXISTS goal TEXT,
ADD COLUMN IF NOT EXISTS fallback_message TEXT,
ADD COLUMN IF NOT EXISTS fallback_node_id UUID,
ADD COLUMN IF NOT EXISTS allowed_actions_json JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS allowed_knowledge_sources_json JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS business_hours_json JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS default_flow_id UUID;

-- Tabela de Versões de Fluxos (Versionamento Real Draft/Published)
CREATE TABLE IF NOT EXISTS flow_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID REFERENCES automation_flows(id) ON DELETE CASCADE,
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
    definition_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Execução (Flow Runs - Runtime Imutável)
CREATE TABLE IF NOT EXISTS flow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    version_id UUID REFERENCES flow_versions(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL,
    channel TEXT,
    trigger_type TEXT,
    status TEXT DEFAULT 'running',
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT now(),
    finished_at TIMESTAMPTZ
);

-- Tabela de Passos da Execução (Auditoria Granular)
CREATE TABLE IF NOT EXISTS flow_run_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES flow_runs(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    node_type TEXT,
    node_label TEXT,
    input_data JSONB,
    output_data JSONB,
    executed_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE flow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_run_steps ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (Office isolation)
CREATE POLICY "Office isolation for flow_versions" ON flow_versions 
    USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));

CREATE POLICY "Office isolation for flow_runs" ON flow_runs 
    USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));

CREATE POLICY "Office isolation for flow_run_steps" ON flow_run_steps 
    USING (run_id IN (SELECT id FROM flow_runs WHERE office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())));
