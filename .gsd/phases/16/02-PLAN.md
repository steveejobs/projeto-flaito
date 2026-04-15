---
phase: 16
plan: 2
wave: 2
---

# Wave 2: Pre-Execution Control & Rerun Guard

Prevent wasteful AI spend before it happens.

## Tasks

- [ ] Create `20260422110000_stage16_pre_execution.sql`
    - [ ] `public.check_rerun_loop_guard` function
    - [ ] `public.get_pre_execution_verdict` RPC
- [ ] Update `supabase/functions/session-processor/index.ts`
    - [ ] Implement token estimation logic (heuristic)
    - [ ] Implement Pre-Execution verdict check
    - [ ] Implement Rerun Guard check
    - [ ] Log `decision_taken` and `estimated_cost_usd`
- [ ] Verify blocking logic via manual trigger

## Verification

- Simulate 4 rapid reruns for the same session hash; verify 4th is blocked.
- Set budget low and verify job is rejected or downgraded before calling LLM.
