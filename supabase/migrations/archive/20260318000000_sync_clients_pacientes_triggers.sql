-- Migration: Sincronização Bidirecional entre Clients e Pacientes
-- Garante que mudanças no Cadastro Único reflitam no Prontuário Clínico e vice-versa.

-- 1. Função de sincronização Clients -> Pacientes
CREATE OR REPLACE FUNCTION public.sync_clients_to_pacientes()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.pacientes
    SET 
        nome = NEW.full_name,
        cpf = NEW.cpf,
        email = NEW.email,
        telefone = NEW.phone,
        endereco = NEW.address_line,
        updated_at = now()
    WHERE client_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Função de sincronização Pacientes -> Clients
CREATE OR REPLACE FUNCTION public.sync_pacientes_to_clients()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.client_id IS NOT NULL THEN
        UPDATE public.clients
        SET 
            full_name = NEW.nome,
            cpf = NEW.cpf,
            email = NEW.email,
            phone = NEW.telefone,
            address_line = NEW.endereco,
            updated_at = now()
        WHERE id = NEW.client_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Triggers
DROP TRIGGER IF EXISTS tr_sync_clients_to_pacientes ON public.clients;
CREATE TRIGGER tr_sync_clients_to_pacientes
AFTER UPDATE OF full_name, cpf, email, phone, address_line ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.sync_clients_to_pacientes();

DROP TRIGGER IF EXISTS tr_sync_pacientes_to_clients ON public.pacientes;
CREATE TRIGGER tr_sync_pacientes_to_clients
AFTER UPDATE OF nome, cpf, email, telefone, endereco ON public.pacientes
FOR EACH ROW EXECUTE FUNCTION public.sync_pacientes_to_clients();

-- 4. Log de Auditoria
INSERT INTO audit_logs (action, entity, table_name, details, created_at)
VALUES ('SETUP_SYNC_TRIGGERS', 'SYSTEM', 'multiple', '{"message": "Bidirectional sync triggers established between clients and pacientes."}', now());
