-- Migration: 20260409004000_init_stage_1_infrastructure.sql
-- Goal: Initialize process_dossiers table and add Stage 1 specific columns.
-- Fix: Using office_members for RLS since profiles table is missing in this project.

-- 1. Create the main dossier table (if not exists)
CREATE TABLE IF NOT EXISTS public.process_dossiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
    office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
    version integer NOT NULL DEFAULT 1,
    
    -- Legacy fields (NIJA V1/V2 compatibility)
    ramo text,
    fase_processual text,
    polo text,
    grau_risco text,
    full_analysis jsonb NOT NULL DEFAULT '{}',
    vicios jsonb DEFAULT '[]',
    estrategias jsonb DEFAULT '{}',
    sugestao_peca jsonb DEFAULT '{}',
    provas jsonb DEFAULT '[]',
    resumo_tatico jsonb DEFAULT '{}',
    
    -- Structured fields (NIJA V2)
    timeline_factual jsonb DEFAULT '[]',
    timeline_processual jsonb DEFAULT '[]',
    fato_prova_map jsonb DEFAULT '[]',
    lacunas_detectadas jsonb DEFAULT '[]',
    pedidos_estruturados jsonb DEFAULT '[]',
    documentos_utilizados uuid[] DEFAULT '{}',
    
    -- Audit fields
    config_resolver_id uuid REFERENCES public.ai_agent_configs(id) ON DELETE SET NULL,
    config_resolver_version integer,
    config_resolver_source text,
    config_fallback_used boolean DEFAULT false,
    
    -- Stage 1 New Fields (Evidence Inventory & Truth Map)
    evidence_inventory text,
    drafting_readiness_status text,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.process_dossiers ENABLE ROW LEVEL SECURITY;

-- 3. Security Policy (Office Isolation via office_members)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'process_dossiers' AND policyname = 'office_isolation_dossiers'
    ) THEN
        CREATE POLICY "office_isolation_dossiers"
        ON public.process_dossiers
        FOR ALL
        TO authenticated
        USING (
            office_id IN (
                SELECT office_id FROM office_members WHERE user_id = auth.uid()
            )
        );
    END IF;
END $$;

-- 4. Indices
CREATE INDEX IF NOT EXISTS process_dossiers_case_id_idx ON public.process_dossiers(case_id);
CREATE INDEX IF NOT EXISTS process_dossiers_office_id_idx ON public.process_dossiers(office_id);

-- 5. Updated At Trigger
CREATE OR REPLACE FUNCTION update_process_dossiers_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_process_dossiers_updated_at') THEN
        CREATE TRIGGER set_process_dossiers_updated_at
        BEFORE UPDATE ON public.process_dossiers
        FOR EACH ROW EXECUTE FUNCTION update_process_dossiers_updated_at();
    END IF;
END $$;

-- 6. Comments
COMMENT ON TABLE public.process_dossiers IS 'Repositório central de verdade e dossiês jurídico/fáticos do caso.';
COMMENT ON COLUMN public.process_dossiers.evidence_inventory IS 'Index documental em Markdown gerado no Estágio 1 (Evidence Inventory).';
COMMENT ON COLUMN public.process_dossiers.drafting_readiness_status IS 'Status de prontidão para o Estágio 2 (READY_FOR_STAGE_2, BLOCKED_MISSING_EVIDENCE, BLOCKED_CONFLICTING_RECORD).';
