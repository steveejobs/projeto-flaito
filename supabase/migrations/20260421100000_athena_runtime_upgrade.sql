-- ============================================================
-- Athena AI Runtime Architecture Upgrade
-- Phase 1: Extend ai_agent_configs with runtime fields
-- Phase 2: Knowledge files + agent bindings
-- Phase 5: Audit trail
-- ============================================================

-- ── Phase 1: Extend ai_agent_configs ────────────────────────

ALTER TABLE ai_agent_configs ADD COLUMN IF NOT EXISTS reasoning_mode text DEFAULT 'standard'
  CHECK (reasoning_mode IN ('fast', 'standard', 'deep', 'maximum'));

ALTER TABLE ai_agent_configs ADD COLUMN IF NOT EXISTS use_system_context boolean DEFAULT true;
ALTER TABLE ai_agent_configs ADD COLUMN IF NOT EXISTS use_private_knowledge boolean DEFAULT true;
ALTER TABLE ai_agent_configs ADD COLUMN IF NOT EXISTS use_web_knowledge boolean DEFAULT false;
ALTER TABLE ai_agent_configs ADD COLUMN IF NOT EXISTS guardrails jsonb DEFAULT '{}';
ALTER TABLE ai_agent_configs ADD COLUMN IF NOT EXISTS test_mode boolean DEFAULT false;

-- ── Phase 2: Knowledge files table ──────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  original_filename text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt', 'html', 'epub', 'md')),
  file_size_bytes bigint,
  storage_path text NOT NULL,
  canonical_markdown text,
  ingestion_status text DEFAULT 'pending'
    CHECK (ingestion_status IN ('pending', 'extracting', 'converting', 'chunking', 'ready', 'error')),
  ingestion_error text,
  metadata jsonb DEFAULT '{}',
  version integer DEFAULT 1,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_files_office_isolation" ON knowledge_files
  FOR ALL USING (
    office_id IN (SELECT office_id FROM profiles WHERE id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_knowledge_files_office ON knowledge_files(office_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_status ON knowledge_files(ingestion_status);

-- ── Phase 2: Agent knowledge bindings ───────────────────────

CREATE TABLE IF NOT EXISTS agent_knowledge_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_config_id uuid NOT NULL REFERENCES ai_agent_configs(id) ON DELETE CASCADE,
  knowledge_file_id uuid NOT NULL REFERENCES knowledge_files(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_config_id, knowledge_file_id)
);

ALTER TABLE agent_knowledge_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_knowledge_bindings_office_isolation" ON agent_knowledge_bindings
  FOR ALL USING (
    knowledge_file_id IN (
      SELECT id FROM knowledge_files
      WHERE office_id IN (SELECT office_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ── Phase 3: Source-aware knowledge search ──────────────────

CREATE OR REPLACE FUNCTION match_knowledge_by_source(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.50,
  match_count int DEFAULT 10,
  filter_office_id uuid DEFAULT NULL,
  source_types text[] DEFAULT ARRAY['system_context', 'private_knowledge']
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
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- ── Phase 5: Knowledge audit log ────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('upload', 'extract', 'chunk', 'bind', 'unbind', 'delete', 'error')),
  knowledge_file_id uuid REFERENCES knowledge_files(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id),
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_audit_log_office_isolation" ON knowledge_audit_log
  FOR SELECT USING (
    office_id IN (SELECT office_id FROM profiles WHERE id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_knowledge_audit_office ON knowledge_audit_log(office_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_audit_file ON knowledge_audit_log(knowledge_file_id);
