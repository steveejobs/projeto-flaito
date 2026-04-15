# Stage 12 — Flaito Operational Runbooks

> **Version:** Stage 12 Production Hardening
> **Owner:** Engineering / Platform Ops
> **Last Updated:** 2026-04-09

Each runbook defines:
- **Detection Target** — SLO for identifying the incident
- **Resolution Target** — SLO for restoring service
- **Escalation Path** — who to involve if not resolved within target

---

## Index

1. [Worker Crash Storm](#1-worker-crash-storm)
2. [AI Budget Exhaustion](#2-ai-budget-exhaustion)
3. [Emergency Full Stop (Kill-Switch)](#3-emergency-full-stop-kill-switch)
4. [Stuck Session Recovery](#4-stuck-session-recovery)
5. [Rate Limit Abuse](#5-rate-limit-abuse)
6. [Deploy Preflight Failure](#6-deploy-preflight-failure)
7. [Database Housekeeping Failure](#7-database-housekeeping-failure)
8. [Readiness Gate Regression](#8-readiness-gate-regression)
9. [Dead-Letter Storm](#9-dead-letter-storm)
10. [Operator Freeze Required](#10-operator-freeze-required)

---

## 1. Worker Crash Storm

**Symptom:** Multiple workers failing in rapid succession. `session_health_alerts` fills with `zombie_job` or `heartbeat_lost` entries. Dead-letter rate spikes.

**Detection Target:** < 5 minutes (alert via `run_readiness_checks` or Supabase logs)
**Resolution Target:** < 30 minutes
**Escalation Path:** On-call Engineer → Platform Lead (if > 30 min)

### Steps

1. **Check readiness gates:**
   ```sql
   SELECT public.run_readiness_checks('manual');
   ```

2. **Identify crash pattern:**
   ```sql
   SELECT job_type, status, COUNT(*), MAX(last_error)
   FROM session_jobs
   WHERE updated_at > now() - interval '1 hour'
     AND status IN ('dead_lettered', 'heartbeat_lost', 'failed')
   GROUP BY job_type, status;
   ```

3. **Check if kill-switch needed:**
   - If crash storm is uncontrolled → activate `worker_drain`:
     ```
     POST /session-admin-actions?action=manage_kill_switch
     { "operation": "activate", "switch_type": "worker_drain", "scope": "global" }
     ```
   - Confirm with the returned `confirmation_token`.

4. **Inspect latest dead-lettered jobs for root cause:**
   ```sql
   SELECT id, job_type, last_error, side_effect_confirmed
   FROM session_jobs
   WHERE status = 'dead_lettered'
   ORDER BY updated_at DESC
   LIMIT 10;
   ```

5. **Fix root cause** (env var, schema issue, external API failure).

6. **Reactivate workers:**
   ```
   POST /session-admin-actions?action=manage_kill_switch
   Header: x-operator-confirm: CONFIRMED
   { "operation": "deactivate", "switch_id": "<uuid>" }
   ```

7. **Resolve stuck alerts:**
   ```sql
   UPDATE session_health_alerts
   SET resolved_at = now(), resolution_note = 'Worker crash storm resolved'
   WHERE resolved_at IS NULL AND severity = 'critical';
   ```

---

## 2. AI Budget Exhaustion

**Symptom:** `check_and_charge_ai_budget` returning `BUDGET_EXHAUSTED`. Users receive 429 errors on AI generation. Logs show `BUDGET_BLOCKED`.

**Detection Target:** < 5 minutes (warning at 80%, critical at 95%)
**Resolution Target:** < 15 minutes
**Escalation Path:** On-call Engineer → CTO (if override > 24h needed)

### Steps

1. **Check current budget state:**
   ```sql
   SELECT office_id, tokens_used_today, daily_token_cap, daily_hard_cap,
          ROUND((tokens_used_today::numeric / daily_token_cap) * 100, 1) AS pct_used
   FROM office_ai_budgets
   ORDER BY pct_used DESC;
   ```

2. **Classify severity:**
   - 80–95%: warning — reduce rate limits (auto-handled)
   - 95–100%: critical mode — only critical operations allowed
   - > hard_cap: EXHAUSTED — hard block

3. **Option A — Wait for daily reset** (runs at midnight UTC via `reset-ai-budgets` cron)

4. **Option B — Grant temporary override** (max 24h, requires justification):
   ```sql
   UPDATE office_ai_budgets
   SET daily_hard_cap = daily_hard_cap + 200000,
       override_by    = '<operator_user_id>',
       override_reason = 'Emergency: high-priority client session in progress',
       override_expires_at = now() + interval '4 hours'
   WHERE office_id = '<office_uuid>';
   ```

5. **Option C — Trigger immediate reset** (only if justified):
   ```sql
   SELECT public.reset_ai_budgets();
   ```

6. **Post-incident:** Review which jobs are consuming excessive tokens. Adjust `daily_token_cap` for the office if consistently hitting limits.

---

## 3. Emergency Full Stop (Kill-Switch)

**Symptom:** Requires complete or partial halt of system processing (security incident, data integrity breach detected, runaway costs, legal hold).

**Detection Target:** Immediate (manual trigger)
**Resolution Target:** < 10 minutes to activate; < 60 minutes for root cause
**Escalation Path:** OWNER → CTO + Legal (if security/compliance incident)

### Steps

1. **Determine scope:**
   - Isolated office? → use `scope: 'office'`
   - System-wide? → use `scope: 'global'`

2. **Activate kill-switch (via `session-admin-actions`):**
   ```
   POST /session-admin-actions?action=manage_kill_switch
   { "operation": "activate", "switch_type": "ai_generation", "scope": "global", "reason": "Security investigation in progress" }
   ```

3. **For global switches — CONFIRM with token:**
   ```
   POST /session-admin-actions?action=manage_kill_switch
   { "operation": "confirm", "switch_id": "<uuid>", "confirmation_token": "<token_from_step_2>" }
   ```

4. **Verify active switches:**
   ```
   POST /session-admin-actions?action=manage_kill_switch
   { "operation": "list" }
   ```

5. **Resolve root cause** (security audit, data investigation, billing issue).

6. **Deactivate switch (requires x-operator-confirm header):**
   ```
   POST /session-admin-actions?action=manage_kill_switch
   Header: x-operator-confirm: CONFIRMED
   { "operation": "deactivate", "switch_id": "<uuid>", "deactivation_reason": "Investigation concluded. Normal operations resumed." }
   ```

7. **Verify readiness before resuming traffic:**
   ```
   POST /session-admin-actions?action=run_readiness_check
   ```
   > Must return `overall_passing: true`.

---

## 4. Stuck Session Recovery

**Symptom:** Sessions in `processing` or `compensating` state with no job activity for > 30 minutes. `session_health_alerts` contains `stuck_session` entries.

**Detection Target:** < 10 minutes (readiness check `stuck_session_age`)
**Resolution Target:** < 30 minutes
**Escalation Path:** On-call Engineer → Domain Lead (if requeue fails)

### Steps

1. **Identify stuck sessions:**
   ```sql
   SELECT id, status, processing_step, updated_at,
          EXTRACT(EPOCH FROM (now() - updated_at))/60 AS stuck_minutes
   FROM sessions
   WHERE status IN ('processing', 'compensating', 'context_ready', 'snapshot_created')
     AND updated_at < now() - interval '30 minutes'
   ORDER BY stuck_minutes DESC;
   ```

2. **Check live jobs for session:**
   ```
   POST /session-admin-actions?action=inspect_lineage
   { "session_id": "<uuid>" }
   ```

3. **Attempt controlled requeue:**
   ```
   POST /session-admin-actions?action=resolve_stuck_session
   { "session_id": "<uuid>", "recovery_mode": "requeue", "justification": "Session stuck in processing for >30min" }
   ```

4. **If requeue fails → cancel and escalate:**
   ```
   POST /session-admin-actions?action=resolve_stuck_session
   { "session_id": "<uuid>", "recovery_mode": "cancel", "justification": "Requeue failed. Manual review required." }
   ```

5. **If systemic (many sessions stuck) → activate worker_drain and investigate.**

---

## 5. Rate Limit Abuse

**Symptom:** Single user or office hitting rate limit blocks repeatedly. `rate_limit_buckets` shows high `count` with `blocked_at` set. May indicate automation scraping or runaway client code.

**Detection Target:** < 15 minutes (readiness check `rate_limit_blocked_pct > 10%`)
**Resolution Target:** < 30 minutes
**Escalation Path:** On-call Engineer → Security (if automated abuse)

### Steps

1. **Identify abuse source:**
   ```sql
   SELECT scope_type, scope_id, action, COUNT(*), SUM(count), MAX(count)
   FROM rate_limit_buckets
   WHERE blocked_at IS NOT NULL
     AND window_start >= now() - interval '1 hour'
   GROUP BY scope_type, scope_id, action
   ORDER BY SUM(count) DESC
   LIMIT 20;
   ```

2. **Check if legitimate (retry storm from client bug) or malicious.**

3. **For client bug:** Contact team to fix retry logic. Rate limits will clear automatically after window.

4. **For malicious automation:**
   - Activate `operator_freeze` for the office:
     ```
     POST /session-admin-actions?action=manage_kill_switch
     { "operation": "activate", "switch_type": "operator_freeze", "scope": "office", "scope_id": "<office_id>" }
     ```
   - Coordinate with security team for account suspension.

5. **Adjust limits if false positive:** Current limits are per-code. Increase via `p_limit_per_window` in the calling code.

---

## 6. Deploy Preflight Failure

**Symptom:** `deploy-preflight` function returns `DEPLOY_BLOCKED` with `blocking_failures`. CI/CD pipeline halted.

**Detection Target:** Immediate (CI/CD step)
**Resolution Target:** < 45 minutes
**Escalation Path:** Deploying Engineer → Platform Lead

### Steps

1. **Read the failure detail:**
   ```
   POST /deploy-preflight
   # Response includes: blocking_failures[], warnings[], check_results[]
   ```

2. **Route by failure type:**

   | Failure | Action |
   |---------|--------|
   | `MISSING_ENV_VARS` | Add missing env vars to Supabase project settings |
   | `MISSING_TABLES` | Run pending migrations |
   | `MISSING_RPCS` | Run pending migrations |
   | `MISSING_CRON_JOBS` | Re-apply migration with `cron.schedule()` calls |
   | `RLS_DISABLED_ON` | Apply RLS migration for affected tables |
   | `READINESS_GATE_FAILURES` | Fix operational issues (stuck sessions, dead letters) |
   | `ACTIVE_KILL_SWITCHES` | Deactivate kill switches, then retry deploy |

3. **Re-run preflight after fix:**
   ```
   POST /deploy-preflight
   # Must return "verdict": "DEPLOY_ALLOWED"
   ```

4. **Never bypass preflight.** If you believe the check is wrong, fix the check, don't skip it.

5. **Update `expected_schema.json`** if new tables/RPCs were added in this deploy.

---

## 7. Database Housekeeping Failure

**Symptom:** `housekeeping_runs` table shows errors or `system-housekeeping` cron has not run in > 2 hours. Database is growing. Readiness check `housekeeping_last_run` fails.

**Detection Target:** < 15 minutes (readiness check)
**Resolution Target:** < 45 minutes
**Escalation Path:** On-call DBA/Engineer → Platform Lead

### Steps

1. **Check last housekeeping run:**
   ```sql
   SELECT id, ran_at, dry_run, deleted_counts, errors, duration_ms, triggered_by
   FROM housekeeping_runs
   ORDER BY ran_at DESC
   LIMIT 5;
   ```

2. **Read error details from last failing run.**

3. **Run dry-run to validate state:**
   ```sql
   SELECT public.system_housekeeping(true, 'manual');
   ```
   > Returns counts per category without deleting.

4. **If dry-run safe, execute production run:**
   ```sql
   SELECT public.system_housekeeping(false, 'manual');
   ```

5. **Check cron registration:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'system-housekeeping';
   ```

6. **If cron missing:** Re-apply the Stage 12 retention migration or manually register:
   ```sql
   SELECT cron.schedule('system-housekeeping', '0 * * * *',
     $$ SELECT public.system_housekeeping(false, 'cron'); $$);
   ```

---

## 8. Readiness Gate Regression

**Symptom:** `run_readiness_checks()` returns `overall_passing: false` after previously passing. Blocking failures detected.

**Detection Target:** < 10 minutes (monitoring integration or pre-deploy)
**Resolution Target:** < 60 minutes
**Escalation Path:** On-call Engineer → Domain Lead (based on failure category)

### Steps

1. **Get latest readiness run:**
   ```sql
   SELECT * FROM production_readiness_runs
   ORDER BY ran_at DESC LIMIT 3;
   ```

2. **Identify blocking failures** from `blocking_failures` column.

3. **Route by category:**
   - `dead_letter_*` → Runbook #9
   - `stuck_session_*` → Runbook #4
   - `active_kill_switches` → Runbook #3 (deactivate)
   - `open_critical_alerts` → Inspect via `inspect_health_alerts`
   - `housekeeping_*` → Runbook #7

4. **Monitor trend to check if systemic:**
   ```sql
   SELECT ran_at, overall_passing, failed_count,
          blocking_failures->0->>'check' AS top_failure
   FROM production_readiness_runs
   WHERE ran_at > now() - interval '24 hours'
   ORDER BY ran_at DESC;
   ```

---

## 9. Dead-Letter Storm

**Symptom:** High volume of dead-lettered jobs (> 5% in 1h or > 50 absolute in 24h). `dead_letter_rate` check failing. Sessions stuck permanently.

**Detection Target:** < 5 minutes (readiness check)
**Resolution Target:** < 45 minutes
**Escalation Path:** On-call Engineer → Platform Lead

### Steps

1. **Classify the error type:**
   ```sql
   SELECT LEFT(last_error, 60) AS error_pattern, COUNT(*), MAX(updated_at)
   FROM session_jobs
   WHERE status = 'dead_lettered'
     AND updated_at > now() - interval '24 hours'
   GROUP BY error_pattern
   ORDER BY COUNT(*) DESC;
   ```

2. **Non-retryable client errors** (e.g., `PROHIBITED_GENERATION`, `SNAPSHOT_NOT_FOUND`):
   - Investigate the data state of the affected sessions.
   - Use `inspect_lineage` to understand each session's state.
   - Do NOT bulk-retry — these errors require domain review.

3. **Infrastructure errors** (e.g., AI API down, DB timeout):
   - Wait for infrastructure to recover.
   - Use `retry_job` after verifying `side_effect_confirmed = false`.

4. **If still accumulating:** Activate `worker_drain` (Runbook #3) to stop new failures while fixing root cause.

---

## 10. Operator Freeze Required

**Symptom:** Platform needs to pause all governance actions (medical review, operator retries, administrative changes) while a security audit or legal hold is in effect.

**Detection Target:** Immediate (manual trigger)
**Resolution Target:** Defined by legal/compliance team
**Escalation Path:** OWNER → CTO + Legal

### Steps

1. **Activate operator_freeze globally:**
   ```
   POST /session-admin-actions?action=manage_kill_switch
   { "operation": "activate", "switch_type": "operator_freeze", "scope": "global", "reason": "Legal hold: incident investigation INV-2026-001" }
   ```
   Confirm with token.

2. **Medical governance watchdog will auto-skip** while freeze is active.

3. **Document freeze scope, start time, and expected duration.**

4. **Regular check-ins** with legal/compliance (every 4h).

5. **Lift freeze** when cleared:
   ```
   POST /session-admin-actions?action=manage_kill_switch
   Header: x-operator-confirm: CONFIRMED
   { "operation": "deactivate", "switch_id": "<uuid>", "deactivation_reason": "Legal hold lifted: INV-2026-001 resolved" }
   ```

6. **Verify all systems resume normally** via readiness check.

---

## Operational SLOs Summary

| Runbook | Detection Target | Resolution Target |
|---------|-----------------|------------------|
| Worker Crash Storm | < 5 min | < 30 min |
| AI Budget Exhaustion | < 5 min | < 15 min |
| Emergency Full Stop | Immediate | < 60 min |
| Stuck Session Recovery | < 10 min | < 30 min |
| Rate Limit Abuse | < 15 min | < 30 min |
| Deploy Preflight Failure | Immediate | < 45 min |
| Housekeeping Failure | < 15 min | < 45 min |
| Readiness Gate Regression | < 10 min | < 60 min |
| Dead-Letter Storm | < 5 min | < 45 min |
| Operator Freeze | Immediate | Defined by Legal |

---

## Common Queries Reference

```sql
-- System health at a glance
SELECT public.run_readiness_checks('manual');

-- Active kill switches
SELECT switch_type, scope, scope_id, activated_at, activation_reason
FROM system_kill_switches WHERE is_active = true;

-- Budget status
SELECT office_id, tokens_used_today, daily_hard_cap,
       ROUND((tokens_used_today::numeric / daily_hard_cap) * 100, 1) AS pct_hard_cap
FROM office_ai_budgets ORDER BY pct_hard_cap DESC;

-- Rate limit hotspots (last 1h)
SELECT scope_type, scope_id, action, SUM(count) AS total_calls
FROM rate_limit_buckets
WHERE window_start >= now() - interval '1 hour' AND blocked_at IS NOT NULL
GROUP BY scope_type, scope_id, action ORDER BY total_calls DESC LIMIT 10;

-- Readiness gate history (last 24h)
SELECT ran_at, overall_passing, failed_count, triggered_by
FROM production_readiness_runs
WHERE ran_at > now() - interval '24 hours'
ORDER BY ran_at DESC;

-- Housekeeping history
SELECT ran_at, dry_run, deleted_counts, errors, duration_ms
FROM housekeeping_runs ORDER BY ran_at DESC LIMIT 10;
```
