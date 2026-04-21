-- Limpeza definitiva de documentos duplicados NIJA (soft-deleted)
-- Desabilitar triggers problemáticos temporariamente

-- Desabilitar trigger de versionamento
ALTER TABLE documents DISABLE TRIGGER trg_documents_versions;

-- Passo 1: Remover versões de documento vinculadas
DELETE FROM document_versions 
WHERE document_id IN (
  '7ae8e6bd-51ae-44da-a178-ac37850b2961',
  '50b2442b-b280-4da3-80d5-e482621f207e',
  '06892f6b-a591-44ff-a643-dad1655cb2df'
);

-- Passo 2: Remover documentos soft-deleted (duplicatas NIJA)
DELETE FROM documents 
WHERE id IN (
  '7ae8e6bd-51ae-44da-a178-ac37850b2961',
  '50b2442b-b280-4da3-80d5-e482621f207e',
  '06892f6b-a591-44ff-a643-dad1655cb2df'
);

-- Reabilitar trigger de versionamento
ALTER TABLE documents ENABLE TRIGGER trg_documents_versions;