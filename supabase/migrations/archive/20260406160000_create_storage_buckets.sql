-- ============================================================
-- Migration: 20260406160000_create_storage_buckets
-- Purpose: Garantir a existência dos buckets de storage necessários
-- ============================================================

-- List of buckets to ensure
-- documents, client-files, signatures, plaud-assets, knowledge-files, nija-pieces, client-kits, case-files

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false),
       ('client-files', 'client-files', false),
       ('signatures', 'signatures', false),
       ('plaud-assets', 'plaud-assets', false),
       ('knowledge-files', 'knowledge-files', false),
       ('nija-pieces', 'nija-pieces', false),
       ('client-kits', 'client-kits', false),
       ('case-files', 'case-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for buckets is usually handled by storage.objects policies, but the buckets themselves must exists.
-- Basic policies can be added if needed, but we keep it simple for now as per the existing pattern.
