-- Função para Title Case com preposições brasileiras
CREATE OR REPLACE FUNCTION public.title_case_br(input TEXT)
RETURNS TEXT AS $$
DECLARE
  words TEXT[];
  result TEXT := '';
  word TEXT;
  i INT := 1;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  words := string_to_array(LOWER(TRIM(input)), ' ');
  FOREACH word IN ARRAY words LOOP
    IF word = '' THEN CONTINUE; END IF;
    IF i > 1 AND word IN ('de', 'da', 'do', 'das', 'dos', 'e', 'di') THEN
      result := result || ' ' || word;
    ELSE
      result := result || ' ' || INITCAP(word);
    END IF;
    i := i + 1;
  END LOOP;
  RETURN TRIM(result);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Marcar clientes com nomes em MAIÚSCULO como ai_extracted = true
UPDATE public.clients 
SET ai_extracted = true 
WHERE full_name = UPPER(full_name) 
  AND full_name IS NOT NULL
  AND LENGTH(TRIM(full_name)) > 0;

-- Aplicar Title Case aos nomes existentes
UPDATE public.clients 
SET full_name = public.title_case_br(full_name)
WHERE full_name IS NOT NULL;