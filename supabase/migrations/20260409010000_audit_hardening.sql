-- Migration: 20260409010000_audit_hardening.sql
-- Description: Hardening de Auditoria e Governança (Níveis A-D, Hashes e Metadados de Origem)

-- 1. Enum para Níveis de Saída (Ponto 5.2 do pedido do usuário)
DO $$ BEGIN
    CREATE TYPE output_validation_level AS ENUM ('LEVEL_A', 'LEVEL_B', 'LEVEL_C', 'LEVEL_D');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Expansão de nija_extractions (Integridade e Origem - Ponto 2 e 3.1)
ALTER TABLE public.nija_extractions 
ADD COLUMN IF NOT EXISTS integrity_hash TEXT,
ADD COLUMN IF NOT EXISTS origin_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS legal_basis TEXT;

COMMENT ON COLUMN public.nija_extractions.integrity_hash IS 'SHA-256 do arquivo original para garantir imutabilidade durante o processamento.';
COMMENT ON COLUMN public.nija_extractions.origin_metadata IS 'Dados de origem: portal de captura, timestamp, IP ou identificador de sistema externo.';

-- 3. Expansão de audit_logs (Raciocínio e Validação - Ponto 2)
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS reasoning_log JSONB,
ADD COLUMN IF NOT EXISTS output_level output_validation_level DEFAULT 'LEVEL_B',
ADD COLUMN IF NOT EXISTS model_version TEXT,
ADD COLUMN IF NOT EXISTS system_prompt_version TEXT;

COMMENT ON COLUMN public.audit_logs.reasoning_log IS 'Log do processo de raciocínio da IA (Chain-of-Thought) para auditoria pericial.';

-- 4. Expansão de medical_governance_incidents
ALTER TABLE public.medical_governance_incidents 
ADD COLUMN IF NOT EXISTS integrity_hash TEXT,
ADD COLUMN IF NOT EXISTS output_level output_validation_level DEFAULT 'LEVEL_D'; -- Médico costuma exigir revisão

-- 5. Tabela de Relatórios Consolidados (Ponto 7 - Os 7 blocos obrigatórios)
CREATE TABLE IF NOT EXISTS public.governance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL, -- 'MEDICAL_LAUDO', 'LEGAL_DOSSIER', 'LEGAL_PIECE'
    
    -- Os 7 blocos estruturados
    block_identification JSONB NOT NULL, -- Identificação
    block_material JSONB NOT NULL,       -- Material analisado
    block_method JSONB NOT NULL,         -- Método
    block_findings JSONB NOT NULL,       -- Achados
    block_correlation JSONB NOT NULL,    -- Correlação técnica
    block_limitations JSONB NOT NULL,    -- Limitações
    block_conclusion JSONB NOT NULL,     -- Conclusão e assinatura
    
    output_level output_validation_level NOT NULL,
    is_signed BOOLEAN DEFAULT FALSE,
    signed_by UUID REFERENCES auth.users(id),
    signed_at TIMESTAMPTZ,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para governance_reports
ALTER TABLE public.governance_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "office_isolation_reports" ON public.governance_reports
    USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true));

-- 6. Índices para Auditoria
CREATE INDEX IF NOT EXISTS idx_gov_reports_case ON public.governance_reports(case_id);
CREATE INDEX IF NOT EXISTS idx_gov_reports_patient ON public.governance_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_level ON public.audit_logs(output_level);
