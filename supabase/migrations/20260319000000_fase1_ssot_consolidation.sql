-- Migration: Fase 1 - Consolidação de Identidade (SSOT)
-- Descrição: Transforma 'clients' na fonte única de verdade biográfica e limpa 'pacientes'.

BEGIN;

-- 1. Garantir que todos os pacientes tenham um client_id
-- Se o paciente não tiver client_id mas tiver CPF que já existe em clients, vincula.
UPDATE public.pacientes p
SET client_id = c.id
FROM public.clients c
WHERE p.client_id IS NULL 
  AND p.cpf IS NOT NULL 
  AND p.cpf = c.cpf 
  AND p.office_id = c.office_id;

-- Para os que sobraram sem client_id, cria um novo client
INSERT INTO public.clients (office_id, full_name, cpf, email, phone, address_line)
SELECT office_id, nome, cpf, email, telefone, endereco
FROM public.pacientes
WHERE client_id IS NULL;

-- Vincula os novos clients criados de volta aos pacientes
UPDATE public.pacientes p
SET client_id = c.id
FROM public.clients c
WHERE p.client_id IS NULL 
  AND p.nome = c.full_name 
  AND p.office_id = c.office_id
  AND c.created_at >= now() - interval '1 minute'; -- Garante que pegamos os recém criados

-- 2. Alterar a tabela pacientes para permitir nulos nos campos redundantes
ALTER TABLE public.pacientes 
  ALTER COLUMN nome DROP NOT NULL,
  ALTER COLUMN cpf DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN telefone DROP NOT NULL,
  ALTER COLUMN endereco DROP NOT NULL;

-- 3. Limpar dados redundantes já consolidados em clients
UPDATE public.pacientes SET 
  nome = NULL,
  cpf = NULL,
  email = NULL,
  telefone = NULL,
  endereco = NULL
WHERE client_id IS NOT NULL;

-- 4. Refatorar Triggers de Sincronia
-- Agora, em vez de sincronizar campos, o trigger de pacientes serve apenas para garantir a existência do client_id se inserido manualmente (compatibilidade)
CREATE OR REPLACE FUNCTION public.sync_pacientes_to_clients()
RETURNS TRIGGER AS $$
DECLARE
    v_client_id uuid;
BEGIN
    -- Se já tem client_id, não faz nada com biometria (SSOT em clients)
    IF NEW.client_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Tenta achar por CPF
    IF NEW.cpf IS NOT NULL THEN
        SELECT id INTO v_client_id FROM public.clients WHERE cpf = NEW.cpf AND office_id = NEW.office_id LIMIT 1;
    END IF;

    -- Se não achou, cria um novo
    IF v_client_id IS NULL THEN
        INSERT INTO public.clients (office_id, full_name, cpf, email, phone, address_line)
        VALUES (NEW.office_id, NEW.nome, NEW.cpf, NEW.email, NEW.telefone, NEW.endereco)
        RETURNING id INTO v_client_id;
    END IF;

    NEW.client_id := v_client_id;
    
    -- Limpa os campos no paciente para manter a tabela limpa (SSOT)
    NEW.nome := NULL;
    NEW.cpf := NULL;
    NEW.email := NULL;
    NEW.telefone := NULL;
    NEW.endereco := NULL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger de Clients não precisa mais atualizar pacientes (View cuidará da leitura)
DROP TRIGGER IF EXISTS tr_sync_clients_to_pacientes ON public.clients;
DROP FUNCTION IF EXISTS public.sync_clients_to_pacientes();

-- 5. Criar VIEW Unificada para listagem (Compatibilidade com UI legado)
CREATE OR REPLACE VIEW public.v_pacientes_unified AS
SELECT 
    p.id as paciente_id,
    c.id as client_id,
    c.office_id,
    COALESCE(p.nome, c.full_name) as nome,
    COALESCE(p.cpf, c.cpf) as cpf,
    COALESCE(p.email, c.email) as email,
    COALESCE(p.telefone, c.phone) as telefone,
    COALESCE(p.endereco, c.address_line) as endereco,
    p.data_nascimento,
    p.sexo,
    p.historico_medico,
    p.alergias,
    p.medicamentos_em_uso,
    p.observacoes,
    p.status,
    p.created_at,
    p.updated_at
FROM public.pacientes p
JOIN public.clients c ON p.client_id = c.id;

-- 6. Adicionar log de auditoria
INSERT INTO audit_logs (action, entity, table_name, details, created_at)
VALUES ('SSOT_IDENTITY_CONSOLIDATION', 'SYSTEM', 'pacientes/clients', '{"message": "Fase 1 concluída: Identidade consolidada em clients. Pacientes agora é extensão puramente clínica."}', now());

COMMIT;
