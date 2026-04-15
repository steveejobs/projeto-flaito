# LIVE INCIDENT PLAYBOOKS — Flaito Stage 14
**Versão:** 1.0 | **Stage:** 14 | **Ambiente:** Produção

---

## Playbook 1 — Degradação Específica de Escritório

**Trigger:** Taxa de dead-letter > 10% para um escritório específico, ou sessões travadas > 30 min em um escritório.

**Tempo alvo de detecção:** < 5 minutos  
**Tempo alvo de resolução:** < 30 minutos

### Diagnóstico

```sql
-- 1. Identificar escritório afetado
SELECT office_id, COUNT(*) as dead_lettered_count
FROM public.session_jobs
WHERE status = 'dead_lettered'
  AND updated_at >= now() - INTERVAL '1 hour'
GROUP BY office_id
ORDER BY dead_lettered_count DESC;

-- 2. Ver detalhes de falhas
SELECT id, session_id, error_type, error_message, attempt_count, updated_at
FROM public.session_jobs
WHERE office_id = '<office_uuid>'
  AND status = 'dead_lettered'
ORDER BY updated_at DESC LIMIT 10;

-- 3. Ver sessões travadas
SELECT s.id, s.status, s.updated_at, j.worker_id, j.lease_expires_at
FROM public.sessions s
LEFT JOIN public.session_jobs j ON j.session_id = s.id AND j.status = 'claimed'
WHERE s.office_id = '<office_uuid>'
  AND s.status IN ('processing', 'transcribed')
  AND s.updated_at < now() - INTERVAL '30 minutes';
```

### Árvore de Decisão

```
dead_letter_rate > 10% em escritório específico?
  └─ Sim → Qual o error_type?
       ├─ TIMEOUT → Verificar worker heartbeats, considerar restart do worker
       ├─ BUDGET_EXCEEDED → Verificar AI budget do escritório
       ├─ KILL_SWITCH_ACTIVE → Kill-switch ativo? Desativar se intencional
       └─ PERMISSION_DENIED / RLS → Problema de permissão — escalar para engenharia
```

### Rollback

```sql
-- Opção 1: Bloquear processamento só para esse escritório
SELECT public.activate_kill_switch(
  'session_processing', 'office', '<office_uuid>',
  'Degradação específica — investigando dead-letter rate elevada'
);

-- Opção 2: Bloquear fase de rollout se escritório é piloto
SELECT public.block_rollout_phase(
  '<phase_id>', 'CERTIFICATION_INCONSISTENCY',
  'office_degradation_detected', 
  '{"office_id": "<uuid>", "dead_letter_rate": "15%"}'::jsonb
);
```

### Estado Final Esperado
- Dead-letter rate < 5% para o escritório
- Sessões travadas = 0
- Kill-switch desativado após diagnóstico
- Post-mortem criado

### Anti-Padrões
- ❌ Reprocessar todos os jobs sem entender a causa raiz
- ❌ Desativar kill-switch antes de confirmar resolução
- ❌ Não registrar motivo no kill-switch

### Escalação
Se a degradação persistir > 15 minutos: escalar para engenharia de plataforma.

---

## Playbook 2 — Runaway AI Spend (Gasto Descontrolado de IA)

**Trigger:** Budget AI de um escritório > 90% consumido em < 50% do dia, ou custo total/hora > 3x média.

**Tempo alvo de detecção:** < 3 minutos  
**Tempo alvo de resolução:** < 10 minutos

### Diagnóstico

```sql
-- 1. Identificar consumo por escritório (hoje)
SELECT
  office_id,
  used_today_usd,
  daily_limit_usd,
  ROUND(used_today_usd / daily_limit_usd * 100, 1) AS pct_used,
  last_reset_at
FROM public.ai_budget_ledger
ORDER BY pct_used DESC
LIMIT 10;

-- 2. Ver jobs de IA gerados nas últimas 2h
SELECT
  office_id,
  COUNT(*) AS ai_jobs,
  model_id,
  AVG(tokens_used) AS avg_tokens
FROM public.session_ai_outputs
WHERE created_at >= now() - INTERVAL '2 hours'
GROUP BY office_id, model_id
ORDER BY ai_jobs DESC;
```

### Árvore de Decisão

```
Budget > 90% consumido?
  └─ Sim → É 1 escritório ou múltiplos?
       ├─ 1 escritório → Ativar kill-switch de ai_generation para esse escritório
       └─ Múltiplos → Ativar kill-switch global ai_generation (emergência)
```

### Rollback

```sql
-- Para escritório específico
SELECT public.activate_kill_switch(
  'ai_generation', 'office', '<office_uuid>',
  'Runaway AI spend — budget > 90% antes de 50% do dia'
);

-- Para emergência global
SELECT public.execute_global_freeze(
  'Runaway AI spend global detectado — múltiplos escritórios',
  'INC-SPEND-001'
);
```

### Estado Final Esperado
- AI generation bloqueada para escritório(s) afetado(s)
- Budget não excedido além do limite
- Análise de causa raiz: job duplicado? Loop? Erro de configuração?

### Anti-Padrões
- ❌ Aguardar o budget zerar antes de agir
- ❌ Aumentar o limite de budget sem entender a causa

### Escalação
Se múltiplos escritórios afetados ou gasto anômalo não identificado: freeze global + engenharia.

---

## Playbook 3 — Job Storm Durante Piloto (Tempestade de Jobs)

**Trigger:** Fila de jobs cresce > 5x a taxa normal em < 10 minutos. Queue latency > 2 minutos.

**Tempo alvo de detecção:** < 5 minutos  
**Tempo alvo de resolução:** < 20 minutos

### Diagnóstico

```sql
-- 1. Tamanho atual da fila
SELECT
  status,
  COUNT(*) AS job_count,
  MIN(scheduled_at) AS oldest_job,
  MAX(scheduled_at) AS newest_job
FROM public.session_jobs
WHERE status IN ('queued', 'claimed', 'failed')
GROUP BY status;

-- 2. Origem dos jobs (por escritório)
SELECT office_id, COUNT(*) AS jobs_last_30m
FROM public.session_jobs
WHERE created_at >= now() - INTERVAL '30 minutes'
GROUP BY office_id
ORDER BY jobs_last_30m DESC;

-- 3. Workers ativos
SELECT worker_id, COUNT(*) AS claimed_jobs
FROM public.session_jobs
WHERE status = 'claimed' AND lease_expires_at > now()
GROUP BY worker_id;
```

### Árvore de Decisão

```
Fila crescendo > 5x?
  └─ Sim → 1 escritório gerando ou múltiplos?
       ├─ 1 escritório → Bloquear session_processing para esse escritório
       └─ Múltiplos → Ativar worker_drain global para reduzir pressão
```

### Rollback

```sql
-- Drenar novos jobs (workers param de aceitar)
SELECT public.activate_kill_switch(
  'worker_drain', 'global', NULL,
  'Job storm durante piloto — queue latency > 2min'
);

-- Opcional: bloquear escritório específico
SELECT public.activate_kill_switch(
  'session_processing', 'office', '<office_uuid>',
  'Job storm originado neste escritório'
);
```

### Estado Final Esperado
- Fila drena gradualmente (jobs in-flight completam)
- Worker-drain desativado quando fila < 20 jobs pendentes
- Causa identificada (webhook loop? reprocessamento manual? sessão infinita?)

### Anti-Padrões
- ❌ Deletar jobs da fila sem analisar (perda de dados de sessão)
- ❌ Reiniciar workers durante job storm (piora a situação)

---

## Playbook 4 — Anomalia na Certificação Médica

**Trigger:** Relatório médico oficial gerado sem assinatura digital válida, ou certificação aprovada por usuário sem CRM ativo.

**Tempo alvo de detecção:** < 2 minutos (alerta automático)  
**Tempo alvo de resolução:** < 15 minutos

### Diagnóstico

```sql
-- 1. Relatórios aprovados no último 1h
SELECT
  r.id,
  r.session_id,
  r.approved_by,
  r.approved_at,
  r.signature_present,
  u.email AS approver_email
FROM public.medical_report_reviews r
JOIN auth.users u ON u.id = r.approved_by
WHERE r.approved_at >= now() - INTERVAL '1 hour'
  AND r.final_status = 'approved';

-- 2. Verificar CRM dos aprovadores
SELECT
  r.approved_by,
  mp.crm_number,
  mp.crm_state,
  mp.is_active
FROM public.medical_report_reviews r
JOIN public.medical_professional_profiles mp ON mp.user_id = r.approved_by
WHERE r.approved_at >= now() - INTERVAL '24 hours'
  AND (mp.crm_number IS NULL OR mp.is_active = false);
```

### Árvore de Decisão

```
Certificação sem assinatura válida?
  └─ Sim → Bloquear medical_certification_flow imediatamente
       └─ Marcar relatórios suspeitos como 'invalidated'
       └─ Notificar médicos responsáveis

CRM inativo aprovando?
  └─ Sim → ABORT TRIGGER: CERTIFICATION_INCONSISTENCY
       └─ Bloquear fase de rollout
       └─ Escalar para compliance
```

### Rollback

```sql
-- Bloquear certificação
SELECT public.set_feature_flag(
  'medical_certification_flow', 'disabled', 'global', NULL,
  'Anomalia de certificação médica detectada — investigação em andamento',
  'incident_response'
);

-- Abort trigger: bloquear fase
SELECT public.block_rollout_phase(
  '<phase_id>',
  'CERTIFICATION_INCONSISTENCY',
  'Medical certification approved by user with inactive CRM',
  '{"report_id": "<uuid>", "approver_id": "<uuid>"}'::jsonb
);
```

### Estado Final Esperado
- Certificações novas bloqueadas
- Relatórios inválidos marcados e segregados
- Auditoria completa de todos os relatórios da janela de incidente
- Conformidade notificada

### Anti-Padrões
- ❌ Ignorar e esperar próxima aprovação "correta"
- ❌ Deletar relatórios em vez de invalidar e auditar

### Escalação
Qualquer certificação sem CRM válido é escalada imediatamente para compliance médico.

---

## Playbook 5 — Uso Indevido de Voz / Execução Não Intencional

**Trigger:** Ação crítica executada via voz sem confirmação explícita, ou múltiplas confirmações de voz em < 30 segundos.

**Tempo alvo de detecção:** < 1 minuto  
**Tempo alvo de resolução:** < 10 minutos

### Diagnóstico

```sql
-- 1. Ações de voz críticas recentes
SELECT
  va.id,
  va.session_id,
  va.action_type,
  va.confirmation_required,
  va.confirmation_received,
  va.executed_at,
  va.executed_by
FROM public.voice_action_logs va
WHERE va.executed_at >= now() - INTERVAL '30 minutes'
  AND va.action_type IN ('delete_case', 'finalize_medical', 'approve_document', 'send_external')
ORDER BY va.executed_at DESC;

-- 2. Padrão de confirmações rápidas (suspeito)
SELECT session_id, COUNT(*) AS confirmations_30s
FROM public.voice_action_logs
WHERE executed_at >= now() - INTERVAL '30 seconds'
GROUP BY session_id
HAVING COUNT(*) > 2;
```

### Árvore de Decisão

```
Ação crítica sem confirmação válida?
  └─ Sim → Ativar kill-switch voice_actions imediatamente

Replay attack (múltiplas confirmações)?
  └─ Sim → Invalidar confirmation_token da sessão
       └─ Bloquear sesssão para análise

Ação destrutiva executada?
  └─ Sim → ABORT TRIGGER: UNAUTHORIZED_DESTRUCTIVE_ACTION
       └─ Bloquear fase de rollout
```

### Rollback

```sql
-- Bloquear ações de voz globalmente
SELECT public.activate_kill_switch(
  'voice_actions', 'global', NULL,
  'Voice misuse detected — unauthorized critical action execution'
);

-- Desabilitar flag de voz crítica
SELECT public.set_feature_flag(
  'voice_critical_actions', 'disabled', 'global', NULL,
  'Desabilitado por incidente de voz — Playbook 5',
  'incident_response'
);
```

### Estado Final Esperado
- Voice actions bloqueadas globalmente
- Sessão suspeita isolada e auditada
- Ação inadvertida documentada e (se possível) revertida
- Review de todos os confirmation_tokens da janela de incidente

### Anti-Padrões
- ❌ Desativar voz apenas para a sessão afetada (outras sessões podem estar comprometidas)
- ❌ Não invalidar tokens de confirmação pendentes

---

## Playbook 6 — Rollback de Rollout Mid-Phase

**Trigger:** Decisão de rolar de volta para a fase anterior durante uma fase ativa de rollout.

**Tempo alvo de detecção:** Decisão manual (normalmente após go/no-go revisão)  
**Tempo alvo de resolução:** < 60 minutos

### Diagnóstico

```sql
-- 1. Estado atual da fase
SELECT * FROM public.rollout_phases WHERE status = 'active';

-- 2. Escritórios na fase atual
SELECT id, phase_number, office_cohort, go_nogo_verdict
FROM public.rollout_phases WHERE status = 'active';

-- 3. Verificar abort triggers recentes
SELECT * FROM public.rollout_abort_triggers ORDER BY created_at DESC LIMIT 10;
```

### Árvore de Decisão

```
Por que rollar de volta?
  ├─ Abort trigger (CROSS_TENANT, CERTIFICATION, UNAUTHORIZED, DUPLICATE) →
  │    Fase já deve estar BLOCKED → Confirmar e executar rollback
  ├─ Métricas ultrapassando thresholds →
  │    Review formal + decisão → execute_global_freeze se urgente
  └─ Decisão estratégica →
       Freeze opcional + submit_phase_review com decisão 'rejected'
```

### Rollback

```sql
-- Congelar antes de reverter (se não já congelado)
SELECT public.execute_global_freeze(
  'Rollback mid-phase aprovado — revertendo para fase anterior',
  'INC-ROLLBACK-001'
);

-- Reverter fase atual para 'rolled_back'
UPDATE public.rollout_phases
SET status         = 'rolled_back',
    rolled_back_at = now()
WHERE status = 'active';

-- Reativar fase anterior
UPDATE public.rollout_phases
SET status          = 'active',
    actual_start_at = now()
WHERE phase_number = (
  SELECT rollback_target_phase FROM public.rollout_phases
  WHERE status = 'rolled_back'
  ORDER BY rolled_back_at DESC LIMIT 1
);

-- Desabilitar flags da fase revertida
SELECT public.set_feature_flag(
  'rollout_phase_2', 'disabled', 'global', NULL,
  'Rollback mid-phase — revertendo para fase 1', 'incident_response'
);
```

### Estado Final Esperado
- Fase anterior ativa com limites anteriores
- Features da fase revertida desabilitadas
- Cooldown de 24h aplicado antes de tentar avançar novamente
- Post-mortem da fase completado

### Anti-Padrões
- ❌ Fazer rollback sem freeze primeiro (janela de inconsistência)
- ❌ Não aplicar cooldown após rollback (tentar avançar muito cedo)
- ❌ Não notificar escritórios afetados pelo rollback

### Escalação
Qualquer rollback requer notificação a todos os escritórios na fase afetada.
