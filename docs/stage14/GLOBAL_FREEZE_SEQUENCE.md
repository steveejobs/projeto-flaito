# GLOBAL FREEZE SEQUENCE — Flaito Production Rollout
**Versão:** 1.0 | **Stage:** 14 | **Criticidade:** P0

---

## Objetivo

Interromper toda a atividade de execução da plataforma em produção de forma auditável,
reversível e em menos de **30 segundos**.

---

## Pré-requisitos

- Acesso como **OWNER** ou **ADMIN** do escritório no painel
- Token de autenticação válido
- Acesso ao banco de dados via Supabase Dashboard ou RPC CLI

---

## Sequência de Execução (via RPC — mais rápido)

Execute **uma única chamada** que realiza todos os passos em ordem:

```sql
SELECT public.execute_global_freeze(
  'Razão da emergência aqui',  -- obrigatório: motivo específico
  'INC-2026-001'               -- opcional: ID do incidente externo
);
```

**Alvo:** ≤ 30 segundos do início ao fim.

---

## Passos Internos da Sequência (executados em ordem pelo RPC)

| Step | Ação | Tipo | Efeito Imediato |
|------|------|------|-----------------|
| 1 | `kill_switch(worker_drain, global)` | Kill-switch | Workers param de aceitar novos jobs |
| 2 | `kill_switch(ai_generation, global)` | Kill-switch | Toda geração de IA bloqueada |
| 3 | `kill_switch(voice_actions, global)` | Kill-switch | Comandos de voz bloqueados |
| 4 | `flag(operator_destructive_actions, disabled)` | Feature flag | Ações destrutivas desabilitadas no backend |
| 5 | `enable_operator_safe_mode(global)` | Safe mode | Modo restrito ativado para todos os operadores |
| 6 | Log de auditoria completo | Auditoria | Operador + timestamp + motivo registrados |

> **Step 7 (notificação de operadores ativos):** MANUAL. Ver seção abaixo.

---

## Step 7 — Notificação Manual de Operadores

Após executar o freeze, notifique imediatamente:

1. **Canal de incidentes** (Slack/WhatsApp/etc.) com:
   - ID do freeze (retornado pelo RPC)
   - Motivo
   - Timestamp de início
   - Operador responsável

2. **Verificação de confirmação:** Peça confirmação de cada operador ativo de que
   recebeu a notificação.

3. **Status público** (se aplicável): Atualizar página de status.

---

## Verificação do Freeze

```sql
SELECT public.get_freeze_status();
```

Resultado esperado:
```json
{
  "any_freeze_active": true,
  "active_global_kill_switches": 3,
  "operator_safe_mode": { "is_active": true }
}
```

---

## Como Verificar Execuções em Andamento

Após o freeze, verifique se há jobs ainda rodando:

```sql
-- Jobs ainda em execução (devem zerar em max 5 minutos)
SELECT id, status, worker_id, lease_expires_at
FROM public.session_jobs
WHERE status IN ('claimed', 'processing')
ORDER BY lease_expires_at ASC;

-- Sessões ainda processando
SELECT id, status, updated_at
FROM public.sessions
WHERE status IN ('processing', 'transcribed', 'context_ready')
ORDER BY updated_at ASC;
```

---

## Medição do Efeito do Rollback

Use `record_rollback_timing` para medir o tempo até o sistema entrar em modo estável:

```sql
-- Iniciar medição
SELECT public.record_rollback_timing(
  'session_pipeline',  -- superfície
  'kill_switch',       -- método
  10,                  -- jobs em andamento no momento do trigger
  '<uuid-do-kill-switch>'
);

-- Quando sistema estabilizar:
SELECT public.complete_rollback_timing('<timing-id>');
```

**Meta:** `rollback_effect_time_ms` ≤ 30.000ms (30 segundos).

---

## Desfazer o Freeze (Unfreeze)

Somente após o incidente estar resolvido e os go/no-go gates serem passados novamente.

Executar **individualmente e com confirmação de equipe** para cada kill-switch:

```sql
-- Desativar cada kill-switch (requer token de confirmação)
SELECT public.activate_kill_switch('worker_drain', 'global', NULL, 'Freeze encerrado — incidente INC-2026-001 resolvido');
-- Confirmar com token retornado

-- Reativar operações normais
SELECT public.disable_operator_safe_mode('Incidente INC-2026-001 resolvido');

-- Re-habilitar flags conforme fase de rollout
SELECT public.set_feature_flag('operator_destructive_actions', 'disabled', 'global', NULL, 'Restaurando pós-freeze — manter desabilitado até revisão');
```

---

## Trilha de Auditoria Obrigatória

O freeze é inválido sem:
- [ ] ID do freeze (gerado pelo `execute_global_freeze`)
- [ ] Operador identificado (`auth.uid()`)
- [ ] Timestamp de início e fim
- [ ] Motivo documentado
- [ ] Confirmação de notificação aos operadores ativos
- [ ] Medição de `ROLLBACK_EFFECT_TIME_MS` (via `rollback_effect_timing`)

---

## Anti-Padrões

| ❌ Proibido | Por quê |
|-------------|---------|
| Ativar kill-switches um de cada vez manualmente | Demora mais, janela de inconsistência |
| Fazer freeze sem registrar motivo | Auditoria incompleta |
| Desativar freeze sem revisão formal | Rollout continua sem gates |
| Notificar operadores depois do freeze encerrado | Pode haver ações paralelas não coordenadas |
| Ignorar medição de `ROLLBACK_EFFECT_TIME_MS` | Métrica de SLO não cumprida |
