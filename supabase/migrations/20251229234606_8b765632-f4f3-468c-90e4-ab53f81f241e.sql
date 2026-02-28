
-- Remover clientes que ainda estão soft-deleted
DELETE FROM clients WHERE deleted_at IS NOT NULL;
