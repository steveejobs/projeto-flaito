-- Migration: 20260408140000_governance_feedback_v2.sql
-- Description: Feedback Loop Human-in-the-Loop (HITL) e Métricas de Precisão Clínica (V5 Expanded)

-- 1. Novos Tipos de Classificação
DO $$ BEGIN
    CREATE TYPE public.review_classification_type AS ENUM ('approved_no_edit', 'approved_light_edit', 'approved_heavy_edit', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.governance_root_cause AS ENUM ('technical_ai_error', 'clinical_variation', 'data_missing', 'prompt_misalignment');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Atualização de medical_safety_audits para HITL Granular
ALTER TABLE public.medical_safety_audits 
ADD COLUMN IF NOT EXISTS review_classification public.review_classification_type,
ADD COLUMN IF NOT EXISTS edit_distance_score NUMERIC(5,2) DEFAULT 0, -- 0 a 1 (0 = idêntico, 1 = totalmente diferente)
ADD COLUMN IF NOT EXISTS intervention_types TEXT[] DEFAULT '{}', -- {'diagnosis', 'dose', 'text', 'structure', 'conduct'}
ADD COLUMN IF NOT EXISTS root_cause public.governance_root_cause,
ADD COLUMN IF NOT EXISTS feedback_notes TEXT;

-- 3. Tabela de Recomendações (Caso não exista da Fase V4/V5 inicial)
CREATE TABLE IF NOT EXISTS public.medical_governance_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id),
    recommendation_type TEXT NOT NULL, -- 'policy_adjustment', 'prompt_refinement', 'user_training'
    title TEXT NOT NULL,
    description TEXT,
    risk_level TEXT DEFAULT 'low',
    impact_score NUMERIC(5,2) DEFAULT 0, -- Calculado baseado em frequência e severidade
    status TEXT DEFAULT 'open', -- 'open', 'applied', 'dismissed'
    suggested_policy_snapshot JSONB,
    evidence_ids UUID[], -- Array de incident_ids ou audit_ids que geraram isto
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Status de Revisão Humana em Alertas
DO $$ BEGIN
    ALTER TABLE public.medical_governance_alerts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 5. Trigger de Fechamento Automático Inteligente
CREATE OR REPLACE FUNCTION public.fn_on_clinical_review_completed()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o status de revisão mudar de pending para algo final
    IF OLD.review_status = 'pending' AND NEW.review_status IN ('approved', 'rejected', 'edited') THEN
        
        -- 1. Identificar alertas vinculados a este audit (se houver correlação direta por evidence/metadata)
        -- Nota: Assume-se que o incident_id está vinculado ao audit_id em metadados de evidência
        
        -- Para alertas de Risco BAIXO ou MÉDIO (info, warning): Fechar automaticamente
        UPDATE public.medical_governance_alerts
        SET is_read = TRUE, status = 'resolved_by_hitl'
        WHERE id IN (
            SELECT a.id 
            FROM public.medical_governance_alerts a
            JOIN public.medical_governance_incidents i ON a.incident_id = i.id
            WHERE i.evidence->>'audit_id' = NEW.id::text
            AND i.severity IN ('info', 'warning')
        );

        -- Para alertas de Risco ALTO ou CRÍTICO: Apenas marcar como revisado, não fechar
        UPDATE public.medical_governance_alerts
        SET status = 'reviewed_by_human'
        WHERE id IN (
            SELECT a.id 
            FROM public.medical_governance_alerts a
            JOIN public.medical_governance_incidents i ON a.incident_id = i.id
            WHERE i.evidence->>'audit_id' = NEW.id::text
            AND i.severity IN ('high', 'critical')
        );
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_on_clinical_review_completed ON public.medical_safety_audits;
CREATE TRIGGER tr_on_clinical_review_completed
    AFTER UPDATE ON public.medical_safety_audits
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_on_clinical_review_completed();

-- 6. Índices para Performance
CREATE INDEX IF NOT EXISTS idx_audit_classification ON public.medical_safety_audits(review_classification);
CREATE INDEX IF NOT EXISTS idx_rec_impact ON public.medical_governance_recommendations(impact_score DESC);

COMMENT ON COLUMN public.medical_safety_audits.edit_distance_score IS 'Métrica de divergência entre o rascunho da IA e a versão final do médico (0 a 1).';
