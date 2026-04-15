---
phase: 11
plan: 2
wave: 2
title: session-processor Hardening
---

# Plan 02 — session-processor Hardening

## Tasks

### Task 2.1 — Heartbeat loop inside process_job
Add setInterval(25s) to renew lease while job runs.

### Task 2.2 — side_effect_confirmed marking
Mark before external API calls (Deepgram, OpenAI).

### Task 2.3 — Retry classification (retryable vs non-retryable)
NON_RETRYABLE_PREFIXES list + isRetryable() function.
Non-retryable → dead_lettered + health alert.

### Task 2.4 — Chain failure compensation
Chain stage failure → session to 'compensating'.

### Task 2.5 — Idempotency hardening for transcribe_session
Replace Date.now() with aggregate_session_hash-based key.

### Task 2.6 — Adaptive lease duration by job type
TRANSCRIBE=20min, ANALYZE=10min, others=5min.
