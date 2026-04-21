-- Migration: 20260408110000_governance_v4_refinement.sql
-- Description: Refinamento de auditoria e revogação manual para Governança V4

ALTER TABLE public.medical_risk_states 
ADD COLUMN IF NOT EXISTS lifted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS lifted_reason TEXT,
ADD COLUMN IF NOT EXISTS applied_by_id UUID REFERENCES auth.users(id);

-- Índice para busca rápida de restrições ativas (não revogadas e não expiradas)
CREATE INDEX IF NOT EXISTS idx_risk_states_active_lookup 
ON public.medical_risk_states(scope_type, scope_id) 
WHERE lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now());

COMMENT ON COLUMN public.medical_risk_states.lifted_by IS 'Usuário (ADMIN) que revogou manualmente a restrição.';
COMMENT ON COLUMN public.medical_risk_states.lifted_reason IS 'Motivo obrigatório para a revogação manual da restrição.';
