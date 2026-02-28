-- Corrigir FK de generated_docs.source_template_id
-- Atualmente aponta para 'templates' (não existe), deve apontar para 'document_templates'

-- 1. Remover a FK antiga
ALTER TABLE public.generated_docs 
DROP CONSTRAINT IF EXISTS generated_docs_source_template_id_fkey;

-- 2. Criar a FK correta apontando para document_templates
ALTER TABLE public.generated_docs 
ADD CONSTRAINT generated_docs_source_template_id_fkey 
FOREIGN KEY (source_template_id) 
REFERENCES public.document_templates(id) 
ON DELETE SET NULL;