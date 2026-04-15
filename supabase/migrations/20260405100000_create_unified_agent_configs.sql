-- migration: create_unified_agent_configs

-- 1. Criar a nova tabela unificada
CREATE TABLE IF NOT EXISTS public.ai_agent_configs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    slug text NOT NULL,                    -- ex: 'nija-gen-motor', 'athena-chat'
    friendly_name text NOT NULL,           -- Nome exibido na UI
    description text,
    
    -- Engine & Runtime
    provider text NOT NULL DEFAULT 'google', -- google, openai, anthropic
    model text NOT NULL,                   -- ex: 'gemini-2.0-pro-exp-02-05'
    temperature numeric(3,2) DEFAULT 0.7,
    max_tokens integer DEFAULT 4096,
    
    -- Prompting Layer
    system_prompt text NOT NULL,           -- O "core" instrutivo (imutável pelo usuário comum)
    extra_instructions text DEFAULT '',    -- Onde o Office adiciona suas regras de negócio
    
    -- Multi-tenancy & Context
    office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE, -- NULL = Global Default
    context_type text DEFAULT 'GENERIC',    -- LEGAL, MEDICAL, ADMINISTRATIVE, VOCAL
    pipeline_stage text,                   -- ex: 'ESTRATEGIA', 'REVISAO' (NULL = Geral)
    
    -- Control
    mode text DEFAULT 'automatic' CHECK (mode IN ('automatic', 'advanced')),
    is_active boolean DEFAULT true,
    
    -- Metadata & Audit
    metadata jsonb DEFAULT '{}',
    version integer DEFAULT 1,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    -- Restrição de unicidade para hierarquia de resolução
    UNIQUE(slug, office_id, pipeline_stage)
);

-- 2. Habilitar RLS
ALTER TABLE public.ai_agent_configs ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acesso
CREATE POLICY "Enable read access for all users" ON public.ai_agent_configs
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.ai_agent_configs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for users based on office_id" ON public.ai_agent_configs
    FOR UPDATE USING (
        office_id IS NULL OR 
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
    );

-- 4. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.ai_agent_configs
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Migrar dados da ai_agents antiga (se houver)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_agents') THEN
        INSERT INTO public.ai_agent_configs (
            slug, friendly_name, description, model, system_prompt, temperature, max_tokens, is_active, metadata, created_at, updated_at
        )
        SELECT 
            slug, name, description, model, system_prompt, temperature, max_tokens, is_active, metadata, created_at, updated_at
        FROM public.ai_agents
        ON CONFLICT (slug, office_id, pipeline_stage) DO NOTHING;
    END IF;
END $$;
