-- Migration: Stage 16 — Cost Infrastructure
-- Description: Establishes the foundations for USD-based AI cost tracking and granular budget management.

-- 1. AI Model Pricing
CREATE TABLE IF NOT EXISTS public.ai_model_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT UNIQUE NOT NULL, -- e.g., gpt-4o, gpt-4o-mini, deepgram-nova-2
    provider TEXT NOT NULL, -- 'openai', 'anthropic', 'deepgram'
    input_1k_usd NUMERIC(10, 6) NOT NULL,
    output_1k_usd NUMERIC(10, 6) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. AI Usage Logs (High-fidelity tracking)
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    job_id UUID REFERENCES public.session_jobs(id) ON DELETE SET NULL,
    pipeline_stage TEXT NOT NULL, -- 'transcription', 'ingest', 'snapshot', 'analysis'
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_cost_usd NUMERIC(12, 8) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Update session_jobs with cost and audit fields
ALTER TABLE public.session_jobs 
ADD COLUMN IF NOT EXISTS actual_tokens_input INTEGER,
ADD COLUMN IF NOT EXISTS actual_tokens_output INTEGER,
ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12, 8),
ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12, 8),
ADD COLUMN IF NOT EXISTS decision_taken TEXT, -- 'execute', 'degrade', 'reject'
ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dedup_hit BOOLEAN DEFAULT FALSE;

-- 4. Update office_ai_budgets with weekly caps and anomaly thresholds
ALTER TABLE public.office_ai_budgets
ADD COLUMN IF NOT EXISTS weekly_token_cap INTEGER DEFAULT 500000,
ADD COLUMN IF NOT EXISTS weekly_tokens_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS anomaly_threshold_multiplier NUMERIC(4, 2) DEFAULT 2.0;

-- 5. Indexes for fast financial auditing
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_office_date ON public.ai_usage_logs (office_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_job_id ON public.ai_usage_logs (job_id);

-- 6. Seed Initial Pricing (Approximate values for Wave 1)
INSERT INTO public.ai_model_pricing (model_name, provider, input_1k_usd, output_1k_usd)
VALUES 
    ('gpt-4o', 'openai', 0.005, 0.015),
    ('gpt-4o-mini', 'openai', 0.00015, 0.0006),
    ('claude-3-5-sonnet', 'anthropic', 0.003, 0.015),
    ('deepgram-nova-2', 'deepgram', 0.0043, 0.0)
ON CONFLICT (model_name) DO UPDATE SET
    input_1k_usd = EXCLUDED.input_1k_usd,
    output_1k_usd = EXCLUDED.output_1k_usd,
    updated_at = now();

-- 7. Update existing budgets logic 
UPDATE public.office_ai_budgets SET 
    weekly_token_cap = COALESCE(weekly_token_cap, daily_token_cap * 7),
    anomaly_threshold_multiplier = COALESCE(anomaly_threshold_multiplier, 2.0)
WHERE weekly_token_cap IS NULL;
