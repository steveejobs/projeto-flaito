-- ==========================================================
-- Migration: Escavador Advanced Product (Fase 3.1)
-- Version: 20260427000000
-- ==========================================================

BEGIN;

-- 1. Expansão da Tabela de Vínculos
ALTER TABLE public.client_linked_processes
ADD COLUMN IF NOT EXISTS confidence_score      NUMERIC(5,2) DEFAULT 0, -- Score de 0 a 100
ADD COLUMN IF NOT EXISTS status                TEXT DEFAULT 'SUGGESTED',
ADD COLUMN IF NOT EXISTS is_permanent_ignore   BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS decision_time_ms      BIGINT, -- Latência da decisão humana
ADD COLUMN IF NOT EXISTS auto_monitored         BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS case_created_id        UUID REFERENCES public.cases(id) ON DELETE SET NULL;

-- 2. Constraint de Status
ALTER TABLE public.client_linked_processes
DROP CONSTRAINT IF EXISTS client_linked_processes_status_check;

ALTER TABLE public.client_linked_processes
ADD CONSTRAINT client_linked_processes_status_check 
CHECK (status IN ('SUGGESTED', 'LINKED', 'REJECTED', 'IGNORED'));

-- 3. Índices para Otimização de Busca e BI
CREATE INDEX IF NOT EXISTS idx_linked_proc_status ON public.client_linked_processes(status);
CREATE INDEX IF NOT EXISTS idx_linked_proc_score ON public.client_linked_processes(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_linked_proc_permanent_ignore ON public.client_linked_processes(is_permanent_ignore) WHERE is_permanent_ignore = true;

-- 4. View de Métricas de Performance (BI)
CREATE OR REPLACE VIEW public.vw_escavador_performance AS
SELECT 
    office_id,
    COUNT(*) as total_suggestions,
    COUNT(*) FILTER (WHERE status = 'LINKED') as total_linked,
    COUNT(*) FILTER (WHERE status = 'REJECTED') as total_rejected,
    CASE 
        WHEN COUNT(*) FILTER (WHERE status IN ('LINKED', 'REJECTED')) > 0 
        THEN (COUNT(*) FILTER (WHERE status = 'LINKED')::FLOAT / COUNT(*) FILTER (WHERE status IN ('LINKED', 'REJECTED'))) * 100
        ELSE 0 
    END as conversion_rate,
    AVG(decision_time_ms) FILTER (WHERE decision_time_ms IS NOT NULL) / 1000 as avg_decision_time_seconds
FROM public.client_linked_processes
GROUP BY office_id;

-- 5. Função para marcar rejeição (Helper para Edge Function)
CREATE OR REPLACE FUNCTION public.escavador_record_decision(
    p_link_id UUID,
    p_status TEXT,
    p_notes TEXT,
    p_permanent_ignore BOOLEAN DEFAULT false
) RETURNS VOID AS $$
BEGIN
    UPDATE public.client_linked_processes
    SET 
        status = p_status,
        review_notes = p_notes,
        is_permanent_ignore = p_permanent_ignore,
        decision_time_ms = extract(epoch from (now() - created_at)) * 1000,
        updated_at = now()
    WHERE id = p_link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
