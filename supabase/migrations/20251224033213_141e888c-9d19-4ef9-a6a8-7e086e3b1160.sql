-- Adicionar campos para dados detectados automaticamente pelo NIJA
ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS comarca TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS lawyer_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS oab_number TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS identified_docs JSONB;

COMMENT ON COLUMN cases.court_name IS 'Vara ou Juízo do processo';
COMMENT ON COLUMN cases.comarca IS 'Comarca ou Foro do processo';
COMMENT ON COLUMN cases.lawyer_name IS 'Nome do advogado responsável';
COMMENT ON COLUMN cases.oab_number IS 'Número OAB do advogado (ex: OAB/SP 123456)';
COMMENT ON COLUMN cases.identified_docs IS 'Lista de documentos identificados pelo dicionário TJTO';