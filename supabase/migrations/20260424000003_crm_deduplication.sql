-- Migration: CRM Deduplication & Match Engine
-- File: 20260424000003_crm_deduplication.sql

BEGIN;

-- 1. Tabela de Correspondências (Relacional para suportar N matches)
CREATE TABLE IF NOT EXISTS public.crm_lead_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    matched_lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    matched_client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    match_type TEXT NOT NULL, -- 'duplicate_probable', 'existing_client_other_case', 'review_required'
    score INTEGER DEFAULT 0,
    reason_payload JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending', -- 'pending', 'dismissed', 'confirmed'
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Garante que um match aponte para pelo menos um lead ou um cliente existente
    CONSTRAINT one_match_target CHECK (matched_lead_id IS NOT NULL OR matched_client_id IS NOT NULL),
    -- Evita duplicidade na própria tabela de matches
    CONSTRAINT unique_lead_match UNIQUE (lead_id, matched_lead_id, matched_client_id)
);

-- 2. Evolução crm_leads para status de duplicidade rápido (denormalização para performance de UI)
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS duplicate_status TEXT DEFAULT 'no_match',
ADD COLUMN IF NOT EXISTS duplicate_checked_at TIMESTAMPTZ;

-- 3. Índices para busca de identidade e performance de listagem
CREATE INDEX IF NOT EXISTS idx_crm_leads_identity_lookup ON public.crm_leads(office_id, phone, email);
CREATE INDEX IF NOT EXISTS idx_crm_leads_duplicate_status ON public.crm_leads(office_id, duplicate_status) WHERE duplicate_status != 'no_match';
CREATE INDEX IF NOT EXISTS idx_crm_lead_matches_lead_id ON public.crm_lead_matches(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_matches_office_id ON public.crm_lead_matches(office_id);

-- 4. RLS - Segurança Multi-tenant
ALTER TABLE public.crm_lead_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lead matches viewable by office members" ON public.crm_lead_matches
    FOR SELECT USING (
        office_id IN (
            SELECT office_id FROM public.office_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Lead matches manageable by office members" ON public.crm_lead_matches
    FOR ALL USING (
        office_id IN (
            SELECT office_id FROM public.office_members WHERE user_id = auth.uid()
        )
    );

-- 5. Registro em Auditoria (Opcional, mas recomendado se quiser gatilho automático)
COMMENT ON TABLE public.crm_lead_matches IS 'Armazena detecções de duplicidade e relacionamentos entre leads do mesmo escritório.';

COMMIT;
