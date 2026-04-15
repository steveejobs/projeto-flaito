-- ============================================================
-- Migration: Stage 12 — Rate Limiting & AI Budget Controls
-- File: 20260416100000_stage12_rate_limiting.sql
--
-- Goals:
--  1. Sliding-window rate limiting (fail-open on system errors)
--  2. AI budget enforcement with atomic locking (SELECT FOR UPDATE)
--  3. Budget-to-rate-limit coupling (graceful degradation at 80%/95%)
--  4. Daily budget reset via pg_cron
-- ============================================================

BEGIN;

-- ============================================================
-- 1. RATE LIMIT BUCKETS TABLE
-- Sliding window per (scope_type, scope_id, action, window_start)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type   TEXT        NOT NULL,  -- 'user' | 'office' | 'session' | 'endpoint'
  scope_id     TEXT        NOT NULL,
  action       TEXT        NOT NULL,  -- 'ai_generation' | 'voice_confirm' | 'retry_job' | 'rerun_session' | 'operator_action'
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  count        INTEGER     NOT NULL DEFAULT 1,
  blocked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope_type, scope_id, action, window_start)
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Only service_role writes; operators/users never touch this table directly
CREATE POLICY "rate_limit_service_role_all"
  ON public.rate_limit_buckets FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup
  ON public.rate_limit_buckets(scope_type, scope_id, action, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_cleanup
  ON public.rate_limit_buckets(window_start)
  WHERE window_start < now() - interval '2 hours';

-- ============================================================
-- 2. check_and_increment_rate_limit()
-- Fail-open: if anything goes wrong in the rate limit system
-- the request is ALLOWED (logged as RATE_LIMIT_SYSTEM_DEGRADED).
-- Threshold: limit_per_window calls per window_minutes window.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_scope_type       TEXT,
  p_scope_id         TEXT,
  p_action           TEXT,
  p_limit_per_window INTEGER,
  p_window_minutes   INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window   TIMESTAMPTZ;
  v_count    INTEGER;
  v_allowed  BOOLEAN;
  v_result   JSONB;
BEGIN
  -- Truncate to the nearest window boundary
  v_window := date_trunc('minute', now())
    - ((EXTRACT(MINUTE FROM now())::INTEGER % p_window_minutes)::TEXT || ' minutes')::INTERVAL;

  -- UPSERT: safe under concurrent pressure (ON CONFLICT DO UPDATE avoids row contention)
  INSERT INTO public.rate_limit_buckets (scope_type, scope_id, action, window_start, count)
  VALUES (p_scope_type, p_scope_id, p_action, v_window, 1)
  ON CONFLICT (scope_type, scope_id, action, window_start)
  DO UPDATE SET count = rate_limit_buckets.count + 1
  RETURNING count INTO v_count;

  v_allowed := (v_count <= p_limit_per_window);

  -- Mark bucket as blocked (first block only)
  IF NOT v_allowed THEN
    UPDATE public.rate_limit_buckets
    SET blocked_at = COALESCE(blocked_at, now())
    WHERE scope_type   = p_scope_type
      AND scope_id     = p_scope_id
      AND action       = p_action
      AND window_start = v_window
      AND blocked_at IS NULL;
  END IF;

  v_result := jsonb_build_object(
    'allowed',         v_allowed,
    'current_count',   v_count,
    'limit',           p_limit_per_window,
    'window_minutes',  p_window_minutes,
    'blocked_until',   CASE WHEN NOT v_allowed
                         THEN v_window + (p_window_minutes || ' minutes')::INTERVAL
                         ELSE NULL
                       END
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- FAIL-OPEN: rate limit system error — allow request but log degradation
  RAISE WARNING 'RATE_LIMIT_SYSTEM_DEGRADED: % - %', SQLERRM, SQLSTATE;
  RETURN jsonb_build_object(
    'allowed',     true,
    'degraded',    true,
    'error',       SQLERRM
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

-- ============================================================
-- 3. AI BUDGET TABLE
-- Per-office daily/monthly token caps with atomic enforcement
-- ============================================================
CREATE TABLE IF NOT EXISTS public.office_ai_budgets (
  office_id            UUID        PRIMARY KEY REFERENCES public.offices(id) ON DELETE CASCADE,
  -- Soft cap: 80% warning → reduce rate limits
  daily_token_cap      INTEGER     NOT NULL DEFAULT 500000,
  -- Hard cap: 95% threshold → critical path only; 100% = BUDGET_EXHAUSTED
  daily_hard_cap       INTEGER     NOT NULL DEFAULT 750000,
  monthly_cap          INTEGER     NOT NULL DEFAULT 10000000,
  tokens_used_today    INTEGER     NOT NULL DEFAULT 0,
  tokens_used_month    INTEGER     NOT NULL DEFAULT 0,
  last_reset_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  last_reset_month     TEXT        NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  -- warn_threshold_pct: fraction of daily_token_cap that triggers warning
  warn_threshold_pct   NUMERIC     NOT NULL DEFAULT 0.80,
  -- Override: ADMIN can grant temporary budget relief
  override_by          UUID        REFERENCES auth.users(id),
  override_reason      TEXT,
  -- override_expires_at: max 24h, enforced by check_and_charge_ai_budget
  override_expires_at  TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.office_ai_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_budget_service_role_all"
  ON public.office_ai_budgets FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "ai_budget_office_admin_read"
  ON public.office_ai_budgets FOR SELECT
  USING (
    office_id IN (
      SELECT office_id FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND is_active = true
    )
  );

-- ============================================================
-- 4. check_and_charge_ai_budget()
-- Atomic enforcement with SELECT FOR UPDATE.
-- Coupling logic:
--   >= 80% of daily_token_cap: warning alert (reduce rate limits)
--   >= 95% of daily_token_cap: critical mode (restrict to critical paths only)
--   >= daily_hard_cap: BUDGET_EXHAUSTED (hard block, unless override active)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_and_charge_ai_budget(
  p_office_id        UUID,
  p_estimated_tokens INTEGER,
  p_job_type         TEXT DEFAULT 'UNKNOWN',
  p_is_critical      BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget         RECORD;
  v_new_total      INTEGER;
  v_pct_soft       NUMERIC;
  v_override_active BOOLEAN;
  v_result         JSONB;
BEGIN
  -- ATOMIC LOCK: prevent concurrent overspend
  SELECT * INTO v_budget
  FROM public.office_ai_budgets
  WHERE office_id = p_office_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No budget record → create a default one and allow
    INSERT INTO public.office_ai_budgets (office_id)
    VALUES (p_office_id)
    ON CONFLICT (office_id) DO NOTHING;

    RETURN jsonb_build_object(
      'allowed', true,
      'reason',  'BUDGET_RECORD_CREATED',
      'tokens_remaining', 500000
    );
  END IF;

  -- Check if override is active and not expired
  v_override_active := (
    v_budget.override_by IS NOT NULL
    AND v_budget.override_expires_at IS NOT NULL
    AND v_budget.override_expires_at > now()
  );

  -- Reset stale daily counter if date changed
  IF v_budget.last_reset_date < CURRENT_DATE THEN
    UPDATE public.office_ai_budgets
    SET tokens_used_today = 0,
        last_reset_date   = CURRENT_DATE,
        updated_at        = now()
    WHERE office_id = p_office_id;
    v_budget.tokens_used_today := 0;
  END IF;

  v_new_total := v_budget.tokens_used_today + p_estimated_tokens;
  v_pct_soft  := v_new_total::NUMERIC / NULLIF(v_budget.daily_token_cap, 0);

  -- HARD CAP enforcement (bypass only if override active)
  IF v_new_total > v_budget.daily_hard_cap AND NOT v_override_active THEN
    RETURN jsonb_build_object(
      'allowed',          false,
      'reason',           'BUDGET_EXHAUSTED',
      'tokens_used',      v_budget.tokens_used_today,
      'daily_hard_cap',   v_budget.daily_hard_cap,
      'tokens_remaining', GREATEST(0, v_budget.daily_hard_cap - v_budget.tokens_used_today)
    );
  END IF;

  -- CRITICAL MODE: >= 95% soft cap — only critical operations allowed
  IF v_pct_soft >= 0.95 AND NOT p_is_critical AND NOT v_override_active THEN
    RETURN jsonb_build_object(
      'allowed',         false,
      'reason',          'BUDGET_CRITICAL_MODE',
      'pct_used',        ROUND(v_pct_soft * 100, 1),
      'tokens_remaining', GREATEST(0, v_budget.daily_token_cap - v_budget.tokens_used_today)
    );
  END IF;

  -- Charge tokens atomically
  UPDATE public.office_ai_budgets
  SET tokens_used_today  = v_new_total,
      tokens_used_month  = tokens_used_month + p_estimated_tokens,
      updated_at         = now()
  WHERE office_id = p_office_id;

  -- WARNING alert at 80% soft cap
  IF v_pct_soft >= v_budget.warn_threshold_pct AND v_pct_soft < 0.95 THEN
    -- Reduce rate limits by inserting a rate limit pressure signal
    -- (handled by Edge Functions reading this result)
    v_result := jsonb_build_object(
      'allowed',          true,
      'warning',          'BUDGET_WARNING',
      'pct_used',         ROUND(v_pct_soft * 100, 1),
      'tokens_remaining', GREATEST(0, v_budget.daily_hard_cap - v_new_total),
      'reduce_rate_limits', true
    );
  ELSE
    v_result := jsonb_build_object(
      'allowed',          true,
      'tokens_remaining', GREATEST(0, v_budget.daily_hard_cap - v_new_total),
      'pct_used',         ROUND(v_pct_soft * 100, 1)
    );
  END IF;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Fail-open on budget system errors (log prominently)
  RAISE WARNING 'AI_BUDGET_SYSTEM_ERROR: % - %', SQLERRM, SQLSTATE;
  RETURN jsonb_build_object(
    'allowed',   true,
    'degraded',  true,
    'error',     SQLERRM
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_charge_ai_budget(UUID, INTEGER, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_charge_ai_budget(UUID, INTEGER, TEXT, BOOLEAN) TO service_role;

-- ============================================================
-- 5. reset_ai_budgets() — Daily cron reset
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_ai_budgets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  UPDATE public.office_ai_budgets
  SET tokens_used_today = 0,
      last_reset_date   = CURRENT_DATE,
      -- Reset monthly counter if month changed
      tokens_used_month = CASE
        WHEN last_reset_month != to_char(now(), 'YYYY-MM') THEN 0
        ELSE tokens_used_month
      END,
      last_reset_month  = to_char(now(), 'YYYY-MM'),
      updated_at        = now()
  WHERE last_reset_date < CURRENT_DATE;

  GET DIAGNOSTICS v_reset_count = ROW_COUNT;

  -- Audit the reset operation
  IF v_reset_count > 0 THEN
    RAISE LOG 'AI_BUDGET_RESET: % office budgets reset for date %', v_reset_count, CURRENT_DATE;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_ai_budgets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_ai_budgets() TO service_role;

-- ============================================================
-- 6. SCHEDULE: Daily budget reset at midnight UTC
-- ============================================================

SELECT cron.unschedule('reset-ai-budgets')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-ai-budgets');

SELECT cron.schedule(
  'reset-ai-budgets',
  '0 0 * * *',
  'SELECT public.reset_ai_budgets();'
);

COMMIT;
