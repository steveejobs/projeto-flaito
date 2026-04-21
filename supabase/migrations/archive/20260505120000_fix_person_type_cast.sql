-- ============================================================
-- Migration: 20260505120000
-- Title: Fix person_type type mismatch between clients (enum) and pacientes (text)
--
-- Reality discovered via audit:
--   clients.person_type  = ENUM public.person_type ('PF','PJ')
--   pacientes.person_type = TEXT
--
-- Fix: Use explicit casts where needed:
--   clients -> pacientes: ENUM to TEXT (implicit, but explicit for clarity)
--   pacientes -> clients: TEXT to ENUM (requires explicit cast)
-- ============================================================

-- [1] Fix clients -> pacientes sync function
-- Direction: clients (ENUM) -> pacientes (TEXT)
-- ENUM -> TEXT cast is implicit in PostgreSQL, so NEW.person_type works directly
CREATE OR REPLACE FUNCTION public.fn_sync_clients_to_pacientes()
RETURNS TRIGGER AS $$
DECLARE
    v_paciente_id uuid;
BEGIN
    IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

    SELECT id INTO v_paciente_id FROM public.pacientes WHERE client_id = NEW.id;

    IF v_paciente_id IS NULL THEN
        INSERT INTO public.pacientes (
            client_id, office_id, nome, cpf, cnpj, email, telefone, endereco,
            person_type, marital_status, profession, source, lgpd_consent
        ) VALUES (
            NEW.id, NEW.office_id, NEW.full_name, NEW.cpf, NEW.cnpj, NEW.email, NEW.phone, NEW.address_line,
            NEW.person_type::text, NEW.marital_status, NEW.profession, NEW.source, NEW.lgpd_consent
        );
    ELSE
        UPDATE public.pacientes
        SET
            nome = NEW.full_name,
            cpf = NEW.cpf,
            cnpj = NEW.cnpj,
            email = NEW.email,
            telefone = NEW.phone,
            endereco = NEW.address_line,
            rg = NEW.rg,
            profession = NEW.profession,
            marital_status = NEW.marital_status,
            person_type = NEW.person_type::text,
            trade_name = NEW.trade_name,
            representative_name = NEW.representative_name,
            representative_cpf = NEW.representative_cpf,
            source = NEW.source,
            lgpd_consent = NEW.lgpd_consent,
            updated_at = NOW()
        WHERE id = v_paciente_id
          AND (
              nome IS DISTINCT FROM NEW.full_name OR
              cpf IS DISTINCT FROM NEW.cpf OR
              person_type IS DISTINCT FROM NEW.person_type::text OR
              endereco IS DISTINCT FROM NEW.address_line
          );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [2] Fix pacientes -> clients sync function
-- Direction: pacientes (TEXT) -> clients (ENUM)
-- TEXT -> ENUM requires explicit cast: NEW.person_type::public.person_type
CREATE OR REPLACE FUNCTION public.fn_sync_pacientes_to_clients()
RETURNS TRIGGER AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

    IF NEW.client_id IS NOT NULL THEN
        UPDATE public.clients
        SET
            full_name = NEW.nome,
            cpf = NEW.cpf,
            cnpj = NEW.cnpj,
            email = NEW.email,
            phone = NEW.telefone,
            address_line = NEW.endereco,
            rg = NEW.rg,
            profession = NEW.profession,
            marital_status = NEW.marital_status,
            person_type = NEW.person_type::public.person_type,
            source = NEW.source,
            lgpd_consent = NEW.lgpd_consent,
            updated_at = NOW()
        WHERE id = NEW.client_id
          AND (
              full_name IS DISTINCT FROM NEW.nome OR
              cpf::text IS DISTINCT FROM NEW.cpf::text OR
              person_type::text IS DISTINCT FROM NEW.person_type OR
              address_line IS DISTINCT FROM NEW.endereco
          );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [3] Ensure triggers are correctly attached (idempotent)
DROP TRIGGER IF EXISTS tr_sync_clients_to_pacientes ON public.clients;
DROP TRIGGER IF EXISTS sync_clients_to_pacientes_trigger ON public.clients;
DROP TRIGGER IF EXISTS sync_clients_to_pacientes ON public.clients;
DROP TRIGGER IF EXISTS trg_sync_clients_to_pacientes ON public.clients;

CREATE TRIGGER trg_sync_clients_to_pacientes
    AFTER INSERT OR UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_clients_to_pacientes();

DROP TRIGGER IF EXISTS tr_sync_pacientes_to_clients ON public.pacientes;
DROP TRIGGER IF EXISTS sync_pacientes_to_clients_trigger ON public.pacientes;
DROP TRIGGER IF EXISTS sync_pacientes_to_clients ON public.pacientes;
DROP TRIGGER IF EXISTS trg_sync_pacientes_to_clients ON public.pacientes;

CREATE TRIGGER trg_sync_pacientes_to_clients
    AFTER INSERT OR UPDATE ON public.pacientes
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_pacientes_to_clients();

-- [4] Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
