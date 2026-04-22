-- Atualização da função de busca vetorial para suportar isolamento por vertical e entidade

CREATE OR REPLACE FUNCTION match_knowledge_by_source(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.50,
    match_count int DEFAULT 10,
    filter_office_id uuid DEFAULT NULL,
    source_types text[] DEFAULT ARRAY['system_context', 'private_knowledge'],
    filter_vertical text DEFAULT NULL,
    filter_entity_id uuid DEFAULT NULL
  )
  RETURNS TABLE (
    id uuid,
    chunk_text text,
    similarity float,
    source_type text,
    metadata jsonb
  )
  LANGUAGE plpgsql
  AS $$
  BEGIN
    RETURN QUERY
    SELECT
      lc.id,
      lc.chunk_text,
      1 - (lc.embedding <=> query_embedding) AS similarity,
      COALESCE(lc.metadata->>'source_type', 'system_context') AS source_type,
      lc.metadata
    FROM legal_chunks lc
    WHERE
      1 - (lc.embedding <=> query_embedding) > match_threshold
      AND (
        filter_office_id IS NULL
        OR lc.office_id = filter_office_id
        OR lc.office_id IS NULL
      )
      AND COALESCE(lc.metadata->>'source_type', 'system_context') = ANY(source_types)
      AND (
        filter_vertical IS NULL
        OR lc.metadata->>'vertical' = filter_vertical
        OR lc.metadata->>'vertical' IS NULL
      )
      AND (
        filter_entity_id IS NULL
        OR lc.metadata->>'entity_id' = filter_entity_id::text
        OR lc.metadata->>'entity_id' IS NULL
      )
    ORDER BY similarity DESC
    LIMIT match_count;
  END;
  $$;
