-- Atualiza nacionalidade do cliente Ozires
UPDATE clients 
SET nationality = 'brasileiro'
WHERE id = '5966596e-613c-4b04-8614-f9af727e76a0';

-- Define valor padrão para a coluna nationality
ALTER TABLE clients 
ALTER COLUMN nationality SET DEFAULT 'brasileiro';