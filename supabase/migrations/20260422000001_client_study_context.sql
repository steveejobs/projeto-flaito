-- ============================================================
-- Client Study Context — structured strategy/context per client
-- Part 1 of Athena contextual client operation upgrade
-- ============================================================

CREATE TABLE IF NOT EXISTS client_study_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,

  -- Structured fields
  case_summary TEXT,
  current_objective TEXT,
  office_strategy TEXT,
  sensitive_facts TEXT,
  opposing_counsel_profile TEXT,
  judge_profile TEXT,
  procedural_posture TEXT,
  communication_recommendations TEXT,
  risk_notes TEXT,
  internal_observations TEXT,
  vertical_notes TEXT,
  vertical_type TEXT DEFAULT 'legal' CHECK (vertical_type IN ('legal', 'medical')),
  attachments_metadata JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  UNIQUE(client_id, office_id)
);

ALTER TABLE client_study_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage study context for their office"
  ON client_study_context
  FOR ALL
  USING (office_id IN (SELECT office_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (office_id IN (SELECT office_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX idx_csc_client ON client_study_context(client_id);
CREATE INDEX idx_csc_office ON client_study_context(office_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_client_study_context_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_client_study_context_updated_at
  BEFORE UPDATE ON client_study_context
  FOR EACH ROW
  EXECUTE FUNCTION update_client_study_context_updated_at();
