-- =====================================================
-- LIMPEZA DE ÓRFÃOS - DESABILITANDO TRIGGER ESPECÍFICO
-- =====================================================

-- 1. Desabilitar trigger de versionamento temporariamente
ALTER TABLE documents DISABLE TRIGGER trg_documents_versions;

-- 2. Deletar document_versions que referenciam documentos do bucket lexos
DELETE FROM document_versions 
WHERE document_id IN (
  SELECT id FROM documents 
  WHERE storage_bucket = 'lexos'
);

-- 3. Deletar documentos do bucket 'lexos' inexistente
DELETE FROM documents 
WHERE storage_bucket = 'lexos';

-- 4. Reabilitar trigger
ALTER TABLE documents ENABLE TRIGGER trg_documents_versions;

-- 5. Soft-delete documentos NIJA temporários com mais de 30 dias sem case_id
UPDATE documents 
SET deleted_at = NOW(), 
    deleted_reason = 'nija_expired_30d'
WHERE case_id IS NULL 
  AND client_id IS NULL
  AND storage_bucket = 'documents'
  AND metadata->>'source' = 'NIJA_EXTRACTION'
  AND uploaded_at < NOW() - INTERVAL '30 days'
  AND deleted_at IS NULL;

-- 6. Desativar membros fantasma (sem nome)
UPDATE office_members 
SET is_active = false 
WHERE is_active = true 
  AND (full_name IS NULL OR full_name = '' OR TRIM(full_name) = '');

-- 7. Criar função de limpeza automática de órfãos
CREATE OR REPLACE FUNCTION lexos_cleanup_orphan_documents()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Soft-delete documentos NIJA temporários > 7 dias sem case_id
  WITH orphans AS (
    UPDATE documents 
    SET deleted_at = NOW(), 
        deleted_reason = 'auto_cleanup_nija_temp'
    WHERE case_id IS NULL 
      AND client_id IS NULL
      AND storage_bucket = 'documents'
      AND metadata->>'source' = 'NIJA_EXTRACTION'
      AND (metadata->>'is_temporary')::boolean = true
      AND uploaded_at < NOW() - INTERVAL '7 days'
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM orphans;
  
  RETURN deleted_count;
END;
$$;

-- 8. Agendar job de limpeza diário às 3h (se pg_cron disponível)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup_orphan_docs_daily',
      '0 3 * * *',
      'SELECT lexos_cleanup_orphan_documents()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron não disponível, job não agendado';
END;
$$;