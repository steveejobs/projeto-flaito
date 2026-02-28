-- Remove funções anteriores
DROP FUNCTION IF EXISTS delete_client(uuid);
DROP FUNCTION IF EXISTS hard_delete_client(uuid);

-- Função completa de exclusão definitiva
CREATE OR REPLACE FUNCTION hard_delete_client(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_office uuid;
BEGIN
    -- office do usuário autenticado
    SELECT office_id INTO v_office
    FROM office_members
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF v_office IS NULL THEN
        RAISE EXCEPTION 'Nenhum escritório ativo encontrado';
    END IF;

    -- verifica se o cliente pertence ao office
    IF NOT EXISTS (
        SELECT 1 FROM clients
        WHERE id = p_client_id AND office_id = v_office
    ) THEN
        RAISE EXCEPTION 'Cliente não encontrado neste escritório';
    END IF;

    -- Excluir documentos gerados (via case_id)
    DELETE FROM generated_docs 
    WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);

    -- Excluir documentos (via case_id)
    DELETE FROM documents 
    WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);

    -- Excluir casos
    DELETE FROM cases WHERE client_id = p_client_id;

    -- Excluir cliente
    DELETE FROM clients WHERE id = p_client_id;
END;
$$;

-- Alias
CREATE OR REPLACE FUNCTION delete_client(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM hard_delete_client(p_client_id);
END;
$$;

GRANT EXECUTE ON FUNCTION hard_delete_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_client(uuid) TO authenticated;