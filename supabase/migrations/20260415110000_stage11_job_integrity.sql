-- ============================================================
-- Migration: Stage 11 — Job Execution Integrity
-- File: 20260415110000_stage11_job_integrity.sql
--
-- Goals:
--  1. Heartbeat / lease renewal infrastructure
--  2. Safe reclaim with side-effect awareness
--  3. Zombie job prevention (heartbeat_lost state)
--  4. Stage-aware idempotency support
--  5. Chain failure compensation (compensating state)
--  6. Non-retryable failure classification
--  7. Stuck session detection & persistent alerting
--  8. FSM extension for recovery paths
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ENUM EXTENSIONS
-- ============================================================

-- Job lifecycle states
DO $$ BEGIN
  ALTER TYPE public.session_job_status ADD VALUE IF NOT EXISTS 'heartbeat_lost';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.session_job_status ADD VALUE IF NOT EXISTS 'compensated';
EXCEPTION WHEN others THEN NULL; END $$;

-- Session recovery states
DO $$ BEGIN
  ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'compensating';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'dead_lettered';
EXCEPTION WHEN others THEN NULL; END $$;

-- ============================================================
-- 2. EXTEND session_jobs TABLE
-- ============================================================

ALTER TABLE public.session_jobs
  ADD COLUMN IF NOT EXISTS last_heartbeat_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_interval_s   INTEGER  NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS lease_duration_s       INTEGER  NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS side_effect_confirmed  BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS compensation_reason    TEXT,
  ADD COLUMN IF NOT EXISTS reclaim_attempts       INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_duration_ms  BIGINT,
  ADD COLUMN IF NOT EXISTS token_estimate         INTEGER;

-- ============================================================
-- 3. PERSISTENT HEALTH ALERTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.session_health_alerts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  office_id      UUID        NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  -- Alert type: stuck_session | zombie_job | repeated_failure | chain_drift | dead_lettered
  alert_type     TEXT        NOT NULL,
  -- Severity: warning | critical
  severity       TEXT        NOT NULL DEFAULT 'warning',
  detail         JSONB,
  resolved_at    TIMESTAMPTZ,
  resolved_by    UUID        REFERENCES auth.users(id),
  resolution_note TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.session_health_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to health alerts"
  ON public.session_health_alerts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Operators can view alerts for their office"
  ON public.session_health_alerts FOR SELECT
  USING (
    office_id IN (
      SELECT om.office_id FROM public.office_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('OWNER', 'ADMIN') AND om.is_active = true
    )
  );

-- ============================================================
-- 4. JOB FAILURE CLASSIFICATION TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.job_failure_classifications (
  error_pattern   TEXT    PRIMARY KEY,
  is_retryable    BOOLEAN NOT NULL,
  -- failure_class: transient | permanent | cross_tenant | stale_context | domain_gate
  failure_class   TEXT    NOT NULL,
  description     TEXT
);

INSERT INTO public.job_failure_classifications (error_pattern, is_retryable, failure_class, description) VALUES
  ('CROSS_TENANT_VIOLATION',         false, 'cross_tenant',  'Job belongs to different tenant — never retry'),
  ('SNAPSHOT_NOT_FOUND',             false, 'stale_context', 'Snapshot was deleted or never created — reprocess required'),
  ('REQUIRED_CONTEXT_MISSING',       false, 'stale_context', 'Transcription or context missing — reprocess required'),
  ('PROHIBITED_GENERATION',          false, 'domain_gate',   'Insufficient documentary background — domain gate rejected'),
  ('PROHIBITED_STALE_CERTIFICATION', false, 'stale_context', 'Session snapshot evolved — re-certification required'),
  ('INTEGRITY_MISMATCH',             false, 'stale_context', 'Content hash changed since analysis — reprocess required'),
  ('CHUNKS_NOT_FOUND',               false, 'permanent',     'Recording chunks missing — session data lost'),
  ('INVALID_FSM_TRANSITION',         false, 'permanent',     'FSM rejected transition — state machine violation'),
  ('SESSION_NOT_FOUND',              false, 'permanent',     'Session does not exist — fatal'),
  ('ACCESS_DENIED',                  false, 'cross_tenant',  'Caller does not own session — security violation'),
  ('WORKER_SECURITY_ERROR',          false, 'cross_tenant',  'Worker credential validation failed')
ON CONFLICT (error_pattern) DO NOTHING;

-- ============================================================
-- 5. renew_job_lease() — Heartbeat / Lease Renewal
-- ============================================================
-- Called by the worker every ~25 seconds during job execution.
-- Extends the lease by p_extend_s seconds.
-- Returns TRUE if renewed, FALSE if job was reclaimed or worker mismatch.
-- ============================================================

CREATE OR REPLACE FUNCTION public.renew_job_lease(
  p_job_id    UUID,
  p_worker_id TEXT,
  p_extend_s  INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.session_jobs
  SET
    lease_expires_at  = now() + (p_extend_s || ' seconds')::INTERVAL,
    last_heartbeat_at = now(),
    updated_at        = now()
  WHERE id          = p_job_id
    AND worker_id   = p_worker_id
    AND status      = 'running';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_job_lease(UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renew_job_lease(UUID, TEXT, INTEGER) TO service_role;

-- ============================================================
-- 6. confirm_job_side_effect() — Mark side effect occurred
-- ============================================================
-- Called BEFORE any external API call (Deepgram, OpenAI).
-- Signals to the safe-reclaim logic that partial work may exist.
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirm_job_side_effect(
  p_job_id    UUID,
  p_worker_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.session_jobs
  SET
    side_effect_confirmed = TRUE,
    updated_at            = now()
  WHERE id        = p_job_id
    AND worker_id = p_worker_id
    AND status    = 'running';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_job_side_effect(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_job_side_effect(UUID, TEXT) TO service_role;

-- ============================================================
-- 7. session_job_janitor() — Hardened Safe Reclaim
-- ============================================================
-- Replaces the naive "mark failed on lease expiry" logic.
-- Step 1: Detect expired jobs → heartbeat_lost (not failed directly)
-- Step 2: Evaluate each heartbeat_lost for safe reclaim:
--   - side_effect_confirmed=TRUE → dead_lettered (manual review needed)
--   - attempts >= max → dead_lettered
--   - safe → failed with backoff (retry eligible)
-- Step 3: Detect stuck sessions (processing with no live job)
-- Step 4: Detect repeated failure loops
-- ============================================================

CREATE OR REPLACE FUNCTION public.session_job_janitor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN

  -- -------------------------------------------------------
  -- Step 1: Detect jobs with expired lease → heartbeat_lost
  -- (intermediate state — not dead, not retried blindly)
  -- -------------------------------------------------------
  FOR r IN
    SELECT id, session_id, office_id, job_type, attempt_count, max_attempts, worker_id
    FROM   public.session_jobs
    WHERE  status IN ('claimed', 'running')
      AND  lease_expires_at <= now()
  LOOP
    UPDATE public.session_jobs SET
      status           = 'heartbeat_lost',
      last_error       = format(
        'Heartbeat lost. Worker %s stopped responding. Lease expired at %s.',
        r.worker_id, now()
      ),
      worker_id        = NULL,
      lease_expires_at = NULL,
      updated_at       = now()
    WHERE id = r.id;

    -- Persist alert
    INSERT INTO public.session_health_alerts (session_id, office_id, alert_type, severity, detail)
    VALUES (
      r.session_id, r.office_id, 'zombie_job', 'critical',
      jsonb_build_object(
        'job_id',    r.id,
        'job_type',  r.job_type,
        'attempts',  r.attempt_count,
        'worker_id', r.worker_id
      )
    );
  END LOOP;

  -- -------------------------------------------------------
  -- Step 2: Safe reclaim evaluation for heartbeat_lost jobs
  -- -------------------------------------------------------
  FOR r IN
    SELECT id, session_id, office_id, job_type, attempt_count, max_attempts, side_effect_confirmed
    FROM   public.session_jobs
    WHERE  status = 'heartbeat_lost'
  LOOP

    IF r.side_effect_confirmed THEN
      -- External API was already called — output may have been generated partially.
      -- Do NOT blindly retry. Move to dead_lettered for manual recovery.
      UPDATE public.session_jobs SET
        status     = 'dead_lettered',
        last_error = 'Safe reclaim blocked: side effects already confirmed before crash. Manual recovery required via inspect_lineage.',
        updated_at = now()
      WHERE id = r.id;

      INSERT INTO public.session_health_alerts (session_id, office_id, alert_type, severity, detail)
      VALUES (
        r.session_id, r.office_id, 'zombie_job', 'critical',
        jsonb_build_object(
          'job_id',  r.id,
          'reason',  'side_effect_confirmed_before_reclaim',
          'guidance', 'Use inspect_lineage to check if output was generated, then use retry_job only if no output exists.'
        )
      )
      ON CONFLICT DO NOTHING;

    ELSIF r.attempt_count >= r.max_attempts THEN
      -- Exhausted retries — dead letter
      UPDATE public.session_jobs SET
        status     = 'dead_lettered',
        last_error = format('Max attempts (%s) exhausted after heartbeat loss.', r.max_attempts),
        updated_at = now()
      WHERE id = r.id;

    ELSE
      -- Safe to retry: no confirmed side effects and attempts remaining
      UPDATE public.session_jobs SET
        status           = 'failed',
        reclaim_attempts = reclaim_attempts + 1,
        scheduled_at     = now() + interval '30 seconds',
        last_error       = 'Reclaimed after heartbeat loss. Scheduled for retry.',
        updated_at       = now()
      WHERE id = r.id;
    END IF;
  END LOOP;

  -- -------------------------------------------------------
  -- Step 3: Stuck session detection
  -- Sessions in processing states with no live job for >30 min
  -- -------------------------------------------------------
  INSERT INTO public.session_health_alerts (session_id, office_id, alert_type, severity, detail)
  SELECT
    s.id,
    s.office_id,
    'stuck_session',
    'critical',
    jsonb_build_object(
      'session_status', s.status,
      'processing_step', s.processing_step,
      'stuck_since', s.updated_at,
      'minutes_stuck', EXTRACT(EPOCH FROM (now() - s.updated_at)) / 60
    )
  FROM public.sessions s
  WHERE s.status IN ('processing', 'transcribed', 'context_ready', 'snapshot_created', 'analyzing', 'compensating')
    AND s.updated_at < now() - interval '30 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.session_jobs j
      WHERE j.session_id = s.id
        AND j.status IN ('queued', 'claimed', 'running', 'failed', 'heartbeat_lost')
        AND j.scheduled_at > now() - interval '2 hours'
    )
    -- Avoid duplicate alerts within the last hour
    AND NOT EXISTS (
      SELECT 1 FROM public.session_health_alerts a
      WHERE a.session_id  = s.id
        AND a.alert_type  = 'stuck_session'
        AND a.resolved_at IS NULL
        AND a.created_at  > now() - interval '1 hour'
    );

  -- -------------------------------------------------------
  -- Step 4: Repeated failure loop detection
  -- -------------------------------------------------------
  INSERT INTO public.session_health_alerts (session_id, office_id, alert_type, severity, detail)
  SELECT
    j.session_id,
    j.office_id,
    'repeated_failure',
    'warning',
    jsonb_build_object(
      'job_id',   j.id,
      'job_type', j.job_type,
      'attempts', j.attempt_count,
      'last_error', j.last_error
    )
  FROM public.session_jobs j
  WHERE j.status = 'failed'
    AND j.attempt_count >= 2
    AND j.updated_at > now() - interval '1 hour'
    AND NOT EXISTS (
      SELECT 1 FROM public.session_health_alerts a
      WHERE a.session_id = j.session_id
        AND a.alert_type = 'repeated_failure'
        AND a.resolved_at IS NULL
        AND a.created_at > now() - interval '1 hour'
    );

END;
$$;

-- ============================================================
-- 8. EXTEND FSM — transition_session_fsm
-- Add compensation and dead-letter paths to the FSM matrix.
-- ============================================================

CREATE OR REPLACE FUNCTION public.transition_session_fsm(
  p_session_id       UUID,
  p_target_status    public.session_status,
  p_target_step      TEXT          DEFAULT NULL,
  p_reason           TEXT          DEFAULT NULL,
  p_performed_by     UUID          DEFAULT NULL,
  p_metadata         JSONB         DEFAULT NULL,
  p_caller_office_id UUID          DEFAULT NULL,
  p_execution_context TEXT         DEFAULT 'system'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status   public.session_status;
  v_current_step     TEXT;
  v_lock_at          TIMESTAMPTZ;
  v_office_id        UUID;
  v_is_valid         BOOLEAN := FALSE;
  v_executor_id      UUID;
  v_caller_uid       UUID;
BEGIN
  -- --------------------------------------------------------
  -- 0. RESOLVE CALLER IDENTITY
  -- --------------------------------------------------------
  v_caller_uid  := auth.uid();
  v_executor_id := COALESCE(p_performed_by, v_caller_uid);

  -- --------------------------------------------------------
  -- 1. OWNERSHIP GATE — User flow
  -- --------------------------------------------------------
  IF v_caller_uid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM   public.sessions s
      JOIN   public.office_members om ON s.office_id = om.office_id
      WHERE  s.id         = p_session_id
        AND  om.user_id   = v_caller_uid
        AND  om.is_active = true
    ) THEN
      RAISE EXCEPTION 'ACCESS_DENIED: Session % does not belong to caller office (uid=%)',
        p_session_id, v_caller_uid;
    END IF;
  END IF;

  -- --------------------------------------------------------
  -- 2. OWNERSHIP GATE — Worker flow (service_role)
  -- --------------------------------------------------------
  IF v_caller_uid IS NULL THEN
    IF p_caller_office_id IS NULL THEN
      RAISE EXCEPTION 'WORKER_SECURITY_ERROR: p_caller_office_id is required for service_role calls on session %',
        p_session_id;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.sessions
      WHERE id = p_session_id AND office_id = p_caller_office_id
    ) THEN
      RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Session % does not belong to office % (worker)',
        p_session_id, p_caller_office_id;
    END IF;
  END IF;

  -- --------------------------------------------------------
  -- 3. FETCH CURRENT STATE WITH ROW LOCK
  -- --------------------------------------------------------
  SELECT status, processing_step, processing_lock_at, office_id
  INTO   v_current_status, v_current_step, v_lock_at, v_office_id
  FROM   public.sessions
  WHERE  id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: %', p_session_id;
  END IF;

  -- --------------------------------------------------------
  -- 4. CONCURRENCY LOCK CHECK
  -- --------------------------------------------------------
  IF v_lock_at IS NOT NULL
     AND v_lock_at > now() - interval '5 minutes'
     AND (p_target_step IS NOT NULL AND p_target_step != v_current_step)
  THEN
    RAISE EXCEPTION 'CONCURRENCY_LOCK_ACTIVE: Session locked in step "%" since %',
      v_current_step, v_lock_at;
  END IF;

  -- --------------------------------------------------------
  -- 5. IDEMPOTENCY: already in target state → silent OK
  -- --------------------------------------------------------
  IF p_target_status = v_current_status
     AND (p_target_step IS NULL OR p_target_step = v_current_step)
  THEN
    RETURN;
  END IF;

  -- --------------------------------------------------------
  -- 6. FSM TRANSITION MATRIX (Stage 11 extended)
  -- --------------------------------------------------------
  CASE v_current_status
    WHEN 'created'                   THEN IF p_target_status = 'recording'                                               THEN v_is_valid := TRUE; END IF;
    WHEN 'recording'                 THEN IF p_target_status = 'uploading'                                                THEN v_is_valid := TRUE; END IF;
    WHEN 'uploading'                 THEN IF p_target_status = 'ready_for_integrity_check'                                THEN v_is_valid := TRUE; END IF;
    WHEN 'ready_for_integrity_check' THEN IF p_target_status IN ('ready_for_transcription', 'processing')                THEN v_is_valid := TRUE; END IF;
    WHEN 'ready_for_transcription'   THEN IF p_target_status IN ('processing', 'transcribed')                            THEN v_is_valid := TRUE; END IF;
    WHEN 'processing'                THEN IF p_target_status IN ('transcribed', 'analyzed', 'failed', 'outputs_generated', 'snapshot_created', 'context_ready', 'compensating') THEN v_is_valid := TRUE; END IF;
    WHEN 'transcribed'               THEN IF p_target_status IN ('context_ready', 'compensating')                        THEN v_is_valid := TRUE; END IF;
    WHEN 'context_ready'             THEN IF p_target_status IN ('snapshot_created', 'processing', 'compensating')       THEN v_is_valid := TRUE; END IF;
    WHEN 'snapshot_created'          THEN IF p_target_status IN ('analyzing', 'outputs_generated', 'processing', 'compensating') THEN v_is_valid := TRUE; END IF;
    WHEN 'analyzing'                 THEN IF p_target_status IN ('outputs_generated', 'compensating')                    THEN v_is_valid := TRUE; END IF;
    WHEN 'outputs_generated'         THEN IF p_target_status IN ('approved', 'archived', 'snapshot_created', 'processing') THEN v_is_valid := TRUE; END IF;
    WHEN 'approved'                  THEN IF p_target_status = 'archived'                                                 THEN v_is_valid := TRUE; END IF;
    -- Stage 11: Recovery paths
    WHEN 'failed'                    THEN IF p_target_status IN ('ready_for_transcription', 'compensating', 'dead_lettered') THEN v_is_valid := TRUE; END IF;
    WHEN 'compensating'              THEN IF p_target_status IN ('failed', 'dead_lettered', 'ready_for_transcription')   THEN v_is_valid := TRUE; END IF;
    WHEN 'dead_lettered'             THEN IF p_target_status IN ('ready_for_transcription', 'failed')                    THEN v_is_valid := TRUE; END IF;
    ELSE NULL;
  END CASE;

  -- Global overrides (any state can enter these)
  IF p_target_status = 'failed'       THEN v_is_valid := TRUE; END IF;
  IF p_target_status = 'dead_lettered' THEN v_is_valid := TRUE; END IF;
  IF p_target_status = 'compensating'  THEN v_is_valid := TRUE; END IF;

  IF NOT v_is_valid THEN
    RAISE EXCEPTION 'INVALID_FSM_TRANSITION: Cannot move session % from % to %',
      p_session_id, v_current_status, p_target_status;
  END IF;

  -- --------------------------------------------------------
  -- 7. APPLY TRANSITION
  -- --------------------------------------------------------
  UPDATE public.sessions
  SET
    status             = p_target_status,
    processing_step    = COALESCE(p_target_step, processing_step),
    processing_lock_at = CASE WHEN p_target_step IS NULL THEN NULL ELSE now() END,
    updated_at         = now()
  WHERE id = p_session_id;

  -- --------------------------------------------------------
  -- 8. MANDATORY AUDIT LOG
  -- --------------------------------------------------------
  INSERT INTO public.session_audit_logs (
    session_id, office_id, action, resource_type, resource_id,
    performed_by, old_value, new_value, metadata
  ) VALUES (
    p_session_id, v_office_id,
    'STATUS_TRANSITION', 'session', p_session_id,
    v_executor_id,
    jsonb_build_object('status', v_current_status, 'step', v_current_step),
    jsonb_build_object('status', p_target_status,  'step', p_target_step),
    jsonb_build_object(
      'transition_reason',    p_reason,
      'caller_office_id',     p_caller_office_id,
      'execution_context',    p_execution_context,
      'worker_call',          (v_caller_uid IS NULL),
      'meta',                 p_metadata
    )
  );

END;
$$;

-- Ensure correct grants
REVOKE ALL ON FUNCTION public.transition_session_fsm(UUID, public.session_status, TEXT, TEXT, UUID, JSONB, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_session_fsm(UUID, public.session_status, TEXT, TEXT, UUID, JSONB, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_session_fsm(UUID, public.session_status, TEXT, TEXT, UUID, JSONB, UUID, TEXT) TO service_role;

-- ============================================================
-- 9. CLAIM FUNCTION UPDATE — adaptive lease duration
-- ============================================================
-- The claim function now accepts p_lease_duration so
-- the worker can set adaptive durations per job type.
-- TRANSCRIBE = 20 min, ANALYZE_* = 10 min, others = 5 min
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_session_job(
  p_worker_id      TEXT,
  p_worker_type    TEXT    DEFAULT 'CPU',
  p_max_jobs       INTEGER DEFAULT 1,
  p_lease_duration INTERVAL DEFAULT '5 minutes'
)
RETURNS SETOF public.session_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH target_jobs AS (
    SELECT id
    FROM   public.session_jobs
    WHERE
      (status = 'queued' OR (status = 'failed' AND scheduled_at <= NOW()))
      AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
    ORDER BY priority DESC, scheduled_at ASC
    LIMIT p_max_jobs
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.session_jobs
  SET
    status           = 'claimed',
    worker_id        = p_worker_id,
    claimed_at       = NOW(),
    lease_expires_at = NOW() + p_lease_duration,
    attempt_count    = attempt_count + 1,
    updated_at       = NOW()
  FROM target_jobs
  WHERE public.session_jobs.id = target_jobs.id
  RETURNING public.session_jobs.*;
END;
$$;

-- ============================================================
-- 10. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_jobs_heartbeat_lost
  ON public.session_jobs(status)
  WHERE status = 'heartbeat_lost';

CREATE INDEX IF NOT EXISTS idx_jobs_last_heartbeat
  ON public.session_jobs(last_heartbeat_at)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_jobs_side_effect
  ON public.session_jobs(id, side_effect_confirmed)
  WHERE side_effect_confirmed = TRUE;

CREATE INDEX IF NOT EXISTS idx_health_alerts_session
  ON public.session_health_alerts(session_id, alert_type)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_health_alerts_office_unresolved
  ON public.session_health_alerts(office_id, severity, created_at DESC)
  WHERE resolved_at IS NULL;

-- ============================================================
-- 11. UPDATE pg_cron SCHEDULE (if applicable)
-- ============================================================

SELECT cron.unschedule('session-job-janitor')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'session-job-janitor');

SELECT cron.schedule(
  'session-job-janitor',
  '* * * * *',
  'SELECT public.session_job_janitor();'
);

COMMIT;
