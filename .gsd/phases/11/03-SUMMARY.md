## Stage 11, Wave 3 — session-admin-actions Hardening ✅

### What Was Done
Rewrote `supabase/functions/session-admin-actions/index.ts` with Stage 11 safety gates:

**retry_job — Side-Effect Safety Check (Task 3.1):**
- Fetches job `side_effect_confirmed` flag before resetting to `queued`
- If `side_effect_confirmed=true`: queries `legal_session_outputs` or `medical_session_outputs` for existing output
- If output exists → 422 REJECTED with guidance to use `force_reprocess` instead
- Only resets to `queued` if safe (no confirmed output)
- Allows retry of `failed`, `dead_lettered`, `heartbeat_lost` jobs

**requeue_session — FSM + Freshness Validation (Task 3.2):**
- Only allows requeue from: `failed`, `dead_lettered`, `compensating`, `transcribed`, `outputs_generated`
- Blocks requeue from: `processing`, `approved`, `archived`, `recording`, `uploading`, etc.
- Validates `aggregate_session_hash` exists before requeue (no data → error)
- Uses FSM gate (`transition_session_fsm`) before enqueuing job
- Resolves open `stuck_session` health alerts after successful requeue

**emergency_stop — FSM Reconciliation (Task 3.3):**
- After stopping jobs, if session is in `PROCESSING_STATES` → FSM → `failed`
- Resolves all open health alerts for the session
- Returns `fsm_reconciled: true/false` and `alerts_resolved: N` in response

**resolve_stuck_session — New Action (Task 3.4):**
- Diagnose: returns `{session_status, live_jobs_count, has_snapshot, has_recording}`
- `recovery_mode: 'cancel'`: cancels all live jobs, FSM → `failed`
- `recovery_mode: 'requeue'`: cancels stuck jobs, FSM → `ready_for_transcription`, creates new TRANSCRIBE job
- FSM double-step fallback if primary transition is rejected
- Resolves open stuck_session alerts

**inspect_health_alerts — New Action (Task 3.5):**
- Returns open health alerts filtered by `office_id` (strict tenant isolation)
- Optional: filter by `session_id`, include resolved alerts, custom limit (max 100)
- Read-only — no FSM changes, no confirmation required

**Shared Helper: resolveSessionAlerts()**
- Bulk-resolves open alerts for a session with `resolved_by`, `resolved_at`, `resolution_note`
- Used by requeue_session, cancel_session, emergency_stop, resolve_stuck_session
