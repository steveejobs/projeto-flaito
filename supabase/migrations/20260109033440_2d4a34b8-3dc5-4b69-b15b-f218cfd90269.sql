-- =============================================
-- OMNI-SÊNIOR: plaud_senior_analysis table
-- Decisão estratégica jurídica (AGIR/REGISTRAR/SILENCIAR)
-- =============================================

-- 1) TABELA plaud_senior_analysis (1:1 com plaud_assets)
CREATE TABLE IF NOT EXISTS plaud_senior_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plaud_asset_id uuid UNIQUE NOT NULL REFERENCES plaud_assets(id) ON DELETE CASCADE,
  office_id uuid NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  
  -- Decisão estratégica core
  decisao_estrategica text NOT NULL CHECK (decisao_estrategica IN ('AGIR', 'REGISTRAR', 'SILENCIAR')),
  status_juridico text NOT NULL DEFAULT 'ANALISADO' CHECK (status_juridico IN ('PENDENTE', 'ANALISADO', 'ARQUIVADO')),
  
  -- Campos derivados da análise
  risco_preclusao text CHECK (risco_preclusao IN ('NENHUM', 'BAIXO', 'MEDIO', 'ALTO', 'CRITICO')),
  tipo_ato text,
  fase_processual text,
  fato_central text,
  consequencia_juridica text,
  fundamento_legal text,
  
  -- Detalhes da decisão
  peca_sugerida text,
  justificativa_silencio text,
  
  -- Checklist (blindado como array)
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(checklist) = 'array'),
  
  -- Metadados
  model_version text DEFAULT 'omni-senior-v1',
  tokens_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Vínculo futuro opcional (preparado, não ativo no MVP)
  case_id uuid REFERENCES cases(id) ON DELETE SET NULL,
  
  -- BLINDAGEM: Consistência de decisão AGIR
  CONSTRAINT chk_agir_peca CHECK (
    (decisao_estrategica = 'AGIR' AND peca_sugerida IS NOT NULL AND justificativa_silencio IS NULL) OR
    (decisao_estrategica != 'AGIR')
  ),
  -- BLINDAGEM: Consistência de decisão SILENCIAR
  CONSTRAINT chk_silenciar_justificativa CHECK (
    (decisao_estrategica = 'SILENCIAR' AND justificativa_silencio IS NOT NULL AND peca_sugerida IS NULL) OR
    (decisao_estrategica != 'SILENCIAR')
  )
);

-- 2) ÍNDICES (idempotentes)
CREATE INDEX IF NOT EXISTS idx_psa_office ON plaud_senior_analysis(office_id);
CREATE INDEX IF NOT EXISTS idx_psa_asset ON plaud_senior_analysis(plaud_asset_id);
CREATE INDEX IF NOT EXISTS idx_psa_decisao ON plaud_senior_analysis(decisao_estrategica);

-- 3) TRIGGER multi-tenant (blindagem de mismatch office_id)
CREATE OR REPLACE FUNCTION check_psa_office_id_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.office_id != (SELECT office_id FROM plaud_assets WHERE id = NEW.plaud_asset_id) THEN
    RAISE EXCEPTION 'office_id mismatch: plaud_senior_analysis.office_id must match plaud_assets.office_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_psa_office_id_match ON plaud_senior_analysis;
CREATE TRIGGER trg_psa_office_id_match
  BEFORE INSERT OR UPDATE ON plaud_senior_analysis
  FOR EACH ROW EXECUTE FUNCTION check_psa_office_id_match();

-- 4) TRIGGER updated_at (idempotente)
DROP TRIGGER IF EXISTS trg_psa_updated_at ON plaud_senior_analysis;
CREATE TRIGGER trg_psa_updated_at
  BEFORE UPDATE ON plaud_senior_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5) RLS estrito
ALTER TABLE plaud_senior_analysis ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: apenas membros ativos do escritório
DROP POLICY IF EXISTS psa_select_office ON plaud_senior_analysis;
CREATE POLICY psa_select_office ON plaud_senior_analysis
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM office_members m
      WHERE m.office_id = plaud_senior_analysis.office_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

-- Policy ALL: apenas service_role (para o worker)
DROP POLICY IF EXISTS psa_service_all ON plaud_senior_analysis;
CREATE POLICY psa_service_all ON plaud_senior_analysis
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);