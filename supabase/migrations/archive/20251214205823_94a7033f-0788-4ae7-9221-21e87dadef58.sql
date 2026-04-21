-- Add nija_phase column to cases table
ALTER TABLE public.cases 
ADD COLUMN nija_phase text DEFAULT 'INICIAL';

-- Add check constraint for valid values
ALTER TABLE public.cases 
ADD CONSTRAINT cases_nija_phase_check 
CHECK (nija_phase IN ('INICIAL', 'ANDAMENTO', 'ENCERRAMENTO'));