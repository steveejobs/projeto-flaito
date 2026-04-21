-- Add internal_id column to cases table
ALTER TABLE public.cases 
ADD COLUMN internal_id text UNIQUE;

-- Create function to generate internal ID
CREATE OR REPLACE FUNCTION public.generate_case_internal_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id text;
  year_str text;
  seq_num integer;
BEGIN
  year_str := to_char(NOW(), 'YYYY');
  
  -- Get next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(NULLIF(SPLIT_PART(SPLIT_PART(internal_id, '-', 3), '-', 1), '') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM public.cases
  WHERE internal_id LIKE 'LEX-' || year_str || '-%';
  
  new_id := 'LEX-' || year_str || '-' || LPAD(seq_num::text, 6, '0');
  NEW.internal_id := new_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate internal_id
CREATE TRIGGER generate_case_internal_id_trigger
BEFORE INSERT ON public.cases
FOR EACH ROW
WHEN (NEW.internal_id IS NULL)
EXECUTE FUNCTION public.generate_case_internal_id();

-- Create index for internal_id lookups
CREATE INDEX idx_cases_internal_id ON public.cases(internal_id);

-- Add case_status_type column for new status options
-- (Pré-processual, Administrativo, Judicializado/Distribuído)
-- We'll use the existing status column but add new values