-- Corrigir função hard_delete_client para excluir documentos do kit inicial do cliente
CREATE OR REPLACE FUNCTION public.hard_delete_client(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

    -- 1) Excluir documents que apontam para generated_docs do cliente (via metadata->>'generated_doc_id')
    DELETE FROM documents 
    WHERE (metadata->>'generated_doc_id')::uuid IN (
        SELECT id FROM generated_docs WHERE client_id = p_client_id
    );

    -- 2) Excluir generated_docs do cliente (sem case, vinculados diretamente ao client_id)
    DELETE FROM generated_docs WHERE client_id = p_client_id;

    -- 3) Excluir documents vinculados a casos do cliente
    DELETE FROM documents 
    WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);

    -- 4) Excluir generated_docs vinculados a casos do cliente
    DELETE FROM generated_docs 
    WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);

    -- 5) Excluir casos
    DELETE FROM cases WHERE client_id = p_client_id;

    -- 6) Excluir cliente
    DELETE FROM clients WHERE id = p_client_id;
END;
$$;