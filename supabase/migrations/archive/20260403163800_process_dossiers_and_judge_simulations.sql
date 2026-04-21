-- =============================================
-- Phase 7.1: Dossiê do Processo
-- =============================================

CREATE TABLE IF NOT EXISTS process_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  office_id uuid,
  version integer NOT NULL DEFAULT 1,
  ramo text,
  fase_processual text,
  polo text CHECK (polo IN ('AUTOR','REU','TERCEIRO','INDEFINIDO')),
  grau_risco text CHECK (grau_risco IN ('BAIXO','MEDIO','ALTO')),
  full_analysis jsonb NOT NULL DEFAULT '{}',
  vicios jsonb DEFAULT '[]',
  estrategias jsonb DEFAULT '{}',
  sugestao_peca jsonb DEFAULT '{}',
  provas jsonb DEFAULT '[]',
  resumo_tatico text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE process_dossiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office_isolation_dossiers"
  ON process_dossiers
  FOR ALL
  TO authenticated
  USING (
    office_id IN (
      SELECT office_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS process_dossiers_case_id_idx ON process_dossiers(case_id);
CREATE INDEX IF NOT EXISTS process_dossiers_office_id_idx ON process_dossiers(office_id);

-- trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_process_dossiers_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_process_dossiers_updated_at
  BEFORE UPDATE ON process_dossiers
  FOR EACH ROW EXECUTE FUNCTION update_process_dossiers_updated_at();

-- =============================================
-- Phase 8.1: Simulações do Juiz IA
-- =============================================

CREATE TABLE IF NOT EXISTS judge_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  office_id uuid,
  dossier_id uuid REFERENCES process_dossiers(id) ON DELETE SET NULL,
  probabilidade_exito integer CHECK (probabilidade_exito BETWEEN 0 AND 100),
  faixa text CHECK (faixa IN ('MUITO_BAIXA','BAIXA','MEDIA','ALTA')),
  tipo_decisao_provavel text,
  pontos_fortes jsonb DEFAULT '[]',
  pontos_fracos jsonb DEFAULT '[]',
  lacunas_probatorias jsonb DEFAULT '[]',
  sugestoes_melhoria jsonb DEFAULT '[]',
  fundamentos_provaveis jsonb DEFAULT '[]',
  score_qualidade_peca integer,
  score_componentes jsonb DEFAULT '{}',
  observacao_juiz text,
  alerta_risco text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE judge_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office_isolation_judge_simulations"
  ON judge_simulations
  FOR ALL
  TO authenticated
  USING (
    office_id IN (
      SELECT office_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS judge_simulations_case_id_idx ON judge_simulations(case_id);
CREATE INDEX IF NOT EXISTS judge_simulations_office_id_idx ON judge_simulations(office_id);
