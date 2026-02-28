
-- Limpeza definitiva manual dos clientes soft-deleted
-- Executando em cascata para cada cliente

-- 1. Remover registros dependentes de generated_docs
DELETE FROM generated_docs WHERE client_id IN (
  SELECT id FROM clients WHERE deleted_at IS NOT NULL
);

-- 2. Remover client_kit_items
DELETE FROM client_kit_items WHERE client_id IN (
  SELECT id FROM clients WHERE deleted_at IS NOT NULL
);

-- 3. Remover client_kit_requirements
DELETE FROM client_kit_requirements WHERE client_id IN (
  SELECT id FROM clients WHERE deleted_at IS NOT NULL
);

-- 4. Remover agenda_items vinculados aos clientes
DELETE FROM agenda_items WHERE client_id IN (
  SELECT id FROM clients WHERE deleted_at IS NOT NULL
);

-- 5. Remover chat_threads vinculados aos clientes
DELETE FROM chat_threads WHERE client_id IN (
  SELECT id FROM clients WHERE deleted_at IS NOT NULL
);

-- 6. Remover client_files
DELETE FROM client_files WHERE client_id IN (
  SELECT id FROM clients WHERE deleted_at IS NOT NULL
);

-- 7. Remover documentos vinculados aos casos dos clientes
-- 7a. document_sign_requests
DELETE FROM document_sign_requests WHERE document_id IN (
  SELECT d.id FROM documents d
  JOIN cases c ON d.case_id = c.id
  WHERE c.client_id IN (SELECT id FROM clients WHERE deleted_at IS NOT NULL)
);

-- 7b. document_versions
DELETE FROM document_versions WHERE document_id IN (
  SELECT d.id FROM documents d
  JOIN cases c ON d.case_id = c.id
  WHERE c.client_id IN (SELECT id FROM clients WHERE deleted_at IS NOT NULL)
);

-- 7c. documents
DELETE FROM documents WHERE case_id IN (
  SELECT id FROM cases WHERE client_id IN (
    SELECT id FROM clients WHERE deleted_at IS NOT NULL
  )
);

-- 8. Remover casos e seus dependentes
-- 8a. case_event_segments
DELETE FROM case_event_segments WHERE case_id IN (
  SELECT id FROM cases WHERE client_id IN (
    SELECT id FROM clients WHERE deleted_at IS NOT NULL
  )
);

-- 8b. case_events
DELETE FROM case_events WHERE case_id IN (
  SELECT id FROM cases WHERE client_id IN (
    SELECT id FROM clients WHERE deleted_at IS NOT NULL
  )
);

-- 8c. case_deadlines
DELETE FROM case_deadlines WHERE case_id IN (
  SELECT id FROM cases WHERE client_id IN (
    SELECT id FROM clients WHERE deleted_at IS NOT NULL
  )
);

-- 8d. case_expenses
DELETE FROM case_expenses WHERE case_id IN (
  SELECT id FROM cases WHERE client_id IN (
    SELECT id FROM clients WHERE deleted_at IS NOT NULL
  )
);

-- 8e. case_tasks
DELETE FROM case_tasks WHERE case_id IN (
  SELECT id FROM cases WHERE client_id IN (
    SELECT id FROM clients WHERE deleted_at IS NOT NULL
  )
);

-- 8f. case_permissions
DELETE FROM case_permissions WHERE case_id IN (
  SELECT id FROM cases WHERE client_id IN (
    SELECT id FROM clients WHERE deleted_at IS NOT NULL
  )
);

-- 8g. case_stage_logs
DELETE FROM case_stage_logs WHERE case_id IN (
  SELECT id FROM cases WHERE client_id IN (
    SELECT id FROM clients WHERE deleted_at IS NOT NULL
  )
);

-- 8h. case_status_logs
DELETE FROM case_status_logs WHERE case_id IN (
  SELECT id FROM cases WHERE client_id IN (
    SELECT id FROM clients WHERE deleted_at IS NOT NULL
  )
);

-- 8i. case_status_transitions
DELETE FROM case_status_transitions WHERE case_id IN (
  SELECT id FROM cases WHERE client_id IN (
    SELECT id FROM clients WHERE deleted_at IS NOT NULL
  )
);

-- 8j. case_cnj_snapshots
DELETE FROM case_cnj_snapshots WHERE case_id IN (
  SELECT id FROM cases WHERE client_id IN (
    SELECT id FROM clients WHERE deleted_at IS NOT NULL
  )
);

-- 8k. cases
DELETE FROM cases WHERE client_id IN (
  SELECT id FROM clients WHERE deleted_at IS NOT NULL
);

-- 9. Finalmente, remover os clientes
DELETE FROM clients WHERE deleted_at IS NOT NULL;
