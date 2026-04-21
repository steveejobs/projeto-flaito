-- Migration: 20260405220000_create_agent_executions.sql
-- Objetivo: Criar tabela de persistência para histórico de execuções de agentes conforme Etapa 7.

CREATE TABLE IF NOT EXISTS public.agent_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
    agent_slug text NOT NULL,
    input text NOT NULL,
    output text NOT NULL,
    model text,
    config_source text,
    config_version integer,
    created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;

-- Política de Segurança Baseada em office_id (conforme padrão do projeto)
CREATE POLICY "Users can view agent executions from their office"
ON public.agent_executions
FOR SELECT
TO authenticated
USING (
    office_id IN (
        SELECT office_id FROM public.office_members WHERE user_id = auth.uid()
    )
);

-- Dar permissões para service_role (usado pelas Edge Functions)
GRANT ALL ON public.agent_executions TO service_role;
GRANT ALL ON public.agent_executions TO postgres;

-- Índices para performance de busca no histórico do cliente
CREATE INDEX IF NOT EXISTS idx_agent_executions_client_id ON public.agent_executions(client_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_office_id ON public.agent_executions(office_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_created_at ON public.agent_executions(created_at DESC);

-- Comentários para documentação
COMMENT ON TABLE public.agent_executions IS 'Registro de execuções de agentes de IA por cliente para fins de auditoria e histórico.';
COMMENT ON COLUMN public.agent_executions.config_source IS 'Origem da configuração resolvida (ex: GLOBAL ou OFFICE).';
