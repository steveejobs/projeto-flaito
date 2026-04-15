-- Migration: Personalização de RAG por Office
-- Adiciona office_id aos chunks e atualiza função de busca

-- 1. Adicionar coluna office_id na tabela legal_chunks
ALTER TABLE public.legal_chunks ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;

-- 2. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_legal_chunks_office_id ON public.legal_chunks(office_id);

-- 3. Atualizar a função match_legal_chunks para suportar filtro de office_id
CREATE OR REPLACE FUNCTION public.match_legal_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.50, -- Reduzido para maior recall
  match_count int DEFAULT 10,
  filter_ramo text DEFAULT NULL,
  filter_office_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lc.id,
    lc.document_id,
    lc.chunk_text,
    lc.metadata,
    1 - (lc.embedding <=> query_embedding) AS similarity
  FROM public.legal_chunks lc
  WHERE
    lc.embedding IS NOT NULL
    AND 1 - (lc.embedding <=> query_embedding) > match_threshold
    AND (filter_ramo IS NULL OR lc.metadata->>'ramo' ILIKE '%' || filter_ramo || '%')
    -- Filtro de office_id: se for nulo, busca apenas globais (metadata->>'is_global' = 'true')
    -- Se for informado, busca globais OU os do escritório específico
    AND (
      filter_office_id IS NULL 
      OR lc.office_id = filter_office_id 
      OR (lc.metadata->>'is_global')::boolean = true
    )
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
