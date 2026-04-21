-- =============================================
-- Migration: Escavador CRM Integration (Fase 2)
-- Version: 20260426000000
-- =============================================

BEGIN;

-- 1. Enum para Níveis de Confiança
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escavador_confidence_level') THEN
        CREATE TYPE public.escavador_confidence_level AS ENUM (
            'HIGH', 
            'MEDIUM', 
            'LOW'
        );
    END IF;
END $$;

-- 2. Tabela de Processos Vinculados ao Cliente
CREATE TABLE IF NOT EXISTS public.client_linked_processes (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id                   UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    client_id                   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    numero_processo             TEXT NOT NULL,
    escavador_search_request_id UUID REFERENCES public.escavador_search_requests(id) ON DELETE SET NULL,
    external_id                 TEXT, -- ID do Escavador
    source                      TEXT NOT NULL DEFAULT 'ESCAVADOR',
    confidence_level            public.escavador_confidence_level NOT NULL,
    match_reason                TEXT, -- Ex: "CPF exato encontrado"
    match_input_type            TEXT, -- 'CPF_CNPJ', 'CNJ', 'NOME', 'OAB'
    is_confirmed                BOOLEAN DEFAULT false,
    review_notes                TEXT,
    linked_at                   TIMESTAMPTZ DEFAULT now(),
    linked_by                   UUID REFERENCES auth.users(id),
    created_at                  TIMESTAMPTZ DEFAULT now(),
    updated_at                  TIMESTAMPTZ DEFAULT now(),
    
    -- Restrição de Unicidade: Um cliente não pode ter o mesmo processo vinculado duas vezes
    CONSTRAINT unique_client_process UNIQUE (client_id, numero_processo)
);

-- RLS
ALTER TABLE public.client_linked_processes ENABLE ROW LEVEL SECURITY;

-- Office Isolation Policy
CREATE POLICY "office_isolation_linked_processes"
    ON public.client_linked_processes FOR ALL
    USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true));

-- 3. Índices para Performance e Auditoria
CREATE INDEX IF NOT EXISTS idx_linked_proccess_client ON public.client_linked_processes(client_id);
CREATE INDEX IF NOT EXISTS idx_linked_proccess_cnj ON public.client_linked_processes(numero_processo);
CREATE INDEX IF NOT EXISTS idx_linked_proccess_conf ON public.client_linked_processes(confidence_level);

-- Trigger para updated_at
CREATE TRIGGER tg_update_client_linked_processes_updated_at
    BEFORE UPDATE ON public.client_linked_processes
    FOR EACH ROW EXECUTE FUNCTION public.update_escavador_updated_at();

-- 4. Permissões RBAC (Mapeamento Lógico)
-- O sistema já utiliza uma tabela de permissões ou checks via RPC. 
-- Garantiremos que as novas permissões existam para uso nas Edge Functions:
-- 'escavador:consult', 'escavador:link', 'escavador:monitor', 'escavador:nija'

COMMIT;
