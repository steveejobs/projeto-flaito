-- Add file storage fields to generated_docs table
ALTER TABLE public.generated_docs
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS mime_type TEXT;