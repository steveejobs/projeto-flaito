---
phase: 16
plan: 1
wave: 1
---

# Wave 1: Cost Infrastructure

Establish the source of truth for AI pricing and detailed usage logging.

## Tasks

- [ ] Create `20260422100000_stage16_cost_infra.sql`
    - [ ] Add `public.ai_model_pricing` table
    - [ ] Add `public.ai_usage_logs` table
    - [ ] Update `public.session_jobs` with actual cost and decision fields
    - [ ] Update `public.office_ai_budgets` with weekly caps and anomaly config
- [ ] Seed base pricing data (OpenAI/Deepgram estimates)
- [ ] Verify schema changes in Database

## Verification

```sql
-- Check table presence
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('ai_model_pricing', 'ai_usage_logs');

-- Check job columns
SELECT column_name FROM information_schema.columns WHERE table_name = 'session_jobs' AND column_name IN ('actual_tokens_input', 'cost_usd', 'decision_taken');
```
