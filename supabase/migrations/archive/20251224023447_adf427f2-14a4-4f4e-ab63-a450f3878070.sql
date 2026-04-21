-- NIJA Fase 1: Leitura Confiável - Adicionar colunas de controle de extração
-- Migração idempotente (usa IF NOT EXISTS / safe checks)

-- 1. Adicionar colunas de controle de extração na tabela documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reading_status text DEFAULT 'PENDING';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS extraction_report jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS extracted_text_chars int DEFAULT 0;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS extracted_pages_total int DEFAULT 0;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS extracted_pages_with_text int DEFAULT 0;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS extracted_coverage_ratio numeric DEFAULT 0;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS extraction_method text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS extraction_updated_at timestamptz;

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_documents_reading_status ON public.documents(reading_status);
CREATE INDEX IF NOT EXISTS idx_documents_extraction_updated_at ON public.documents(extraction_updated_at);

-- 3. Backfill: atualizar documentos existentes com extracted_text >= 1500 chars para status OK
UPDATE public.documents 
SET 
  reading_status = 'OK',
  extracted_text_chars = COALESCE(length(extracted_text), 0),
  extraction_method = 'legacy',
  extraction_updated_at = now()
WHERE extracted_text IS NOT NULL 
  AND length(extracted_text) >= 1500
  AND (reading_status IS NULL OR reading_status = 'PENDING');

-- 4. Backfill: marcar documentos com texto insuficiente (<1500 chars)
UPDATE public.documents 
SET 
  reading_status = 'INSUFFICIENT_READING',
  extracted_text_chars = COALESCE(length(extracted_text), 0),
  extraction_method = 'legacy',
  extraction_updated_at = now()
WHERE extracted_text IS NOT NULL 
  AND length(extracted_text) > 0
  AND length(extracted_text) < 1500
  AND (reading_status IS NULL OR reading_status = 'PENDING');

-- 5. Documentos sem texto extraído permanecem como PENDING