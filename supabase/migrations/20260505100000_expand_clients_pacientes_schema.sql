-- Migration: Expand Clients and Pacientes Schema
-- Date: 2026-05-05

BEGIN;

-- 1. Helper Function: Clean Document (CPF/CNPJ)
CREATE OR REPLACE FUNCTION public.normalize_document(doc TEXT)
RETURNS TEXT AS $$
BEGIN
    IF doc IS NULL THEN
        RETURN NULL;
    END IF;
    -- Remove non-digits
    RETURN regexp_replace(doc, '\D', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Expand 'public.clients' Table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS person_type TEXT DEFAULT 'PF';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS rg TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS rg_issuer TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS profession TEXT;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS trade_name TEXT;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS representative_name TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS representative_cpf TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS representative_rg TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS representative_rg_issuer TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS representative_nationality TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS representative_marital_status TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS representative_profession TEXT;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ai_extracted BOOLEAN DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lgpd_consent BOOLEAN DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lgpd_consent_at TIMESTAMPTZ;

-- Address reconciliation (ensuring basics exist)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_line TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS state TEXT;

-- 3. Expand 'public.pacientes' Table (for sync parity)
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS person_type TEXT DEFAULT 'PF';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS rg TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS rg_issuer TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS profession TEXT;

ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS trade_name TEXT;

ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS representative_name TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS representative_cpf TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS representative_rg TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS representative_rg_issuer TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS representative_nationality TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS representative_marital_status TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS representative_profession TEXT;

ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS ai_extracted BOOLEAN DEFAULT false;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS lgpd_consent BOOLEAN DEFAULT false;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS lgpd_consent_at TIMESTAMPTZ;

ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 4. Unique Constraints (Partial Indexes for same office)
-- CPF Unique per office
DROP INDEX IF EXISTS idx_clients_unique_cpf_per_office;
CREATE UNIQUE INDEX idx_clients_unique_cpf_per_office 
ON public.clients (office_id, public.normalize_document(cpf)) 
WHERE cpf IS NOT NULL AND cpf != '' AND deleted_at IS NULL;

-- CNPJ Unique per office
DROP INDEX IF EXISTS idx_clients_unique_cnpj_per_office;
CREATE UNIQUE INDEX idx_clients_unique_cnpj_per_office 
ON public.clients (office_id, public.normalize_document(cnpj)) 
WHERE cnpj IS NOT NULL AND cnpj != '' AND deleted_at IS NULL;

-- 5. Unified Sync Triggers (Refactored for loop protection)

-- FUNCTION: Clients -> Pacientes
CREATE OR REPLACE FUNCTION public.sync_clients_to_pacientes()
RETURNS TRIGGER AS $$
BEGIN
    -- Protection against infinite loop
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- Only sync if actually changed
    IF (TG_OP = 'UPDATE') THEN
        UPDATE public.pacientes
        SET 
            nome = NEW.full_name,
            cpf = NEW.cpf,
            email = NEW.email,
            telefone = NEW.phone,
            endereco = NEW.address_line,
            person_type = NEW.person_type,
            rg = NEW.rg,
            rg_issuer = NEW.rg_issuer,
            nationality = NEW.nationality,
            marital_status = NEW.marital_status,
            profession = NEW.profession,
            cnpj = NEW.cnpj,
            trade_name = NEW.trade_name,
            representative_name = NEW.representative_name,
            representative_cpf = NEW.representative_cpf,
            representative_rg = NEW.representative_rg,
            representative_rg_issuer = NEW.representative_rg_issuer,
            representative_nationality = NEW.representative_nationality,
            representative_marital_status = NEW.representative_marital_status,
            representative_profession = NEW.representative_profession,
            source = NEW.source,
            ai_extracted = NEW.ai_extracted,
            lgpd_consent = NEW.lgpd_consent,
            lgpd_consent_at = NEW.lgpd_consent_at,
            updated_at = now()
        WHERE client_id = NEW.id
          AND (
            nome IS DISTINCT FROM NEW.full_name OR
            cpf IS DISTINCT FROM NEW.cpf OR
            email IS DISTINCT FROM NEW.email OR
            telefone IS DISTINCT FROM NEW.phone OR
            endereco IS DISTINCT FROM NEW.address_line OR
            person_type IS DISTINCT FROM NEW.person_type OR
            cnpj IS DISTINCT FROM NEW.cnpj
          );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCTION: Pacientes -> Clients
CREATE OR REPLACE FUNCTION public.sync_pacientes_to_clients()
RETURNS TRIGGER AS $$
BEGIN
    -- Protection against infinite loop
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.client_id IS NOT NULL THEN
        UPDATE public.clients
        SET 
            full_name = NEW.nome,
            cpf = NEW.cpf,
            email = NEW.email,
            phone = NEW.telefone,
            address_line = NEW.endereco,
            person_type = NEW.person_type,
            rg = NEW.rg,
            rg_issuer = NEW.rg_issuer,
            nationality = NEW.nationality,
            marital_status = NEW.marital_status,
            profession = NEW.profession,
            cnpj = NEW.cnpj,
            trade_name = NEW.trade_name,
            representative_name = NEW.representative_name,
            representative_cpf = NEW.representative_cpf,
            representative_rg = NEW.representative_rg,
            representative_rg_issuer = NEW.representative_rg_issuer,
            representative_nationality = NEW.representative_nationality,
            representative_marital_status = NEW.representative_marital_status,
            representative_profession = NEW.representative_profession,
            source = NEW.source,
            ai_extracted = NEW.ai_extracted,
            lgpd_consent = NEW.lgpd_consent,
            lgpd_consent_at = NEW.lgpd_consent_at,
            updated_at = now()
        WHERE id = NEW.client_id
          AND (
            full_name IS DISTINCT FROM NEW.nome OR
            cpf IS DISTINCT FROM NEW.cpf OR
            email IS DISTINCT FROM NEW.email OR
            phone IS DISTINCT FROM NEW.telefone OR
            address_line IS DISTINCT FROM NEW.endereco OR
            person_type IS DISTINCT FROM NEW.person_type OR
            cnpj IS DISTINCT FROM NEW.cnpj
          );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach Triggers
DROP TRIGGER IF EXISTS tr_sync_clients_to_pacientes ON public.clients;
CREATE TRIGGER tr_sync_clients_to_pacientes
AFTER UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.sync_clients_to_pacientes();

DROP TRIGGER IF EXISTS tr_sync_pacientes_to_clients ON public.pacientes;
CREATE TRIGGER tr_sync_pacientes_to_clients
AFTER UPDATE ON public.pacientes
FOR EACH ROW EXECUTE FUNCTION public.sync_pacientes_to_clients();

COMMIT;
