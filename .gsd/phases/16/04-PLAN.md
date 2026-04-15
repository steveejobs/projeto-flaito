---
phase: 16
plan: 4
wave: 4
---

# Wave 4: Scaling & Backpressure Control

Ensure global system stability under massive concurrent load.

## Tasks

- [ ] Create `20260422130000_stage16_backpressure.sql`
    - [ ] `public.system_concurrency_config` table
    - [ ] Update `public.claim_session_job` with global limit checks
    - [ ] Implement Burst Fairness logic (idle capacity usage)
- [ ] Update `supabase/functions/session-processor/index.ts`
    - [ ] Implement mid-execution cancelation checks (budget/kill-switch changes)
- [ ] Verify that global concurrency limit stops excessive job claims.

## Verification

- Inject 200 jobs. Set global limit to 50. Verify only 50 are running.
- Verify that offices can exceed their local limit IF global capacity is available (Burst Capacity).
