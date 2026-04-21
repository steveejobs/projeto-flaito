-- Adicionar coluna para rastrear se os dados foram extraídos por IA
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS ai_extracted boolean DEFAULT false;

COMMENT ON COLUMN clients.ai_extracted IS 'Indica se os dados foram total ou parcialmente preenchidos via extração por IA';