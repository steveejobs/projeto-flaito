# Flaito — Hardened Operational Runbooks

> **Version:** Post-Stage 13 Precision Hardening
> **Supersedes:** `stage12-runbooks.md`
> **Owner:** Engineering / Platform Ops
> **Last Updated:** 2026-04-09

Each runbook now includes:
- **DECISION POINTS** — when to retry, cancel, or escalate
- **ANTI-PATTERNS** — what NOT to do under pressure
- **EXPECTED FINAL STATE** — exact DB/system condition after execution
- **TIME EXPECTATIONS** — detection time, resolution time

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

### DECISION POINTS

| Situation | Action |
|-----------|--------|
| Crash rate < 20% of workers, single job type affected | **Retry** — likely transient error. Check job `last_error` first. |
| Crash rate > 50%, multiple job types, spreading | **Cancel** — activate `worker_drain` immediately. Investigate before re-enabling. |
| Root cause unknown after 10 minutes | **Escalate** to Platform Lead. Do not retry blindly. |
| Crash producing `side_effect_confirmed = true` jobs | **Never auto-retry.** Inspect lineage first to verify output state. |

### ANTI-PATTERNS

- **DO NOT** bulk-retry dead-lettered jobs without reading `last_error` first.
- **DO NOT** increase `max_attempts` to "fix" a structural error — it will only multiply the damage.
- **DO NOT** deactivate `worker_drain` before root cause is confirmed.
- **DO NOT** ignore `side_effect_confirmed = true` entries — they require manual review.

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

### EXPECTED FINAL STATE

- `system_kill_switches` WHERE `switch_type = 'worker_drain'`: `is_active = false`
- `session_health_alerts` WHERE `alert_type = 'zombie_job'`: all have `resolved_at IS NOT NULL`
- `session_jobs` WHERE `status = 'heartbeat_lost'`: count = 0 (janitor processed them)
- `production_readiness_runs`: latest run returns `overall_passing = true`

---

## 2. AI Budget Exhaustion

**Symptom:** `check_and_charge_ai_budget` returning `BUDGET_EXHAUSTED`. Users receive 429 errors on AI generation. Logs show `BUDGET_BLOCKED`.

**Detection Target:** < 5 minutes (warning at 80%, critical at 95%)
**Resolution Target:** < 15 minutes
**Escalation Path:** On-call Engineer → CTO (if override > 24h needed)

### DECISION POINTS

| Situation | Action |
|-----------|--------|
| Single office at 95%+, daily reset < 4 hours away | **Wait** — daily reset will clear automatically |
| High-priority client session in progress, > 4h to reset | **Override** (Option B) — temporary cap increase |
| Multiple offices exhausted simultaneously | **Escalate** to CTO — may indicate billing misconfiguration |
| Usage spike is automated/anomalous (same job type dominates) | **Cancel** the runaway jobs before any override |

### ANTI-PATTERNS

- **DO NOT** use `reset_ai_budgets()` during business hours unless explicitly authorized — it resets ALL offices.
- **DO NOT** increase `daily_hard_cap` without recording an `override_reason`.
- **DO NOT** override without a time-bound `override_expires_at` — overrides must expire.

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

5. **Option C — Trigger immediate reset** (only if justified by CTO):
   ```sql
   SELECT public.reset_ai_budgets();
   ```

6. **Post-incident:** Review which jobs are consuming excessive tokens. Adjust `daily_token_cap` for the office if consistently hitting limits.

### EXPECTED FINAL STATE

- `office_ai_budgets` for affected office: `tokens_used_today < daily_token_cap`
- If override was applied: `override_expires_at` is set and in the future
- No active `BUDGET_EXHAUSTED` log entries in the last 5 minutes

---

## 3. Emergency Full Stop (Kill-Switch)

**Symptom:** Requires complete or partial halt of system processing (security incident, data integrity breach detected, runaway costs, legal hold).

**Detection Target:** Immediate (manual trigger)
**Resolution Target:** < 10 minutes to activate; < 60 minutes for root cause
**Escalation Path:** OWNER → CTO + Legal (if security/compliance incident)

### DECISION POINTS

| Situation | Action |
|-----------|--------|
| Isolated office anomaly | Activate `scope: 'office'` — narrow blast radius |
| System-wide incident (breach, runaway cost, legal) | Activate `scope: 'global'` — requires token confirmation |
| Root cause resolved within 30 minutes | Deactivate with documented reason |
| Root cause unknown after 60 minutes | Keep switch active. Escalate to CTO + Legal. |
| Active sessions mid-processing when switch activates | They will complete current atomic step, then block on next claim. **Do not force-stop running jobs.** |

### ANTI-PATTERNS

- **DO NOT** activate global switches without the token confirmation step — it exists to prevent accidental triggers.
- **DO NOT** deactivate a switch before verifying root cause is resolved (even under business pressure).
- **DO NOT** use `worker_drain` when `ai_generation` is the right type — understand the switch types.
- **DO NOT** bypass the `x-operator-confirm: CONFIRMED` header requirement for deactivation.

### Switch Types Reference

| Type | Effect |
|------|--------|
| `ai_generation` | Blocks all OpenAI/Claude API calls |
| `session_processing` | Blocks job claims for a specific office |
| `voice_actions` | Blocks voice STT/TTS actions |
| `worker_drain` | Blocks all new job claims system-wide |
| `operator_freeze` | Blocks all operator write actions |

### Steps

1. **Determine scope** (`office` or `global`)

2. **Activate:**
   ```
   POST /session-admin-actions?action=manage_kill_switch
   { "operation": "activate", "switch_type": "ai_generation", "scope": "global", "reason": "Security investigation in progress" }
   ```

3. **For global — CONFIRM with token:**
   ```
   POST /session-admin-actions?action=manage_kill_switch
   { "operation": "confirm", "switch_id": "<uuid>", "confirmation_token": "<token>" }
   ```

4. **Verify:**
   ```
   POST /session-admin-actions?action=manage_kill_switch
   { "operation": "list" }
   ```

5. **Resolve root cause.**

6. **Deactivate (requires x-operator-confirm header):**
   ```
   POST /session-admin-actions?action=manage_kill_switch
   Header: x-operator-confirm: CONFIRMED
   { "operation": "deactivate", "switch_id": "<uuid>", "deactivation_reason": "Investigation concluded." }
   ```

7. **Verify readiness before resuming traffic:**
   ```
   POST /session-admin-actions?action=run_readiness_check
   ```
   Must return `overall_passing: true`.

### EXPECTED FINAL STATE

- `system_kill_switches` WHERE `switch_type = '<type>'`: `is_active = false`
- `session_audit_logs` has `KILL_SWITCH_DEACTIVATED` event with your `deactivation_reason`
- `production_readiness_runs`: latest run `overall_passing = true`
- No active kill-switch alerts in `session_health_alerts`

### Kill-Switch Blind Window (Observable)

Workers that claimed a job before the switch activated will complete their current atomic step before seeing the kill. The delay is logged as `KILL_SWITCH_DELAYED_EFFECT` in `session_audit_logs`. Query to observe:

```sql
SELECT metadata->>'job_id', metadata->>'worker_id', metadata->>'delay_ms', metadata->>'switch_type', created_at
FROM session_audit_logs
WHERE action = 'KILL_SWITCH_DELAYED_EFFECT'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 4. Stuck Session Recovery

**Symptom:** Sessions in `processing` or `compensating` state with no job activity for > 30 minutes. `session_health_alerts` contains `stuck_session` entries.

**Detection Target:** < 10 minutes (readiness check `stuck_session_age`)
**Resolution Target:** < 30 minutes
**Escalation Path:** On-call Engineer → Domain Lead (if requeue fails)

### DECISION POINTS

| Situation | Action |
|-----------|--------|
| Session has `aggregate_session_hash` and no active jobs | **Requeue** — safe to re-enqueue a TRANSCRIBE job |
| Session stuck in `snapshot_created` or later with existing outputs | **Inspect lineage first.** May only need an ANALYZE job, not full reprocess. |
| Multiple sessions stuck with same `processing_step` | **Escalate** — likely a systemic worker failure, not isolated stuck session |
| Session is `dead_lettered` with `side_effect_confirmed = true` jobs | **Cancel** — manual review required before any retry |

### ANTI-PATTERNS

- **DO NOT** requeue a session without checking if outputs already exist — `inspect_lineage` first.
- **DO NOT** call `resolve_stuck_session(recovery_mode: 'requeue')` on a session that is not actually stuck — it will cancel active jobs.
- **DO NOT** escalate to `emergency_stop` for a single stuck session unless there is evidence of data corruption.

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

2. **Inspect lineage:**
   ```
   POST /session-admin-actions?action=inspect_lineage
   { "session_id": "<uuid>" }
   ```

3. **Attempt controlled requeue:**
   ```
   POST /session-admin-actions?action=resolve_stuck_session
   { "session_id": "<uuid>", "recovery_mode": "requeue", "justification": "Session stuck >30min" }
   ```

4. **If requeue fails → cancel and escalate:**
   ```
   POST /session-admin-actions?action=resolve_stuck_session
   { "session_id": "<uuid>", "recovery_mode": "cancel", "justification": "Requeue failed. Manual review." }
   ```

5. **If systemic → activate worker_drain and investigate.**

### EXPECTED FINAL STATE

**After requeue:**
- Session `status = 'ready_for_transcription'`
- New `session_job` with `job_type = 'TRANSCRIBE'` and `status = 'queued'`
- `session_health_alerts` for this session: all `resolved_at IS NOT NULL`

**After cancel:**
- Session `status = 'failed'`
- All jobs `status IN ('cancelled', 'dead_lettered')`
- `session_health_alerts` for this session: all `resolved_at IS NOT NULL`

---

## 5. Rate Limit Abuse

**Symptom:** Single user or office hitting rate limit blocks repeatedly. `rate_limit_buckets` shows high `count` with `blocked_at` set.

**Detection Target:** < 15 minutes (readiness check `rate_limit_blocked_pct > 10%`)
**Resolution Target:** < 30 minutes
**Escalation Path:** On-call Engineer → Security (if automated abuse)

### DECISION POINTS

| Situation | Action |
|-----------|--------|
| Single office, burst pattern, known client | **Monitor** — likely retry bug. Contact client team. |
| Single office, sustained pattern, no known cause | **Activate `operator_freeze`** for that office while investigating |
| Multiple offices, same endpoint | **Escalate** — potential coordinated attack or shared infrastructure bug |
| Pattern stops after first block | Rate limits are working correctly. No action. |

### ANTI-PATTERNS

- **DO NOT** manually clear `rate_limit_buckets` entries — they expire automatically (2h window).
- **DO NOT** increase rate limit caps for an office under abuse without security sign-off.
- **DO NOT** activate global `operator_freeze` for a single-office abuse pattern.

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

2. **Determine if legitimate bug or malicious.**

3. **For client bug:** Contact team. Rate limits clear automatically after window.

4. **For malicious automation:**
   ```
   POST /session-admin-actions?action=manage_kill_switch
   { "operation": "activate", "switch_type": "operator_freeze", "scope": "office", "scope_id": "<office_id>" }
   ```
   Coordinate with security for account suspension.

### EXPECTED FINAL STATE

- `rate_limit_buckets` for abusive scope: `blocked_at` entries will expire naturally
- If `operator_freeze` was applied: `system_kill_switches.is_active = true` for that office until security clears it
- Readiness check `rate_limit_blocked_pct` back below 10%

---

## 6. Deploy Preflight Failure

**Symptom:** `deploy-preflight` function returns `DEPLOY_BLOCKED`. CI/CD pipeline halted.

**Detection Target:** Immediate (CI/CD step)
**Resolution Target:** < 45 minutes
**Escalation Path:** Deploying Engineer → Platform Lead

### DECISION POINTS

| Failure | Retry? | Escalate? |
|---------|--------|-----------|
| `MISSING_ENV_VARS` | After adding vars | No |
| `MISSING_TABLES` / `MISSING_RPCS` | After running migrations | No |
| `RLS_DISABLED_ON` | After applying RLS migration | No |
| `READINESS_GATE_FAILURES` | Only after fixing underlying issue | If stuck > 30min |
| `ACTIVE_KILL_SWITCHES` | After deactivating with justification | Only if switch can't be deactivated |

### ANTI-PATTERNS

- **NEVER bypass preflight.** If you believe the check is wrong, fix the check, not the gate.
- **DO NOT** manually update `expected_schema.json` to hide missing objects — fix the migration.
- **DO NOT** deactivate kill-switches just to unblock a deploy without understanding why they were active.

### Steps

1. **Read the failure detail:**
   ```
   POST /deploy-preflight
   ```

2. **Route by failure type** (see table above).

3. **Re-run after fix:**
   ```
   POST /deploy-preflight
   # Must return "verdict": "DEPLOY_ALLOWED"
   ```

### EXPECTED FINAL STATE

- `deploy-preflight` returns `{ "verdict": "DEPLOY_ALLOWED" }`
- All blocking_failures array is empty
- `expected_schema.json` is up-to-date

---

## 7. Database Housekeeping Failure

**Symptom:** `housekeeping_runs` shows errors or cron has not run in > 2 hours. Readiness check `housekeeping_last_run` fails.

**Detection Target:** < 15 minutes (readiness check)
**Resolution Target:** < 45 minutes
**Escalation Path:** On-call DBA/Engineer → Platform Lead

### DECISION POINTS

| Situation | Action |
|-----------|--------|
| Single category error (e.g., `execution_audit_logs`) | Safe to re-run — other categories are independent |
| `STORAGE_GROWTH_ALERT` in errors (session_recording_chunks > 500k) | Investigate storage. Run dry-run to assess scope. Manual purge decision required. |
| All categories succeeding but cron missing | Re-register cron (step 6) |
| `session_recording_chunks` purge blocked (has active jobs) | Expected — those sessions are still processing. No action needed. |

### ANTI-PATTERNS

- **DO NOT** run production housekeeping without dry-run first if the last run had errors.
- **DO NOT** delete `operator_action_log` records — they are compliance artifacts.
- **DO NOT** purge `session_recording_chunks` for sessions that are not in `approved` or `archived` state.

### Steps

1. **Check last run:**
   ```sql
   SELECT id, ran_at, dry_run, deleted_counts, errors, duration_ms
   FROM housekeeping_runs ORDER BY ran_at DESC LIMIT 5;
   ```

2. **Dry-run first:**
   ```sql
   SELECT public.system_housekeeping(true, 'manual');
   ```

3. **Check for storage growth alert** in the dry-run output:
   ```sql
   -- Look for STORAGE_GROWTH_ALERT in errors array
   SELECT errors FROM housekeeping_runs ORDER BY ran_at DESC LIMIT 1;
   ```

4. **If safe, execute production run:**
   ```sql
   SELECT public.system_housekeeping(false, 'manual');
   ```

5. **Verify chunks purge safety** (if needed):
   ```sql
   -- Verify no active sessions are being purged
   SELECT count(*) FROM session_recording_chunks src
   JOIN sessions s ON s.id = src.session_id
   WHERE s.status IN ('approved', 'archived')
     AND s.updated_at < now() - interval '90 days'
     AND NOT EXISTS (
       SELECT 1 FROM session_jobs j
       WHERE j.session_id = s.id
         AND j.status IN ('queued', 'claimed', 'running', 'failed', 'heartbeat_lost')
     );
   ```

6. **Re-register cron if missing:**
   ```sql
   SELECT cron.schedule('system-housekeeping', '0 * * * *',
     $$ SELECT public.system_housekeeping(false, 'cron'); $$);
   ```

### EXPECTED FINAL STATE

- `housekeeping_runs`: latest run has `errors = '[]'` (or only STORAGE_GROWTH_ALERT which is advisory)
- `cron.job` WHERE `jobname = 'system-housekeeping'`: exists and active
- Readiness check `housekeeping_last_run`: passing

---

## 8. Readiness Gate Regression

**Symptom:** `run_readiness_checks()` returns `overall_passing: false` after previously passing.

**Detection Target:** < 10 minutes
**Resolution Target:** < 60 minutes
**Escalation Path:** On-call Engineer → Domain Lead (based on failure category)

### DECISION POINTS

| Failure Category | Next Step |
|-----------------|-----------|
| `dead_letter_*` | Runbook #9 |
| `stuck_session_*` | Runbook #4 |
| `active_kill_switches` | Runbook #3 (deactivate if safe) |
| `open_critical_alerts` | Inspect, route to specific runbook |
| `housekeeping_*` | Runbook #7 |
| Readiness gate itself is broken | Fix the check, not the symptom |

### ANTI-PATTERNS

- **DO NOT** disable readiness checks to unblock a deploy.
- **DO NOT** resolve health alerts without fixing the underlying condition.
- **DO NOT** create fake passing runs — readiness history is an audit artifact.

### Steps

1. **Get latest run:**
   ```sql
   SELECT * FROM production_readiness_runs ORDER BY ran_at DESC LIMIT 3;
   ```

2. **Route by category** (see table above).

3. **Monitor trend:**
   ```sql
   SELECT ran_at, overall_passing, failed_count
   FROM production_readiness_runs
   WHERE ran_at > now() - interval '24 hours'
   ORDER BY ran_at DESC;
   ```

### EXPECTED FINAL STATE

- `production_readiness_runs`: latest run `overall_passing = true`
- `blocking_failures` array is empty

---

## 9. Dead-Letter Storm

**Symptom:** High volume of dead-lettered jobs (> 5% in 1h or > 50 absolute in 24h).

**Detection Target:** < 5 minutes
**Resolution Target:** < 45 minutes
**Escalation Path:** On-call Engineer → Platform Lead

### DECISION POINTS

| Error Pattern | Action |
|---------------|--------|
| Infrastructure error (DB timeout, API down) | **Wait for recovery**, then retry safe jobs |
| `side_effect_confirmed = true` | **Never auto-retry.** Inspect lineage per job. |
| `CROSS_TENANT_VIOLATION` | **BLOCKER.** Escalate immediately to security. |
| `SNAPSHOT_NOT_FOUND` | Session data inconsistency — manual review per session |
| `PROHIBITED_GENERATION` | Business rule rejection — not retryable, domain review |
| Pattern repeats after retry | Stop retrying. Root cause is not fixed. |

### ANTI-PATTERNS

- **DO NOT** bulk-retry all dead-lettered jobs — classify first.
- **DO NOT** retry `CROSS_TENANT_VIOLATION` — these are security events.
- **DO NOT** retry jobs with `side_effect_confirmed = true` without verifying output state.
- **DO NOT** keep retrying jobs that hit the same non-retryable error.

### Steps

1. **Classify by error type:**
   ```sql
   SELECT LEFT(last_error, 60) AS error_pattern, COUNT(*), MAX(updated_at)
   FROM session_jobs
   WHERE status = 'dead_lettered'
     AND updated_at > now() - interval '24 hours'
   GROUP BY error_pattern ORDER BY COUNT(*) DESC;
   ```

2. **Cross-reference with retryability classification:**
   ```sql
   SELECT jf.error_pattern, jf.is_retryable, jf.failure_class, jf.description
   FROM job_failure_classifications jf;
   ```

3. **For infrastructure errors only** — retry safe (no side effects):
   ```
   POST /session-admin-actions?action=retry_job
   { "job_id": "<uuid>", "justification": "Infrastructure recovered" }
   ```

4. **If still accumulating:** Activate `worker_drain` (Runbook #3).

### EXPECTED FINAL STATE

- Dead-letter rate < 1% in last hour
- All non-retryable dead-letters documented with investigation note
- `session_health_alerts` for affected sessions: resolved or escalated

---

## 10. Operator Freeze Required

**Symptom:** Platform needs to pause all governance actions during security audit or legal hold.

**Detection Target:** Immediate (manual trigger)
**Resolution Target:** Defined by legal/compliance team
**Escalation Path:** OWNER → CTO + Legal

### DECISION POINTS

| Situation | Action |
|-----------|--------|
| Freeze > 4 hours | CTO and Legal must re-confirm scope every 4 hours |
| Non-operator read actions needed during freeze | Allowed — `inspect_lineage`, `inspect_health_alerts`, `run_readiness_check` exempt |
| Freeze blocking critical medical operation | Requires CTO + Legal explicit lift, documented |
| Freeze lifted but scope incomplete | Narrow scope to specific office before full lift |

### ANTI-PATTERNS

- **DO NOT** lift freeze without explicit legal/compliance clearance.
- **DO NOT** use `operator_freeze` as a substitute for fixing an actual security issue.
- **DO NOT** create partial lifts that allow some operators through — all or nothing.

### Steps

1. **Activate globally:**
   ```
   POST /session-admin-actions?action=manage_kill_switch
   { "operation": "activate", "switch_type": "operator_freeze", "scope": "global", "reason": "Legal hold: INV-2026-001" }
   ```
   Confirm with token.

2. **Document**: freeze scope, start time, expected duration, legal contact.

3. **Regular check-ins** with legal/compliance every 4 hours.

4. **Lift when cleared:**
   ```
   POST /session-admin-actions?action=manage_kill_switch
   Header: x-operator-confirm: CONFIRMED
   { "operation": "deactivate", "switch_id": "<uuid>", "deactivation_reason": "Legal hold lifted: INV-2026-001 resolved by Legal on 2026-04-09" }
   ```

5. **Verify normal operation:**
   ```
   POST /session-admin-actions?action=run_readiness_check
   ```

### EXPECTED FINAL STATE

- `system_kill_switches` WHERE `switch_type = 'operator_freeze'`: `is_active = false`
- `session_audit_logs` has `KILL_SWITCH_DEACTIVATED` with legal reference in `deactivation_reason`
- `production_readiness_runs`: latest `overall_passing = true`

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

-- Full system integrity check (impossible states, cross-tenant, orphans)
SELECT public.run_integrity_check();

-- Active kill switches
SELECT switch_type, scope, scope_id, activated_at, activation_reason
FROM system_kill_switches WHERE is_active = true;

-- Kill-switch delayed effects (blind window observability)
SELECT metadata->>'job_id', metadata->>'worker_id',
       metadata->>'delay_ms', metadata->>'switch_type', created_at
FROM session_audit_logs
WHERE action = 'KILL_SWITCH_DELAYED_EFFECT'
ORDER BY created_at DESC LIMIT 20;

-- Heartbeat failure events (self-reported by workers)
SELECT resource_id AS job_id, metadata->>'worker_id', metadata->>'reason',
       metadata->>'side_effects', created_at
FROM session_audit_logs
WHERE action = 'LEASE_LOST_ABORT'
ORDER BY created_at DESC LIMIT 20;

-- Storage growth status
SELECT (deleted_counts->>'session_recording_chunks_total')::bigint AS total_chunks,
       (deleted_counts->>'session_recording_chunks_purged')::int AS purged,
       errors
FROM housekeeping_runs ORDER BY ran_at DESC LIMIT 1;

-- Dead-letter classification
SELECT jf.error_pattern, jf.is_retryable, jf.failure_class,
       COUNT(j.id) AS current_count
FROM job_failure_classifications jf
LEFT JOIN session_jobs j ON j.last_error LIKE '%' || jf.error_pattern || '%'
  AND j.status = 'dead_lettered'
  AND j.updated_at > now() - interval '24 hours'
GROUP BY jf.error_pattern, jf.is_retryable, jf.failure_class
ORDER BY current_count DESC;

-- Budget status
SELECT office_id, tokens_used_today, daily_hard_cap,
       ROUND((tokens_used_today::numeric / daily_hard_cap) * 100, 1) AS pct_hard_cap
FROM office_ai_budgets ORDER BY pct_hard_cap DESC;

-- Readiness gate history (last 24h)
SELECT ran_at, overall_passing, failed_count, triggered_by
FROM production_readiness_runs
WHERE ran_at > now() - interval '24 hours'
ORDER BY ran_at DESC;
```
