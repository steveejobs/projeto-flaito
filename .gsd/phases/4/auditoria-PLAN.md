---
phase: 4
plan: auditoria-tecnica
wave: 1
gap_closure: false
---

# Plan: Auditoria e Estabilização (Milestone 2)

## Context
Milestone 2 focuses on auditing the Medical and Legal modules and stress-testing the notification worker to ensure system stability and production readiness.

## Objective
To complete technical audits for core modules and ensure the notification worker can handle expected loads.

## Tasks

<task>
1. **Auditar Módulo Médico**
   - Review the medical agent analysis system again for edge cases.
   - Run sample data through `medical-agent-analysis` and verify AI responses format as JSON properly in edge cases.
   - Check error handling, missing variables, and resilience.
</task>
<verify>
Check if `medical-agent` correctly handles missing required fields gracefully and logs errors properly.
</verify>

<task>
2. **Auditar Módulo Legal**
   - Review `nija-generate-piece` and `lexos-chat-assistant`.
   - Ensure RAG fallback mechanisms don't crash when retrieval fails.
   - Check if context windows are managed properly to avoid prompt length limits.
</task>
<verify>
Confirm that `nija-generate-piece` truncates excessively long RAG input contexts before sending to Gemini.
</verify>

<task>
3. **Testes do Worker de Notificações**
   - Inspect the Notification Worker (Scheduler) logic to verify it scales without blocking.
   - Check connection un-pooling or memory leaks in long-running Edge Functions.
</task>
<verify>
Verify worker includes batch processing or paginated queries.
</verify>
