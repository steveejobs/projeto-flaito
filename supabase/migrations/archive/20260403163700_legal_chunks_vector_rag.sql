-- =============================================
-- Phase 6.1: RAG Jurídico Avançado
-- Tabela de chunks vetoriais + função RPC
-- =============================================

-- 1. Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Criar tabela legal_chunks
CREATE TABLE IF NOT EXISTS legal_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES legal_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  chunk_text text NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 3. Índice HNSW para busca por similaridade cosine
CREATE INDEX IF NOT EXISTS legal_chunks_embedding_hnsw_idx
  ON legal_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Índice para buscas por document_id
CREATE INDEX IF NOT EXISTS legal_chunks_document_id_idx ON legal_chunks(document_id);

-- 5. RLS
ALTER TABLE legal_chunks ENABLE ROW LEVEL SECURITY;

-- 6. Policy de leitura para usuários autenticados
CREATE POLICY "authenticated_read_legal_chunks"
  ON legal_chunks
  FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- Função RPC para busca vetorial
-- =============================================
CREATE OR REPLACE FUNCTION match_legal_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.70,
  match_count int DEFAULT 8,
  filter_ramo text DEFAULT NULL
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
  FROM legal_chunks lc
  WHERE
    lc.embedding IS NOT NULL
    AND 1 - (lc.embedding <=> query_embedding) > match_threshold
    AND (filter_ramo IS NULL OR lc.metadata->>'ramo' ILIKE '%' || filter_ramo || '%')
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_legal_chunks TO authenticated;
