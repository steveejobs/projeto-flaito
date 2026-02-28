-- Limpeza de documentos CLIENT_KIT órfãos (clientes deletados)
-- Desabilitar trigger de versionamento temporariamente
ALTER TABLE documents DISABLE TRIGGER trg_documents_versions;

-- Passo 1: Remover versões de documento vinculadas aos documentos órfãos
DELETE FROM document_versions 
WHERE document_id IN (
  SELECT id FROM documents 
  WHERE deleted_at IS NULL 
    AND metadata->>'scope' = 'CLIENT_KIT'
    AND NOT EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id::text = documents.metadata->>'client_id' 
        AND c.deleted_at IS NULL
    )
);

-- Passo 2: Remover documentos CLIENT_KIT órfãos (sem cliente ativo)
DELETE FROM documents 
WHERE deleted_at IS NULL 
  AND metadata->>'scope' = 'CLIENT_KIT'
  AND NOT EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id::text = documents.metadata->>'client_id' 
      AND c.deleted_at IS NULL
  );

-- Reabilitar trigger de versionamento
ALTER TABLE documents ENABLE TRIGGER trg_documents_versions;