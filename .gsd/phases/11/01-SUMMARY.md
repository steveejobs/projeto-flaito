## Stage 11, Wave 1 — Schema & Database Layer ✅

### What Was Done
Created migration `20260415110000_stage11_job_integrity.sql`:

**Enum Extensions:**
- `heartbeat_lost` added to `session_job_status` — intermediate state before safe reclaim
- `compensated` added to `session_job_status` — chain rollback marker
- `compensating` added to `session_status` — session-level chain failure state
- `dead_lettered` added to `session_status` — terminal requiring manual intervention

**Table Extensions (session_jobs):**
- `last_heartbeat_at`, `heartbeat_interval_s`, `lease_duration_s` — heartbeat tracking
- `side_effect_confirmed` — marks when external API was called (prevents blind reclaim)
- `compensation_reason`, `reclaim_attempts`, `execution_duration_ms`, `token_estimate` — observability

**New Tables:**
- `session_health_alerts` — persistent alerts for stuck/zombie/chain-drift events, with RLS
- `job_failure_classifications` — seeded with 11 non-retryable error patterns

**New Functions:**
- `renew_job_lease(p_job_id, p_worker_id, p_extend_s)` — heartbeat renewal (service_role only)
- `confirm_job_side_effect(p_job_id, p_worker_id)` — marks side effect occurrence
- `session_job_janitor()` — hardened 4-step reclaim with safety gates
- `claim_session_job()` — updated to accept adaptive `p_lease_duration`
- `transition_session_fsm()` — extended FSM matrix with compensation and dead-letter paths

**Indexes:** 5 targeted indexes for efficient status queries and alert lookups
