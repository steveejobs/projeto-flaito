-- Migration: 20260407110000_medical_hardening_core.sql
-- Description: Hardening P0 - Campos de Revisão e Automação de Voz Determinística.

-- 1. Campos de Revisão para Análises de Íris
ALTER TABLE public.iris_analyses
ADD COLUMN IF NOT EXISTS requires_medical_review BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS review_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT FALSE;

-- 2. Campos de Revisão para Análises Clínicas (Agentes)
-- Verificando se a tabela existe (pode ser medical_agent_analyses ou similar)
-- Com base no código das functions, as tabelas usadas são 'iris_analyses' e o agente genérico.
-- Se houver uma tabela para o agente clínico, aplicamos nela também.
-- Nota: O código de medical-agent-analysis.ts não parece persistir em uma tabela específica ainda (além do log).
-- Vamos criar uma tabela para persistência segura se não existir.

CREATE TABLE IF NOT EXISTS public.medical_agent_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) NOT NULL,
    patient_id UUID NOT NULL,
    agent_slug TEXT NOT NULL,
    input_text TEXT,
    ai_response JSONB NOT NULL,
    requires_medical_review BOOLEAN DEFAULT TRUE,
    reviewed_by_user_id UUID REFERENCES auth.users(id),
    review_confirmed_at TIMESTAMPTZ,
    is_finalized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.medical_agent_analyses ENABLE ROW LEVEL SECURITY;

-- 3. Tabela de Ações de Voz Pendentes (Confirmação Determinística)
CREATE TABLE IF NOT EXISTS public.pending_voice_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    intent TEXT NOT NULL, -- e.g., 'sendMessage', 'createAppointment'
    args JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pending_voice_actions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para pending_voice_actions
CREATE POLICY "Users can only see/manage their own pending actions"
ON public.pending_voice_actions
FOR ALL
USING (auth.uid() = user_id);

-- 4. Índices para performance e segurança
CREATE INDEX IF NOT EXISTS idx_pending_voice_actions_user_expires ON public.pending_voice_actions(user_id, expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_iris_analyses_review_required ON public.iris_analyses(requires_medical_review) WHERE requires_medical_review = TRUE;
