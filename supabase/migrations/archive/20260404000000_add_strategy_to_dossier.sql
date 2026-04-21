-- Migration: 20260404000000_add_strategy_to_dossier.sql
-- Goal: Add strategy storage for NIJA-STRATEGY (9 Stages)

ALTER TABLE public.process_dossiers 
ADD COLUMN IF NOT EXISTS estrategia_juridica jsonb DEFAULT '{}';

COMMENT ON COLUMN public.process_dossiers.estrategia_juridica IS 'Dados estruturados do Motor de Estratégia Jurídica (9 Etapas).';
