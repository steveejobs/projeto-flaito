-- Add document_id column to generated_docs to link with public.documents
ALTER TABLE public.generated_docs
ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_generated_docs_document_id ON public.generated_docs(document_id);