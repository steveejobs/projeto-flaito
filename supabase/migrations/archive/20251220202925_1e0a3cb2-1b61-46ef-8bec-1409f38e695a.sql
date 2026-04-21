-- Add 'code' column to document_templates for kit generation
ALTER TABLE public.document_templates
ADD COLUMN IF NOT EXISTS code TEXT;

-- Create index for faster lookups by code
CREATE INDEX IF NOT EXISTS idx_document_templates_code ON public.document_templates(code);

-- Add comment
COMMENT ON COLUMN public.document_templates.code IS 'Código único do template usado para geração automática de kits (ex: PROC, DECL, CONTRATO)';