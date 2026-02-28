-- Adicionar coluna source para identificar origem do precedente (manual, curated, AI)
ALTER TABLE public.legal_precedents
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';