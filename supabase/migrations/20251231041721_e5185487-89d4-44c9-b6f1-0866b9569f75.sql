-- Adiciona campo source para identificar origem do cadastro
ALTER TABLE clients ADD COLUMN IF NOT EXISTS source text DEFAULT 'internal';
-- Valores: 'internal' (cadastro interno), 'public_capture' (formulário público)

-- Adiciona campo display_id para código visível (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'display_id') THEN
    ALTER TABLE clients ADD COLUMN display_id text;
  END IF;
END $$;

-- Cria índice para busca rápida por display_id
CREATE INDEX IF NOT EXISTS idx_clients_display_id ON clients(display_id);
CREATE INDEX IF NOT EXISTS idx_clients_source ON clients(source);

-- Função para gerar display_id sequencial por escritório
CREATE OR REPLACE FUNCTION generate_client_display_id()
RETURNS TRIGGER AS $$
DECLARE
  prefix text;
  next_seq int;
BEGIN
  -- Se já tem display_id, não altera
  IF NEW.display_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Define prefixo baseado no tipo de pessoa e origem
  IF NEW.source = 'public_capture' THEN
    prefix := CASE WHEN NEW.person_type = 'PF' THEN 'CAP-' ELSE 'CEP-' END;
  ELSE
    prefix := CASE WHEN NEW.person_type = 'PF' THEN 'CLI-' ELSE 'EMP-' END;
  END IF;
  
  -- Conta clientes existentes do mesmo prefixo no escritório
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(display_id FROM 5) AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM clients 
  WHERE office_id = NEW.office_id 
    AND display_id LIKE prefix || '%';
  
  NEW.display_id := prefix || LPAD(next_seq::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar display_id automaticamente
DROP TRIGGER IF EXISTS trg_set_client_display_id ON clients;
CREATE TRIGGER trg_set_client_display_id
  BEFORE INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION generate_client_display_id();

-- Atualiza clientes existentes com display_id retroativo
WITH numbered AS (
  SELECT id, person_type, office_id,
    ROW_NUMBER() OVER (PARTITION BY office_id, person_type ORDER BY created_at) as seq
  FROM clients
  WHERE display_id IS NULL
)
UPDATE clients SET 
  display_id = CASE 
    WHEN clients.person_type = 'PF' THEN 'CLI-' || LPAD(numbered.seq::text, 4, '0')
    ELSE 'EMP-' || LPAD(numbered.seq::text, 4, '0')
  END,
  source = COALESCE(clients.source, 'internal')
FROM numbered
WHERE clients.id = numbered.id;