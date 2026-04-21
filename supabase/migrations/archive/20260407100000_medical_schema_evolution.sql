-- ============================================================
-- EVOLUÇÃO DO SCHEMA: MÓDULO MÉDICO (INCREMENTAL)
-- Data: 2026-04-07
-- ============================================================

-- 1. AGENDA MÉDICA: PREPARAÇÃO PARA GOOGLE CALENDAR
-- Adicionamos campos para rastreamento de sincronização sem quebrar o fluxo atual.

ALTER TABLE public.agenda_medica 
ADD COLUMN IF NOT EXISTS google_event_id TEXT;

ALTER TABLE public.agenda_medica
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed'));

ALTER TABLE public.agenda_medica
ADD COLUMN IF NOT EXISTS sync_last_at TIMESTAMPTZ;

ALTER TABLE public.agenda_medica
ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Constraint de Unicidade Composta
-- Garante que um ID de evento do Google pertença a apenas um agendamento dentro do mesmo escritório (office_id).
-- Usamos DO para evitar erros se a migration for rodada novamente.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'agenda_medica_google_event_id_office_id_key'
    ) THEN
        ALTER TABLE public.agenda_medica 
        ADD CONSTRAINT agenda_medica_google_event_id_office_id_key 
        UNIQUE (office_id, google_event_id);
    END IF;
END $$;

-- 2. IRIDOLOGIA: FLEXIBILIDADE DE DADOS CLÍNICOS
-- Mantemos clinical_data (TEXT) para compatibilidade com o frontend atual.
-- Adicionamos clinical_data_structured (JSONB) para suporte a anamneses complexas.

ALTER TABLE public.iris_analyses
ADD COLUMN IF NOT EXISTS clinical_data_structured JSONB NULL;

-- 3. DOCUMENTAÇÃO DO SCHEMA (COMMENTS)
COMMENT ON COLUMN public.agenda_medica.google_event_id IS 'Identificador único do evento no Google Calendar para integração bidirecional.';
COMMENT ON COLUMN public.agenda_medica.sync_status IS 'Estado da última tentativa de sincronização com o Google Calendar.';
COMMENT ON COLUMN public.iris_analyses.clinical_data_structured IS 'Dados clínicos da anamnese em formato estruturado para suporte a formulários dinâmicos da IA.';

-- 4. POLÍTICAS RLS (VERIFICAÇÃO)
-- Como as novas colunas são adicionadas a tabelas que já possuem RLS habilitado, 
-- elas herdam as permissões existentes via SELECT/UPDATE de office_id.
