---
phase: 24
plan: 3
wave: 2
---

# Plan 24-3: Resilient Recording Hook and UI

## Goal
Implement a robust frontend recording logic that handles network failures and browser crashes.

## Tasks
1. [ ] create `src/hooks/useMeetingRecorder.ts`
    - use `MediaRecorder` with `timeslice`.
    - implement `IndexedDB` persistence for unsynced chunks.
    - implement background upload loop with retries.
2. [ ] create `src/modules/legal/meetings/pages/MeetingRecorder.tsx`
    - UI with timer, status (syncing, offline, etc.).
    - controls (Stop, Pause).
3. [ ] integrate with `meeting-processor` Edge Function.

## Verification
- mock browser crash simulation (manual).
- check IndexedDB storage.
- verify chunks reach the backend.
