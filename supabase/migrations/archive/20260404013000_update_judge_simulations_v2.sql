-- =============================================
-- Phase 13.1: Juiz IA V2 (9 Estágios)
-- =============================================

-- Adicionar novas colunas para o motor V2
ALTER TABLE judge_simulations 
ADD COLUMN IF NOT EXISTS relatorio_detalhado jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS riscos_processuais jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS versao_motor text DEFAULT 'V2';

-- Comentários para documentação
COMMENT ON COLUMN judge_simulations.relatorio_detalhado IS 'Armazena a análise completa das 9 etapas do Juiz IA V2';
COMMENT ON COLUMN judge_simulations.riscos_processuais IS 'Lista estruturada de riscos identificados na Etapa 7';
COMMENT ON COLUMN judge_simulations.versao_motor IS 'Versão do motor de simulação utilizado (V1 ou V2)';
