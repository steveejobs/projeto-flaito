---
phase: 16
plan: 3
wave: 3
---

# Wave 3: Adaptive Intelligence & Deduplication

Optimize output quality and cost via intelligent model selection and reuse.

## Tasks

- [ ] Create `20260422120000_stage16_adaptive_logic.sql`
    - [ ] `public.get_adaptive_model_tier` function (State-aware)
    - [ ] `public.check_smart_deduplication` function (Hash-aware)
- [ ] Update `supabase/functions/session-processor/index.ts`
    - [ ] Integrate `check_smart_deduplication` before LLM calls
    - [ ] Integrate `get_adaptive_model_tier` for model selection
    - [ ] Mark `cache_hit` or `dedup_hit` in job result
- [ ] Verify that identical snapshots result in `dedup_hit = true` and zero additional cost.

## Verification

- Process a session, then process it again. Second run should complete in < 1s with "dedup_hit".
- Simulate high queue pressure (manually set metrics) and verify model downgrade to faster tiers.
