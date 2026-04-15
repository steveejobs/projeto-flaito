-- Migration: Unify Central Registry (RCP)
-- Link pacientes to clients table

-- 1. Add client_id column to pacientes
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id);

-- 2. Link existing patients to clients and create missing clients
DO $$
DECLARE
    r RECORD;
    new_client_id UUID;
BEGIN
    FOR r IN SELECT * FROM public.pacientes WHERE client_id IS NULL LOOP
        -- Attempt to find existing client by CPF or Name in the same office
        IF r.cpf IS NOT NULL AND r.cpf <> '' THEN
            SELECT id INTO new_client_id FROM public.clients 
            WHERE cpf = r.cpf AND office_id = r.office_id 
            LIMIT 1;
        ELSE
            SELECT id INTO new_client_id FROM public.clients 
            WHERE full_name = r.nome AND office_id = r.office_id 
            LIMIT 1;
        END IF;

        IF new_client_id IS NOT NULL THEN
             UPDATE public.pacientes SET client_id = new_client_id WHERE id = r.id;
        ELSE
             -- Create new client record if not found
             INSERT INTO public.clients (
                 office_id, 
                 full_name, 
                 cpf, 
                 email, 
                 phone, 
                 address_line, 
                 created_at,
                 updated_at
             )
             VALUES (
                 r.office_id, 
                 r.nome, 
                 r.cpf, 
                 r.email, 
                 r.telefone, 
                 r.endereco, 
                 r.created_at,
                 r.updated_at
             )
             RETURNING id INTO new_client_id;
             
             UPDATE public.pacientes SET client_id = new_client_id WHERE id = r.id;
        END IF;
    END LOOP;
END $$;

-- 3. Add constraint and index
-- ALTER TABLE public.pacientes ALTER COLUMN client_id SET NOT NULL; -- Optional based on strictness
CREATE INDEX IF NOT EXISTS idx_pacientes_client_id ON public.pacientes(client_id);

-- 4. Set up audit logs for the unificiation (optional but recommended)
INSERT INTO audit_logs (action, entity, table_name, details, created_at)
VALUES ('RCP_UNIFICATION', 'SYSTEM', 'pacientes', '{"message": "Linked all patients to clients table and established RCP structure."}', now());
