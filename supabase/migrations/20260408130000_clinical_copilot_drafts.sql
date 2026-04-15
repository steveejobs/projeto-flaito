-- Migration: 20260408130000_clinical_copilot_drafts.sql
-- Description: Infraestrutura para Clinical Copilot V6: Drafts, Revisão Humana (HITL) e Auditoria.

-- 1. Enum para Status de Revisão Clínica
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clinical_review_status') THEN
        CREATE TYPE clinical_review_status AS ENUM ('pending', 'approved', 'edited', 'rejected');
    END IF;
END $$;

-- 2. Expansão de Auditoria de Segurança (Fonte de Verdade da Camada de Governança)
ALTER TABLE public.medical_safety_audits 
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS review_status clinical_review_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS final_content TEXT,
ADD COLUMN IF NOT EXISTS clinical_mode TEXT DEFAULT 'standard'; -- standard, professional_assisted

-- 3. Expansão de Receitas e Dietas (Camada de Domínio)
ALTER TABLE public.receitas_dietas
ADD COLUMN IF NOT EXISTS is_ai_draft BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS review_status clinical_review_status DEFAULT 'approved', -- Padrão legado é aprovado
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_original_content JSONB; -- Snapshot do rascunho original para auditoria comparativa

-- 4. Expansão de Análises de Íris (Camada de Domínio)
ALTER TABLE public.iris_analyses
ADD COLUMN IF NOT EXISTS review_status clinical_review_status DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 5. Índices para Dashboard de Revisão
CREATE INDEX IF NOT EXISTS idx_safety_audits_review ON public.medical_safety_audits(review_status, office_id);
CREATE INDEX IF NOT EXISTS idx_receitas_review ON public.receitas_dietas(review_status, office_id);

-- 6. Comentários
COMMENT ON COLUMN public.medical_safety_audits.clinical_mode IS 'Define se a IA operou em modo autônomo (standard) ou como copiloto assistido (professional_assisted).';
COMMENT ON COLUMN public.receitas_dietas.ai_original_content IS 'Armazena a versão original gerada pela IA antes de qualquer edição humana para fins de auditoria forense.';
