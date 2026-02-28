-- Remove a constraint UNIQUE para permitir múltiplos arquivos por tipo por cliente
ALTER TABLE client_files 
DROP CONSTRAINT IF EXISTS uq_client_files_client_kind;