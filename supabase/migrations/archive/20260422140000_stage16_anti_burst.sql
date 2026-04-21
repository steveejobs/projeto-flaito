-- Migration: Stage 16 — Temporal Rate Limiting
-- Description: Implements precise tokens-per-minute (TPM) enforcement to prevent burst costs and API rate limiting issues.

-- 1. Extend scaling config with TPM limits
ALTER TABLE public.system_scaling_config
ADD COLUMN IF NOT EXISTS default_max_tpm INTEGER DEFAULT 100000;

UPDATE public.system_scaling_config SET default_max_tpm = 100000 WHERE id = 'global_config';

-- 2. TPM Check Function
CREATE OR REPLACE FUNCTION public.check_token_rate_limit(
    p_office_id UUID,
    p_estimated_tokens INTEGER
)
RETURNS TABLE (
    allowed BOOLEAN,
    current_tpm INTEGER,
    limit_tpm INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recent_tokens INTEGER;
    v_limit_tpm INTEGER;
BEGIN
    -- 1. Get limit from config
    SELECT default_max_tpm INTO v_limit_tpm
    FROM public.system_scaling_config
    WHERE id = 'global_config';

    -- 2. Count tokens in last 60s for this office
    SELECT COALESCE(SUM(input_tokens + output_tokens), 0)
    INTO v_recent_tokens
    FROM public.ai_usage_logs
    WHERE office_id = p_office_id
      AND created_at > (now() - interval '1 minute');

    IF v_recent_tokens + p_estimated_tokens > v_limit_tpm THEN
        RETURN QUERY SELECT FALSE, v_recent_tokens, v_limit_tpm;
    ELSE
        RETURN QUERY SELECT TRUE, v_recent_tokens, v_limit_tpm;
    END IF;
END;
$$;
