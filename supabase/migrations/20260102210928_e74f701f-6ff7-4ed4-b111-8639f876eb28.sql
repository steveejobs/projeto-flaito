-- =============================================================================
-- ADD: Missing values to client_file_kind ENUM
-- =============================================================================

ALTER TYPE public.client_file_kind ADD VALUE IF NOT EXISTS 'ASSINATURA';
ALTER TYPE public.client_file_kind ADD VALUE IF NOT EXISTS 'COMPROVANTE_RENDA';