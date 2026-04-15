---
phase: 11
plan: 1
wave: 1
title: Schema & Database Layer
---

# Plan 01 — Schema & Database Layer

## Tasks

### Task 1.1 — Migration: stage11_job_integrity.sql
Create migration with:
- New enum values (heartbeat_lost, compensated, compensating, dead_lettered)
- New columns on session_jobs (last_heartbeat_at, side_effect_confirmed, reclaim_attempts, etc.)
- Table: session_health_alerts
- Table: job_failure_classifications (with seed data)
- Function: renew_job_lease()
- Function: session_job_janitor() (hardened)
- FSM extension (compensating, dead_lettered paths)
- Indexes

### Task 1.2 — FSM: extend transition_session_fsm
Add new transitions to the FSM matrix via the migration.
