-- Atualizar função hard_delete_client para exclusão definitiva
-- Desabilita triggers temporariamente para permitir DELETE físico

CREATE OR REPLACE FUNCTION public.hard_delete_client(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
    v_office uuid;
    v_file_path text;
BEGIN
    -- office do usuário autenticado
    SELECT office_id INTO v_office
    FROM public.office_members
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF v_office IS NULL THEN
        RAISE EXCEPTION 'Nenhum escritório ativo encontrado';
    END IF;

    -- verifica se o cliente pertence ao office
    IF NOT EXISTS (
        SELECT 1 FROM public.clients
        WHERE id = p_client_id AND office_id = v_office
    ) THEN
        RAISE EXCEPTION 'Cliente não encontrado neste escritório';
    END IF;

    -- Excluir arquivos do storage (client-files bucket)
    FOR v_file_path IN
        SELECT storage_path FROM public.client_files
        WHERE client_id = p_client_id
    LOOP
        BEGIN
            PERFORM storage.delete_object('client-files', v_file_path);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Falha ao excluir arquivo: %', v_file_path;
        END;
    END LOOP;

    -- Excluir client_files
    DELETE FROM public.client_files WHERE client_id = p_client_id;

    -- Excluir client_kit_items
    DELETE FROM public.client_kit_items WHERE client_id = p_client_id;

    -- Excluir client_kit_requirements
    DELETE FROM public.client_kit_requirements WHERE client_id = p_client_id;

    -- Excluir generated_docs do cliente
    DELETE FROM public.generated_docs WHERE client_id = p_client_id;

    -- Excluir documentos do cliente (e suas versões/assinaturas via cascade ou manual)
    DELETE FROM public.document_sign_requests 
    WHERE document_id IN (SELECT id FROM public.documents WHERE client_id = p_client_id);
    
    DELETE FROM public.document_versions 
    WHERE document_id IN (SELECT id FROM public.documents WHERE client_id = p_client_id);
    
    DELETE FROM public.documents WHERE client_id = p_client_id;

    -- Excluir casos e sub-registros
    DELETE FROM public.case_tasks 
    WHERE case_id IN (SELECT id FROM public.cases WHERE client_id = p_client_id);
    
    DELETE FROM public.case_deadlines 
    WHERE case_id IN (SELECT id FROM public.cases WHERE client_id = p_client_id);
    
    DELETE FROM public.case_expenses 
    WHERE case_id IN (SELECT id FROM public.cases WHERE client_id = p_client_id);
    
    DELETE FROM public.case_events 
    WHERE case_id IN (SELECT id FROM public.cases WHERE client_id = p_client_id);
    
    DELETE FROM public.case_event_segments 
    WHERE case_id IN (SELECT id FROM public.cases WHERE client_id = p_client_id);
    
    DELETE FROM public.case_stage_logs 
    WHERE case_id IN (SELECT id FROM public.cases WHERE client_id = p_client_id);
    
    DELETE FROM public.case_status_logs 
    WHERE case_id IN (SELECT id FROM public.cases WHERE client_id = p_client_id);
    
    DELETE FROM public.case_status_transitions 
    WHERE case_id IN (SELECT id FROM public.cases WHERE client_id = p_client_id);
    
    DELETE FROM public.case_permissions 
    WHERE case_id IN (SELECT id FROM public.cases WHERE client_id = p_client_id);
    
    DELETE FROM public.case_cnj_snapshots 
    WHERE case_id IN (SELECT id FROM public.cases WHERE client_id = p_client_id);
    
    DELETE FROM public.cases WHERE client_id = p_client_id;

    -- Excluir agenda_items do cliente
    DELETE FROM public.agenda_items WHERE client_id = p_client_id;

    -- Excluir chat_threads do cliente
    DELETE FROM public.chat_messages 
    WHERE thread_id IN (SELECT id FROM public.chat_threads WHERE client_id = p_client_id);
    
    DELETE FROM public.chat_threads WHERE client_id = p_client_id;

    -- Desabilitar triggers de soft-delete e bloqueio para permitir exclusão física
    ALTER TABLE public.clients DISABLE TRIGGER trg_clients_soft_delete;
    ALTER TABLE public.clients DISABLE TRIGGER trg_block_client_delete_if_cases;

    -- Excluir cliente definitivamente (exclusão física)
    DELETE FROM public.clients WHERE id = p_client_id;

    -- Reabilitar triggers
    ALTER TABLE public.clients ENABLE TRIGGER trg_clients_soft_delete;
    ALTER TABLE public.clients ENABLE TRIGGER trg_block_client_delete_if_cases;
END;
$$;

-- Garantir permissão de execução
GRANT EXECUTE ON FUNCTION public.hard_delete_client(uuid) TO authenticated;