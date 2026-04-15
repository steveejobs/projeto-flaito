---
phase: 16
plan: 5
wave: 5
---

# Wave 5: Temporal Rate Limiting (Anti-Burst)

Prevent office-level spikes from degrading the shared platform.

## Tasks

- [ ] Create `20260422140000_stage16_anti_burst.sql`
    - [ ] Add `tokens_per_minute` and `requests_per_minute` to rate limit buckets
    - [ ] Update `check_and_increment_rate_limit` for token tracking
- [ ] Update `supabase/functions/session-processor/index.ts`
    - [ ] Enforce per-minute limits before AI operation
- [ ] Verify that a burst of 10 requests in 1 second triggers rejection/delay after the limit.

## Verification

- Run a stress script against a single office office.
- Verify `RATE_LIMIT_EXCEEDED` is logged and correctly throttles traffic.
