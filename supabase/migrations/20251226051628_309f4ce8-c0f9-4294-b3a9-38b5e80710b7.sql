-- Enable all disabled sources directly
UPDATE legal_precedent_sources
SET enabled = true, updated_at = now()
WHERE enabled = false;