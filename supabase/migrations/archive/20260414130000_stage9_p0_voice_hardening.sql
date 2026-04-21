-- Migration: 20260414130000_stage9_p0_voice_hardening.sql
-- Stage 9: P0 Security Hardening — Voice Pending Action Hardening
-- Closes: F-NEW-B (replay attacks on voice confirmations, missing office binding)
-- Strategy:
--   1. Add office_id, confirmed_at, action_nonce to voice_pending_actions
--   2. Add FK to sessions (was missing)
--   3. Rewrite RLS to include office membership validation
--   4. Create atomic confirm_voice_pending_action() RPC that is:
--       - single-use (status transition guard)
--       - expiration-aware
--       - user + office bound
--       - nonce-scoped (replay-safe)

BEGIN;

-- ============================================================
-- 1. SCHEMA EXTENSIONS on voice_pending_actions
-- ============================================================

-- Add office_id column (without NOT NULL first, for backfill)
ALTER TABLE public.voice_pending_actions
    ADD COLUMN IF NOT EXISTS office_id     UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS confirmed_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS action_nonce  TEXT; -- action-scoped nonce for anti-replay

-- ============================================================
-- 2. ADD MISSING FK TO sessions
-- ============================================================
-- voice_pending_actions.session_id had no FK — orphan rows were possible
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_voice_pending_session'
          AND table_name = 'voice_pending_actions'
    ) THEN
        -- Clean up orphaned rows before adding FK
        DELETE FROM public.voice_pending_actions vpa
        WHERE NOT EXISTS (
            SELECT 1 FROM public.sessions s WHERE s.id = vpa.session_id
        );

        ALTER TABLE public.voice_pending_actions
            ADD CONSTRAINT fk_voice_pending_session
            FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================
-- 3. BACKFILL office_id FROM sessions
-- ============================================================
UPDATE public.voice_pending_actions vpa
SET    office_id = s.office_id
FROM   public.sessions s
WHERE  s.id = vpa.session_id
  AND  vpa.office_id IS NULL;

-- Remove any rows that could not be resolved (no matching session)
DELETE FROM public.voice_pending_actions
WHERE office_id IS NULL;

-- Now enforce NOT NULL
ALTER TABLE public.voice_pending_actions
    ALTER COLUMN office_id SET NOT NULL;

-- ============================================================
-- 4. UNIQUE CONSTRAINT on action_nonce (anti-replay)
--    Nonces are nullable (only set on confirmation),
--    but once set they must be globally unique.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_pending_nonce
    ON public.voice_pending_actions (action_nonce)
    WHERE action_nonce IS NOT NULL;

-- ============================================================
-- 5. REWRITE RLS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "Users can view and manage their own pending actions"
    ON public.voice_pending_actions;

-- SELECT: own actions only, within own office
CREATE POLICY "voice_pending_select_own"
ON public.voice_pending_actions
FOR SELECT
USING (
    auth.uid() = user_id
    AND office_id IN (
        SELECT om.office_id
        FROM   public.office_members om
        WHERE  om.user_id   = auth.uid()
          AND  om.is_active = true
    )
);

-- INSERT: own user_id, own office
CREATE POLICY "voice_pending_insert_own"
ON public.voice_pending_actions
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND office_id IN (
        SELECT om.office_id
        FROM   public.office_members om
        WHERE  om.user_id   = auth.uid()
          AND  om.is_active = true
    )
);

-- UPDATE: blocked for direct client updates — must use RPC
-- (service_role can still update via the confirmation RPC)
CREATE POLICY "voice_pending_no_direct_update"
ON public.voice_pending_actions
FOR UPDATE
USING (false); -- effectively read-only from client perspective

-- ============================================================
-- 6. ATOMIC CONFIRMATION RPC
--    All confirmation paths (UI and voice) MUST go through this
--    function. It enforces:
--     - user identity (auth.uid())
--     - office membership
--     - pending status (not already confirmed/expired)
--     - expiration window
--     - nonce uniqueness (anti-replay)
--     - single-use (atomic UPDATE with status guard)
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirm_voice_pending_action(
    p_action_id UUID,
    p_nonce     TEXT  -- caller-provided nonce; must be unique per confirmation attempt
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action public.voice_pending_actions%ROWTYPE;
    v_rows_updated INTEGER;
BEGIN
    -- --------------------------------------------------------
    -- 1. Fetch with row lock (prevent concurrent confirmation)
    -- --------------------------------------------------------
    SELECT * INTO v_action
    FROM   public.voice_pending_actions
    WHERE  id = p_action_id
    FOR UPDATE NOWAIT;   -- Fail immediately if another transaction holds the lock

    IF NOT FOUND THEN
        RAISE EXCEPTION 'VOICE_ACTION_NOT_FOUND: %', p_action_id;
    END IF;

    -- --------------------------------------------------------
    -- 2. User ownership check
    -- --------------------------------------------------------
    IF v_action.user_id != auth.uid() THEN
        RAISE EXCEPTION 'VOICE_ACCESS_DENIED: Action % does not belong to caller (uid=%)',
            p_action_id, auth.uid();
    END IF;

    -- --------------------------------------------------------
    -- 3. Office membership check
    -- --------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1
        FROM   public.office_members om
        WHERE  om.office_id  = v_action.office_id
          AND  om.user_id    = auth.uid()
          AND  om.is_active  = true
    ) THEN
        RAISE EXCEPTION 'VOICE_OFFICE_DENIED: User % is not an active member of office %',
            auth.uid(), v_action.office_id;
    END IF;

    -- --------------------------------------------------------
    -- 4. Status must be 'pending' — prevents double confirmation
    -- --------------------------------------------------------
    IF v_action.status != 'pending' THEN
        RAISE EXCEPTION 'VOICE_ACTION_NOT_PENDING: Action % current status is "%". Cannot confirm.',
            p_action_id, v_action.status;
    END IF;

    -- --------------------------------------------------------
    -- 5. Expiration check
    -- --------------------------------------------------------
    IF v_action.expires_at < now() THEN
        -- Mark as expired atomically
        UPDATE public.voice_pending_actions
        SET    status = 'expired'
        WHERE  id = p_action_id AND status = 'pending';

        RAISE EXCEPTION 'VOICE_ACTION_EXPIRED: Action % expired at %',
            p_action_id, v_action.expires_at;
    END IF;

    -- --------------------------------------------------------
    -- 6. Nonce validation
    --    If a nonce is provided, it must be unique (not used before).
    --    The UNIQUE index on action_nonce enforces this at DB level.
    --    We catch the violation and re-raise as a clear replay error.
    -- --------------------------------------------------------
    IF p_nonce IS NULL OR trim(p_nonce) = '' THEN
        RAISE EXCEPTION 'VOICE_NONCE_REQUIRED: A unique confirmation nonce must be provided';
    END IF;

    -- --------------------------------------------------------
    -- 7. ATOMIC single-use confirmation
    --    The WHERE status = 'pending' guard ensures that even in
    --    a race condition (two concurrent calls passing check #4),
    --    only one will actually update the row.
    -- --------------------------------------------------------
    BEGIN
        UPDATE public.voice_pending_actions
        SET
            status        = 'confirmed',
            confirmed_at  = now(),
            action_nonce  = p_nonce
        WHERE id     = p_action_id
          AND status = 'pending';

        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    EXCEPTION
        WHEN unique_violation THEN
            -- The nonce was already used — this is a replay attack
            RAISE EXCEPTION 'VOICE_REPLAY_DETECTED: Nonce "%" has already been used for another confirmation',
                p_nonce;
    END;

    -- If 0 rows updated, a concurrent confirmation already succeeded
    IF v_rows_updated = 0 THEN
        RAISE EXCEPTION 'VOICE_ALREADY_CONFIRMED: Concurrent confirmation for action % was rejected',
            p_action_id;
    END IF;

    -- --------------------------------------------------------
    -- 8. Return confirmation payload for backend action dispatch
    --    The caller (Edge Function) uses this to actually execute
    --    the intent — never the client directly.
    -- --------------------------------------------------------
    RETURN jsonb_build_object(
        'ok',           true,
        'intent',       v_action.intent,
        'args',         v_action.args,
        'session_id',   v_action.session_id,
        'office_id',    v_action.office_id,
        'confirmed_at', now()
    );
END;
$$;

-- Restrict: only authenticated users may call this
REVOKE ALL ON FUNCTION public.confirm_voice_pending_action(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_voice_pending_action(UUID, TEXT) TO authenticated;

-- ============================================================
-- 7. INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_voice_pending_user_office
    ON public.voice_pending_actions (user_id, office_id);

CREATE INDEX IF NOT EXISTS idx_voice_pending_status_expires
    ON public.voice_pending_actions (status, expires_at)
    WHERE status = 'pending';

COMMIT;
