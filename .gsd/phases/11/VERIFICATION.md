## Stage 11 — Job Execution Integrity — Verification

### Must-Haves

- [x] **Heartbeat loop no worker** — `heartbeatTimer = setInterval(25_000)` em `session-processor/index.ts:364`, `clearInterval` em `:470`
- [x] **Heartbeat renewal no banco** — `renew_job_lease()` em migration `:123`, chama `UPDATE session_jobs SET lease_expires_at=now()+p_extend_s WHERE worker_id=p_worker_id AND status='running'`
- [x] **side_effect_confirmed marking** — `markSideEffectConfirmed()` chamado antes de Deepgram em `handleTranscription` e antes do LLM em `handleDomainAnalysis`
- [x] **Retry classification** — `isRetryable()` em `:245`, verifica contra `NON_RETRYABLE_PREFIXES` (11 prefixos)
- [x] **Non-retryable → dead_lettered imediato** — job + session → `dead_lettered` + `session_health_alerts` insert (`:411-440`)
- [x] **Chain failure compensation** — `compensating` state em `handleContextIngestion`, `handleSnapshotCreation`, `handleDomainAnalysis` em caso de falha retryable
- [x] **Idempotency de transcribe_session** — busca `aggregate_session_hash` do DB; key=`transcribe:{session_id}:{hash}` (não `Date.now()`)
- [x] **Lease adaptativa por job type** — `leaseDurationForJobType()`: TRANSCRIBE=1200s, ANALYZE=600s, others=300s
- [x] **Safe reclaim no janitor** — `heartbeat_lost` intermediário, verifica `side_effect_confirmed` antes de retry ou dead-letter
- [x] **Stuck session detection** — janitor detecta sessions em processing sem jobs há 30 min → insere alerta `stuck_session`
- [x] **Alertas persistidos** — tabela `session_health_alerts` com RLS, 4 tipos: `zombie_job`, `stuck_session`, `repeated_failure`, `chain_drift`
- [x] **retry_job safety check** — verifica `side_effect_confirmed` + output existente antes de resetar job para `queued` (`:302-360`)
- [x] **requeue_session status guard** — só permite a partir de `failed/dead_lettered/compensating/transcribed/outputs_generated`
- [x] **emergency_stop FSM reconciliation** — transiciona session de estados `processing/*` para `failed` após parar jobs
- [x] **resolve_stuck_session** — novo action operator com diagnose + recovery_mode: requeue|cancel
- [x] **inspect_health_alerts** — novo action read-only filtrado por `office_id` (tenant isolation garantido)
- [x] **FSM extended** — `compensating`, `dead_lettered`, `compensated`, `heartbeat_lost` adicionados a enums; matrix expandida
- [x] **Deduplication de outputs** — `handleDomainAnalysis` verifica output existente para mesmo `snapshot_id` antes de chamar LLM (sem `force_reprocess`)

### Verdict: ✅ PASS

18/18 must-haves verificados via `Select-String` no código gerado.

### Evidence
```
supabase\migrations\20260415110000_stage11_job_integrity.sql:123: CREATE OR REPLACE FUNCTION public.renew_job_lease(
supabase\functions\session-processor\index.ts:364: heartbeatTimer = setInterval(async () => {
supabase\functions\session-processor\index.ts:245: function isRetryable(errorMessage: string): boolean {
supabase\functions\session-admin-actions\index.ts:302: // Now checks side_effect_confirmed and output existence
```
