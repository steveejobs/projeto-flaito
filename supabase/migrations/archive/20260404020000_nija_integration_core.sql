-- Migration: NIJA Integration Core (V2)
-- Objetivo: Suportar o pipeline MAESTRO completo com persistência e versionamento.

-- 1. Tabela para rastrear as execuções do orquestrador
CREATE TABLE IF NOT EXISTS public.nija_pipeline_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
    office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL')),
    current_stage text,
    dossier_id uuid,
    strategy_id jsonb, -- Referência à estratégia gerada
    initial_piece_id uuid,
    final_piece_id uuid,
    judge_simulation_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    logs jsonb DEFAULT '[]'::jsonb,
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS NIJA Pipeline Runs
ALTER TABLE public.nija_pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Office isolation nija_pipeline_runs"
    ON public.nija_pipeline_runs
    FOR ALL
    TO authenticated
    USING (office_id IN (SELECT office_id FROM public.profiles WHERE id = auth.uid()));

-- 2. Tabela para Auditorias e Revisões (NIJA-REVIEW)
CREATE TABLE IF NOT EXISTS public.nija_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
    document_id uuid, -- Referência à peça (legal_documents)
    quality_score integer CHECK (quality_score BETWEEN 0 AND 100),
    report_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    structured_findings jsonb DEFAULT '[]'::jsonb,
    critical_risks jsonb DEFAULT '[]'::jsonb,
    suggestions jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- RLS NIJA Reviews
ALTER TABLE public.nija_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Office isolation nija_reviews"
    ON public.nija_reviews
    FOR ALL
    TO authenticated
    USING (office_id IN (SELECT office_id FROM public.profiles WHERE id = auth.uid()));

-- 3. Evolução da tabela legal_documents (Case/Client Link + Versioning)
DO $$ 
BEGIN 
    -- Adicionar case_id se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='legal_documents' AND column_name='case_id') THEN
        ALTER TABLE public.legal_documents ADD COLUMN case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE;
    END IF;

    -- Adicionar client_id se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='legal_documents' AND column_name='client_id') THEN
        ALTER TABLE public.legal_documents ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
    END IF;

    -- Adicionar version se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='legal_documents' AND column_name='version') THEN
        ALTER TABLE public.legal_documents ADD COLUMN version integer DEFAULT 1;
    END IF;

    -- Adicionar parent_id para versionamento hierárquico
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='legal_documents' AND column_name='parent_id') THEN
        ALTER TABLE public.legal_documents ADD COLUMN parent_id uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL;
    END IF;

    -- Adicionar metadata se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='legal_documents' AND column_name='metadata') THEN
        ALTER TABLE public.legal_documents ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 4. Vínculo entre Juiz e Documento
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='judge_simulations' AND column_name='document_id') THEN
        ALTER TABLE public.judge_simulations ADD COLUMN document_id uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_nija_pipeline_runs_case ON public.nija_pipeline_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_nija_pipeline_runs_office ON public.nija_pipeline_runs(office_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_case ON public.legal_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_client ON public.legal_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_nija_reviews_doc ON public.nija_reviews(document_id);

COMMENT ON TABLE nija_pipeline_runs IS 'Sessões de orquestração do NIJA-MAESTRO';
COMMENT ON TABLE nija_reviews IS 'Auditorias técnicas geradas pelo NIJA-REVIEW';
