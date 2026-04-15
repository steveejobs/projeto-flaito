-- Migration: Extend audit_logs for billing and general action logging
-- Created: 2026-04-06
-- Purpose: The existing audit_logs table was designed for entity snapshots (templates, configs).
--   Billing actions need a simpler action-based log format. This migration adds columns
--   to support both patterns without breaking existing data.

-- 1. Make entity_type and entity_id nullable (not all actions relate to a specific entity)
ALTER TABLE public.audit_logs
    ALTER COLUMN entity_type DROP NOT NULL,
    ALTER COLUMN entity_id DROP NOT NULL;

-- 2. Add columns for action-based logging
ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS status TEXT,
    ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS trace_id TEXT;

-- 3. Index for action-based queries
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_status ON public.audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_trace ON public.audit_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);

COMMENT ON COLUMN public.audit_logs.user_id IS 'User who performed the action (for action-based logs)';
COMMENT ON COLUMN public.audit_logs.status IS 'Outcome: SUCCESS, DENIED, ERROR';
COMMENT ON COLUMN public.audit_logs.details IS 'Arbitrary JSON payload for action context';
COMMENT ON COLUMN public.audit_logs.trace_id IS 'Correlation ID for request tracing';
