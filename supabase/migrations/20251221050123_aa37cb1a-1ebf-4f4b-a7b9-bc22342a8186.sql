
-- Update hard_delete_client to also delete client_files
CREATE OR REPLACE FUNCTION public.hard_delete_client(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_office uuid;
    v_file_path text;
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

    -- 0) Excluir arquivos do storage (client_files bucket)
    FOR v_file_path IN 
        SELECT storage_path FROM client_files WHERE client_id = p_client_id
    LOOP
        DELETE FROM storage.objects 
        WHERE bucket_id = 'client-files' AND name = v_file_path;
    END LOOP;

    -- 1) Excluir registros de client_files
    DELETE FROM client_files WHERE client_id = p_client_id;

    -- 2) Excluir documents que apontam para generated_docs do cliente (via metadata->>'generated_doc_id')
    DELETE FROM documents 
    WHERE (metadata->>'generated_doc_id')::uuid IN (
        SELECT id FROM generated_docs WHERE client_id = p_client_id
    );

    -- 3) Excluir generated_docs do cliente (sem case, vinculados diretamente ao client_id)
    DELETE FROM generated_docs WHERE client_id = p_client_id;

    -- 4) Excluir documents vinculados a casos do cliente
    DELETE FROM documents 
    WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);

    -- 5) Excluir generated_docs vinculados a casos do cliente
    DELETE FROM generated_docs 
    WHERE case_id IN (SELECT id FROM cases WHERE client_id = p_client_id);

    -- 6) Excluir casos
    DELETE FROM cases WHERE client_id = p_client_id;

    -- 7) Excluir cliente
    DELETE FROM clients WHERE id = p_client_id;
END;
$$;
