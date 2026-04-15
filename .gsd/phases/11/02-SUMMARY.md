## Stage 11, Wave 2 — session-processor Hardening ✅

### What Was Done
Rewrote `supabase/functions/session-processor/index.ts` with Stage 11 guarantees:

**Heartbeat Loop (Task 2.1):**
- `setInterval(25_000)` started after job is marked `running`
- Calls `renew_job_lease(p_extend_s: 60)` every 25s — 2.4x safety margin over renewal interval
- `heartbeatActive` flag + `clearInterval` in `finally` to prevent dangling timers
- Logs warning if renewal fails (job may have been reclaimed by janitor)

**Side Effect Confirmation (Task 2.2):**
- `markSideEffectConfirmed()` helper calls `confirm_job_side_effect()` RPC
- Called BEFORE `fetch(DEEPGRAM_API_URL)` in `handleTranscription`
- Called BEFORE OpenAI call in `handleDomainAnalysis`
- If job crashes after this point, reclaim will be blocked by janitor → requires manual review

**Retry Classification (Task 2.3):**
- `isRetryable(errorMessage: string): boolean` checks against `NON_RETRYABLE_PREFIXES` array
- Non-retryable → job set to `dead_lettered` + session FSM → `dead_lettered` + health alert inserted
- Retryable → job set to `failed` (standard retry on next claim cycle)

**Chain Failure Compensation (Task 2.4):**
- INGEST, SNAPSHOT, ANALYZE_LEGAL, ANALYZE_MEDICAL failures trigger `compensating` FSM state
- Prevents silent stuck session in `processing` with no live job

**Idempotency Hardening (Task 2.5):**
- `transcribe_session` action now fetches `aggregate_session_hash` from DB
- Idempotency key: `transcribe:{session_id}:{aggregate_hash}` (stable across retries)
- Was: `transcribe_{session_id}_{Date.now()}` — now deterministic

**Adaptive Lease Duration (Task 2.6):**
- `leaseDurationForJobType()`: TRANSCRIBE=20min, ANALYZE_*=10min, others=5min
- After initial claim (default 5 min), worker immediately calls `renew_job_lease` with adaptive extension
- TRANSCRIBE gets 1200s (20min), ANALYZE 600s (10min), others 300s (5min)

**Deduplication for Domain Analysis:**
- `handleDomainAnalysis` checks for existing output on same `snapshot_id` before re-running
- Logs dedup skip with `reused: true` in response
