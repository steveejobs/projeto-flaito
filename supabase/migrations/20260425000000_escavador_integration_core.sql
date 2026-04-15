-- =============================================
-- Migration: Escavador Integration Core
-- Version: 20260425000000
-- =============================================

BEGIN;

-- 1. Create Status Enum for Escavador
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escavador_status') THEN
        CREATE TYPE public.escavador_status AS ENUM (
            'PENDING', 
            'PROCESSING', 
            'COMPLETED', 
            'FAILED', 
            'TIMEOUT', 
            'DUPLICATE'
        );
    END IF;
END $$;

-- 2. Search Requests Table (Cache & Audit)
CREATE TABLE IF NOT EXISTS public.escavador_search_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id           UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    requested_by        UUID REFERENCES auth.users(id),
    numero_processo     TEXT NOT NULL, -- Formatado/Normalizado CNJ
    tipo_busca          TEXT NOT NULL, -- 'PROCESSO', 'OAB', 'ENVOLVIDO'
    status              public.escavador_status NOT NULL DEFAULT 'PENDING',
    external_id         TEXT,          -- ID do Escavador (search_id)
    correlation_id      UUID NOT NULL, -- Gerado na Edge Function
    cost                INTEGER DEFAULT 0,
    error_code          TEXT,
    ttl_expires_at      TIMESTAMPTZ,   -- Quando o cache expira
    case_id             UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    client_id           UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- 3. Search Results Table (JSON Storage)
CREATE TABLE IF NOT EXISTS public.escavador_search_results (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id          UUID NOT NULL REFERENCES public.escavador_search_requests(id) ON DELETE CASCADE,
    payload_response    JSONB NOT NULL,
    source              TEXT NOT NULL CHECK (source IN ('SYNC', 'CALLBACK', 'CACHE')),
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- 4. Monitorings Table
CREATE TABLE IF NOT EXISTS public.escavador_monitorings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id           UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    numero_processo     TEXT NOT NULL,
    external_id         TEXT UNIQUE, -- ID do monitoramento no Escavador
    is_active           BOOLEAN DEFAULT true,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- 5. Webhook Events Table (Persistence-First)
CREATE TABLE IF NOT EXISTS public.escavador_webhook_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id         TEXT, -- search_id ou monitoring_id do Escavador
    payload_bruto       JSONB NOT NULL,
    processed_at        TIMESTAMPTZ,
    signature_verified  BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- RLS POLICIES
ALTER TABLE public.escavador_search_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escavador_search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escavador_monitorings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escavador_webhook_events ENABLE ROW LEVEL SECURITY;

-- Office-bound Isolation
CREATE POLICY "office_isolation_escavador_requests"
    ON public.escavador_search_requests FOR ALL
    USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "office_isolation_escavador_results"
    ON public.escavador_search_results FOR SELECT
    USING (request_id IN (SELECT id FROM public.escavador_search_requests WHERE office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)));

CREATE POLICY "office_isolation_escavador_monitorings"
    ON public.escavador_monitorings FOR ALL
    USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true));

-- Webhook events are restricted to service_role for processing
CREATE POLICY "service_role_all_webhook_events"
    ON public.escavador_webhook_events FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_escavador_requests_cnj ON public.escavador_search_requests(numero_processo);
CREATE INDEX IF NOT EXISTS idx_escavador_requests_status ON public.escavador_search_requests(status);
CREATE INDEX IF NOT EXISTS idx_escavador_requests_ttl ON public.escavador_search_requests(ttl_expires_at);
CREATE INDEX IF NOT EXISTS idx_escavador_webhook_ext_id ON public.escavador_webhook_events(external_id);

-- Updated at triggers
CREATE OR REPLACE FUNCTION public.update_escavador_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_update_escavador_requests_updated_at
    BEFORE UPDATE ON public.escavador_search_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_escavador_updated_at();

CREATE TRIGGER tg_update_escavador_monitorings_updated_at
    BEFORE UPDATE ON public.escavador_monitorings
    FOR EACH ROW EXECUTE FUNCTION public.update_escavador_updated_at();

COMMIT;
