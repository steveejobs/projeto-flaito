-- Fase 1: Deletar jobs órfãos do kit_generation_jobs
DELETE FROM kit_generation_jobs 
WHERE client_id NOT IN (SELECT id FROM clients);