-- ============================================================
-- Migration: Stage 14 — Shadow Mode Infrastructure
-- File: 20260420110000_stage14_shadow_mode.sql
--
-- Goals:
--  1. shadow_execution_log — captures shadow runs without user exposure
--  2. Shadow paths: legal_ai_generation, medical_ai_generation, ocr_auto_suggest
--  3. Drift trending metrics: 24h, 7d, unacceptable_rate_trend, last_20_sample_quality
--  4. query_shadow_drift() — per-feature drift analysis RPC
--  5. record_shadow_execution() — called by shadow-mode edge functions
-- ============================================================

BEGIN;

-- ============================================================
-- 1. SHADOW EXECUTION LOG
-- Captures every shadow-mode execution with comparison metadata.
-- No user-facing output is derived from these records.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shadow_execution_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Feature being shadowed
  feature_name        TEXT        NOT NULL,   -- 'legal_ai_generation' | 'medical_ai_generation' | 'ocr_auto_suggest'

  -- Context identifiers
  session_id          UUID        REFERENCES public.sessions(id),
  office_id           UUID,
  user_id             UUID        REFERENCES auth.users(id),

  -- Input fingerprint — deterministic hash of input at execution time
  input_hash          TEXT        NOT NULL,

  -- Shadow output — what the shadow path produced (NOT shown to users)
  shadow_output_hash  TEXT,
  shadow_output_size  INTEGER,
  shadow_duration_ms  INTEGER,

  -- Production output — what the current production path produced (if any)
  production_output_hash TEXT,

  -- Divergence analysis
  -- 'match' | 'minor_divergence' | 'major_divergence' | 'unacceptable' | 'error'
  divergence_class    TEXT        NOT NULL DEFAULT 'unknown',
  divergence_detail   JSONB,

  -- Execution result
  shadow_status       TEXT        NOT NULL DEFAULT 'pending',  -- 'pending' | 'completed' | 'error'
  error_detail        TEXT,

  -- Review state — human reviewers classify shadow outputs
  -- 'pending_review' | 'approved' | 'rejected' | 'escalated'
  review_status       TEXT        NOT NULL DEFAULT 'pending_review',
  reviewed_by         UUID        REFERENCES auth.users(id),
  reviewed_at         TIMESTAMPTZ,
  review_notes        TEXT,

  -- Metadata
  execution_context   JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shadow_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shadow_log_service_role_all"
  ON public.shadow_execution_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Operators can read shadow logs for their office only
CREATE POLICY "shadow_log_operator_read"
  ON public.shadow_execution_log FOR SELECT
  USING (
    office_id IN (
      SELECT office_id FROM public.office_members
      WHERE user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND is_active = true
    )
  );

-- Indexes for drift analysis queries (must run < 3s)
CREATE INDEX IF NOT EXISTS idx_shadow_log_feature_time
  ON public.shadow_execution_log(feature_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shadow_log_divergence
  ON public.shadow_execution_log(feature_name, divergence_class, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shadow_log_review
  ON public.shadow_execution_log(review_status, feature_name)
  WHERE review_status = 'pending_review';

CREATE INDEX IF NOT EXISTS idx_shadow_log_office
  ON public.shadow_execution_log(office_id, feature_name, created_at DESC);

-- ============================================================
-- 2. record_shadow_execution() — called by shadow-path workers
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_shadow_execution(
  p_feature_name           TEXT,
  p_session_id             UUID    DEFAULT NULL,
  p_office_id              UUID    DEFAULT NULL,
  p_input_hash             TEXT    DEFAULT NULL,
  p_shadow_output_hash     TEXT    DEFAULT NULL,
  p_shadow_output_size     INTEGER DEFAULT NULL,
  p_shadow_duration_ms     INTEGER DEFAULT NULL,
  p_production_output_hash TEXT    DEFAULT NULL,
  p_divergence_class       TEXT    DEFAULT 'unknown',
  p_divergence_detail      JSONB   DEFAULT NULL,
  p_shadow_status          TEXT    DEFAULT 'completed',
  p_error_detail           TEXT    DEFAULT NULL,
  p_execution_context      JSONB   DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Validate feature_name against registry
  IF p_feature_name NOT IN ('legal_ai_generation', 'medical_ai_generation', 'ocr_auto_suggest') THEN
    RAISE EXCEPTION 'INVALID_SHADOW_FEATURE: %. Valid: legal_ai_generation, medical_ai_generation, ocr_auto_suggest', p_feature_name;
  END IF;

  -- Validate divergence_class
  IF p_divergence_class NOT IN ('match', 'minor_divergence', 'major_divergence', 'unacceptable', 'error', 'unknown') THEN
    RAISE EXCEPTION 'INVALID_DIVERGENCE_CLASS: %', p_divergence_class;
  END IF;

  INSERT INTO public.shadow_execution_log (
    feature_name, session_id, office_id, user_id,
    input_hash, shadow_output_hash, shadow_output_size, shadow_duration_ms,
    production_output_hash, divergence_class, divergence_detail,
    shadow_status, error_detail, execution_context
  ) VALUES (
    p_feature_name, p_session_id, p_office_id, auth.uid(),
    COALESCE(p_input_hash, 'unknown'),
    p_shadow_output_hash, p_shadow_output_size, p_shadow_duration_ms,
    p_production_output_hash, p_divergence_class, p_divergence_detail,
    p_shadow_status, p_error_detail, COALESCE(p_execution_context, '{}')
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_shadow_execution FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_shadow_execution TO service_role;

-- ============================================================
-- 3. query_shadow_drift() — per-feature drift trending (< 3s)
--
-- Returns:
--  - total_executions_24h / 7d
--  - divergence breakdown
--  - divergence_trend_24h / divergence_trend_7d
--  - unacceptable_rate_trend
--  - last_20_sample_quality
-- ============================================================
CREATE OR REPLACE FUNCTION public.query_shadow_drift(
  p_feature_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_24h      RECORD;
  v_7d       RECORD;
  v_last_20  JSONB;
  v_result   JSONB;
BEGIN
  -- Validate
  IF p_feature_name NOT IN ('legal_ai_generation', 'medical_ai_generation', 'ocr_auto_suggest') THEN
    RAISE EXCEPTION 'INVALID_SHADOW_FEATURE: %', p_feature_name;
  END IF;

  -- 24h stats
  SELECT
    COUNT(*)                                                          AS total,
    COUNT(*) FILTER (WHERE divergence_class = 'match')               AS matched,
    COUNT(*) FILTER (WHERE divergence_class = 'minor_divergence')    AS minor_divergence,
    COUNT(*) FILTER (WHERE divergence_class = 'major_divergence')    AS major_divergence,
    COUNT(*) FILTER (WHERE divergence_class = 'unacceptable')        AS unacceptable,
    COUNT(*) FILTER (WHERE divergence_class = 'error')               AS errors,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE divergence_class IN ('major_divergence', 'unacceptable', 'error'))
      / NULLIF(COUNT(*), 0), 2
    )                                                                 AS divergence_rate_24h,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE divergence_class = 'unacceptable')
      / NULLIF(COUNT(*), 0), 2
    )                                                                 AS unacceptable_rate_24h,
    ROUND(AVG(shadow_duration_ms), 0)                                 AS avg_duration_ms_24h
  INTO v_24h
  FROM public.shadow_execution_log
  WHERE feature_name = p_feature_name
    AND created_at   >= now() - INTERVAL '24 hours';

  -- 7d stats
  SELECT
    COUNT(*)                                                          AS total,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE divergence_class IN ('major_divergence', 'unacceptable', 'error'))
      / NULLIF(COUNT(*), 0), 2
    )                                                                 AS divergence_rate_7d,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE divergence_class = 'unacceptable')
      / NULLIF(COUNT(*), 0), 2
    )                                                                 AS unacceptable_rate_7d
  INTO v_7d
  FROM public.shadow_execution_log
  WHERE feature_name = p_feature_name
    AND created_at   >= now() - INTERVAL '7 days';

  -- Last 20 sample quality
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',               id,
      'divergence_class', divergence_class,
      'shadow_status',    shadow_status,
      'review_status',    review_status,
      'duration_ms',      shadow_duration_ms,
      'created_at',       created_at
    ) ORDER BY created_at DESC
  )
  INTO v_last_20
  FROM (
    SELECT id, divergence_class, shadow_status, review_status, shadow_duration_ms, created_at
    FROM public.shadow_execution_log
    WHERE feature_name = p_feature_name
    ORDER BY created_at DESC
    LIMIT 20
  ) sub;

  v_result := jsonb_build_object(
    'feature_name',             p_feature_name,
    'queried_at',               now(),

    -- 24h window
    'total_executions_24h',     COALESCE(v_24h.total, 0),
    'matched_24h',              COALESCE(v_24h.matched, 0),
    'minor_divergence_24h',     COALESCE(v_24h.minor_divergence, 0),
    'major_divergence_24h',     COALESCE(v_24h.major_divergence, 0),
    'unacceptable_24h',         COALESCE(v_24h.unacceptable, 0),
    'errors_24h',               COALESCE(v_24h.errors, 0),
    'divergence_trend_24h',     COALESCE(v_24h.divergence_rate_24h, 0),
    'unacceptable_rate_trend',  COALESCE(v_24h.unacceptable_rate_24h, 0),
    'avg_duration_ms_24h',      COALESCE(v_24h.avg_duration_ms_24h, 0),

    -- 7d window
    'total_executions_7d',      COALESCE(v_7d.total, 0),
    'divergence_trend_7d',      COALESCE(v_7d.divergence_rate_7d, 0),
    'unacceptable_rate_7d',     COALESCE(v_7d.unacceptable_rate_7d, 0),

    -- Sample quality
    'last_20_sample_quality',   COALESCE(v_last_20, '[]'::jsonb),

    -- Assessment thresholds
    'assessment', jsonb_build_object(
      'unacceptable_rate_ok',    COALESCE(v_24h.unacceptable_rate_24h, 0) < 5,
      'divergence_trend_ok',     COALESCE(v_24h.divergence_rate_24h, 0) < 20,
      'sufficient_sample',       COALESCE(v_24h.total, 0) >= 10,
      'overall_ok',              (
        COALESCE(v_24h.unacceptable_rate_24h, 0) < 5
        AND COALESCE(v_24h.divergence_rate_24h, 0) < 20
      )
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.query_shadow_drift(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.query_shadow_drift(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.query_shadow_drift(TEXT) TO authenticated;

-- ============================================================
-- 4. list_pending_shadow_reviews() — operator review queue
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_pending_shadow_reviews(
  p_feature_name TEXT    DEFAULT NULL,
  p_limit        INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',               id,
        'feature_name',     feature_name,
        'session_id',       session_id,
        'office_id',        office_id,
        'divergence_class', divergence_class,
        'divergence_detail', divergence_detail,
        'shadow_status',    shadow_status,
        'shadow_duration_ms', shadow_duration_ms,
        'created_at',       created_at
      ) ORDER BY
        CASE divergence_class
          WHEN 'unacceptable' THEN 1
          WHEN 'major_divergence' THEN 2
          WHEN 'error' THEN 3
          ELSE 4
        END,
        created_at DESC
    )
    FROM (
      SELECT *
      FROM public.shadow_execution_log
      WHERE review_status = 'pending_review'
        AND (p_feature_name IS NULL OR feature_name = p_feature_name)
      ORDER BY
        CASE divergence_class
          WHEN 'unacceptable' THEN 1
          WHEN 'major_divergence' THEN 2
          WHEN 'error' THEN 3
          ELSE 4
        END,
        created_at DESC
      LIMIT p_limit
    ) sub
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_pending_shadow_reviews(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_pending_shadow_reviews(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_pending_shadow_reviews(TEXT, INTEGER) TO authenticated;

-- ============================================================
-- 5. approve_shadow_execution() — record human review decision
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_shadow_execution(
  p_execution_id UUID,
  p_decision     TEXT,  -- 'approved' | 'rejected' | 'escalated'
  p_notes        TEXT   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_decision NOT IN ('approved', 'rejected', 'escalated') THEN
    RAISE EXCEPTION 'INVALID_DECISION: %. Valid: approved, rejected, escalated', p_decision;
  END IF;

  UPDATE public.shadow_execution_log
  SET review_status = p_decision,
      reviewed_by   = auth.uid(),
      reviewed_at   = now(),
      review_notes  = p_notes
  WHERE id = p_execution_id
    AND review_status = 'pending_review';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND_OR_ALREADY_REVIEWED: %', p_execution_id;
  END IF;

  RETURN jsonb_build_object(
    'ok',            true,
    'execution_id',  p_execution_id,
    'decision',      p_decision,
    'reviewed_by',   auth.uid(),
    'reviewed_at',   now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_shadow_execution(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_shadow_execution(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_shadow_execution(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
