-- 1. Add normalized_phone to pacientes
ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS normalized_phone text;

-- 2. Add normalized_phone to clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS normalized_phone text;

-- 3. Create a function to normalize digits (removing non-digits, stripping '55' if it's country code)
CREATE OR REPLACE FUNCTION normalize_phone_number(phone text)
RETURNS text AS $$
DECLARE
  cleaned text;
BEGIN
  IF phone IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove everything except digits
  cleaned := regexp_replace(phone, '\D', '', 'g');
  
  IF length(cleaned) = 0 THEN
    RETURN NULL;
  END IF;
  
  -- If starts with 55 and length 12 or 13, remove 55
  IF starts_with(cleaned, '55') AND length(cleaned) >= 12 THEN
    cleaned := substring(cleaned from 3);
  END IF;
  
  RETURN cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Update existing records
UPDATE public.pacientes 
SET normalized_phone = normalize_phone_number(telefone)
WHERE telefone IS NOT NULL AND normalized_phone IS NULL;

UPDATE public.clients 
SET normalized_phone = normalize_phone_number(phone)
WHERE phone IS NOT NULL AND normalized_phone IS NULL;

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_pacientes_normalized_phone ON public.pacientes(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_clients_normalized_phone ON public.clients(normalized_phone);

-- 6. Create trigger to auto-update normalized_phone on insert/update
CREATE OR REPLACE FUNCTION trg_normalize_phone_pacientes()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.telefone IS DISTINCT FROM OLD.telefone OR NEW.normalized_phone IS NULL THEN
    NEW.normalized_phone := normalize_phone_number(NEW.telefone);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pacientes_normalize_phone ON public.pacientes;
CREATE TRIGGER trg_pacientes_normalize_phone
BEFORE INSERT OR UPDATE ON public.pacientes
FOR EACH ROW EXECUTE FUNCTION trg_normalize_phone_pacientes();

CREATE OR REPLACE FUNCTION trg_normalize_phone_clients()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone OR NEW.normalized_phone IS NULL THEN
    NEW.normalized_phone := normalize_phone_number(NEW.phone);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clients_normalize_phone ON public.clients;
CREATE TRIGGER trg_clients_normalize_phone
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION trg_normalize_phone_clients();
