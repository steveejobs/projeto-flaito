---
phase: 24
plan: 2
wave: 1
---

# Plan 24-2: Backend Ingestion Actions

## Goal
Implement the Edge Function to handle chunk uploads and meeting finalization.

## Tasks
1. [ ] create `supabase/functions/meeting-processor/index.ts`
2. [ ] implement `ingest_chunk` action
3. [ ] implement `finalize_recording` action
4. [ ] implement basic error handling and logging

## Verification
- deployment (manual via user or check if code is valid)
- test with mock request (if possible)
