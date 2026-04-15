---
phase: 11
plan: 3
wave: 3
title: session-admin-actions Hardening
---

# Plan 03 — session-admin-actions Hardening

## Tasks

### Task 3.1 — retry_job: side-effect safety check
Block retry if side_effect_confirmed=true AND output already exists.

### Task 3.2 — requeue_session: freshness + FSM validation
Only allow requeue from safe statuses (failed, dead_lettered, outputs_generated).

### Task 3.3 — emergency_stop: FSM reconciliation
Transition session to 'failed' if in processing/transcribed state after stopping jobs.
Resolve open health alerts.

### Task 3.4 — New action: resolve_stuck_session
Diagnose + recover stuck sessions (create new job or cancel chain).

### Task 3.5 — New action: inspect_health_alerts
Return open alerts for operator's office.
