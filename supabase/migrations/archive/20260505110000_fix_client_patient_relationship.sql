-- ============================================================
-- Migration: 20260505110000
-- Title: Correção Estrutural Relacionamento CRM-Prontuário (Clients-Pacientes)
-- Version: FINAL_ULTRA_ROBUST (Universal Casting)
-- ============================================================

-- [STEP 1] Garantir coluna client_id e endereco em pacientes
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pacientes' AND column_name='client_id') THEN
        ALTER TABLE public.pacientes ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pacientes' AND column_name='endereco') THEN
        ALTER TABLE public.pacientes ADD COLUMN endereco TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pacientes_client_id ON public.pacientes(client_id);

-- [STEP 2] Funções de Sincronização Bidirecional com Casting Universal
CREATE OR REPLACE FUNCTION public.fn_sync_clients_to_pacientes()
RETURNS TRIGGER AS $$
DECLARE
    v_paciente_id uuid;
BEGIN
    IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

    -- Tentar encontrar o paciente existente
    SELECT id INTO v_paciente_id FROM public.pacientes WHERE client_id = NEW.id;

    IF v_paciente_id IS NULL THEN
        -- Se não existe, criar (INSERT)
        INSERT INTO public.pacientes (
            client_id, office_id, nome, cpf, cnpj, email, telefone, endereco, 
            person_type, marital_status, profession, source, lgpd_consent
        ) VALUES (
            NEW.id, NEW.office_id, NEW.full_name, NEW.cpf, NEW.cnpj, NEW.email, NEW.phone, NEW.address_line,
            (NEW.person_type::text)::public.person_type, NEW.marital_status, NEW.profession, NEW.source, NEW.lgpd_consent
        );
    ELSE
        -- Se existe, atualizar (UPDATE)
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
            person_type = (NEW.person_type::text)::public.person_type,
            trade_name = NEW.trade_name,
            representative_name = NEW.representative_name,
            representative_cpf = NEW.representative_cpf,
            source = NEW.source,
            lgpd_consent = NEW.lgpd_consent,
            updated_at = NOW()
        WHERE id = v_paciente_id
          AND (
              nome IS DISTINCT FROM NEW.full_name OR
              cpf::text IS DISTINCT FROM NEW.cpf::text OR
              person_type::text IS DISTINCT FROM NEW.person_type::text OR
              endereco IS DISTINCT FROM NEW.address_line
          );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_sync_pacientes_to_clients()
RETURNS TRIGGER AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

    -- Sincronizar para Clients (Prontuário -> CRM)
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
            person_type = (NEW.person_type::text)::public.person_type,
            source = NEW.source,
            lgpd_consent = NEW.lgpd_consent,
            updated_at = NOW()
        WHERE id = NEW.client_id
          AND (
              full_name IS DISTINCT FROM NEW.nome OR
              cpf::text IS DISTINCT FROM NEW.cpf::text OR
              person_type::text IS DISTINCT FROM NEW.person_type::text OR
              address_line IS DISTINCT FROM NEW.endereco
          );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [STEP 3] Aplicar Triggers
DROP TRIGGER IF EXISTS trg_sync_clients_to_pacientes ON public.clients;
DROP TRIGGER IF EXISTS sync_clients_to_pacientes_trigger ON public.clients;
DROP TRIGGER IF EXISTS sync_clients_to_pacientes ON public.clients;

CREATE TRIGGER trg_sync_clients_to_pacientes
    AFTER INSERT OR UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_clients_to_pacientes();

DROP TRIGGER IF EXISTS trg_sync_pacientes_to_clients ON public.pacientes;
DROP TRIGGER IF EXISTS sync_pacientes_to_clients_trigger ON public.pacientes;
DROP TRIGGER IF EXISTS sync_pacientes_to_clients ON public.pacientes;

CREATE TRIGGER trg_sync_pacientes_to_clients
    AFTER INSERT OR UPDATE ON public.pacientes
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_pacientes_to_clients();

-- [STEP 4] Backfill
DO $$
BEGIN
    -- Vínculo por CPF
    UPDATE public.pacientes p
    SET client_id = c.id
    FROM public.clients c
    WHERE p.client_id IS NULL 
      AND p.cpf IS NOT NULL AND p.cpf != ''
      AND c.cpf = p.cpf
      AND c.office_id = p.office_id;

    -- Vínculo por CNPJ
    UPDATE public.pacientes p
    SET client_id = c.id
    FROM public.clients c
    WHERE p.client_id IS NULL 
      AND p.cnpj IS NOT NULL AND p.cnpj != ''
      AND c.cnpj = p.cnpj
      AND c.office_id = p.office_id;
END $$;

NOTIFY pgrst, 'reload schema';
