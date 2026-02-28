-- Corrigir telefone de Gabriel (formatado)
UPDATE clients 
SET phone = '(63) 99999-9999'
WHERE display_id = 'CAP-0001';

-- Marcar como ai_extracted já que veio de captação com documento
UPDATE clients 
SET ai_extracted = true 
WHERE display_id = 'CAP-0001';