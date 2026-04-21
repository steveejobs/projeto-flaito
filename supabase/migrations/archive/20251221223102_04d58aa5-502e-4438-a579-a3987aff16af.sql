-- MIGRAÇÃO OFICIAL LEXOS — FASE DOCUMENTOS (v1)
-- Adiciona colunas equivalentes se necessário
ALTER TABLE public.generated_documents
ADD COLUMN IF NOT EXISTS client_id uuid,
ADD COLUMN IF NOT EXISTS source_template_id uuid,
ADD COLUMN IF NOT EXISTS file_path text,
ADD COLUMN IF NOT EXISTS mime_type text;