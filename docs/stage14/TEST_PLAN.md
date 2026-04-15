# TEST PLAN — Stage 14 Controlled Go-Live
**Versão:** 1.0 | **Stage:** 14

---

## Testes Automatizados (SQL/RPC)

### TA-01: Flag desabilitada bloqueia runtime path

```sql
-- Setup: flag ai_generation = disabled (padrão)

-- Test: check_feature_flag deve retornar 'disabled'
SELECT public.check_feature_flag('ai_generation', NULL, NULL);
-- Esperado: 'disabled'

-- Test: kill-switch deve também retornar 'disabled'
SELECT public.check_feature_flag('legal_ai_generation', NULL, NULL);
-- Esperado: 'disabled'
```
**Pass:** Retorna 'disabled' ✅

---

### TA-02: Flag habilitada permite runtime path

```sql
-- Setup: habilitar ai_generation globalmente
SELECT public.set_feature_flag(
  'ai_generation', 'enabled', 'global', NULL,
  'Teste TA-02', 'tester'
);

-- Test: verificar valor
SELECT public.check_feature_flag('ai_generation', NULL, NULL);
-- Esperado: 'enabled'

-- Cleanup
SELECT public.set_feature_flag(
  'ai_generation', 'disabled', 'global', NULL,
  'Cleanup TA-02', 'tester'
);
```
**Pass:** Retorna 'enabled' durante o teste ✅

---

### TA-03: Flag com escopo de escritório afeta apenas esse escritório

```sql
-- Setup: ai_generation global = disabled
-- Habilitar apenas para escritório-A
SELECT public.set_feature_flag(
  'ai_generation', 'enabled', 'office', '<office_a_uuid>',
  'Teste TA-03 — office scoped', 'tester'
);

-- Test: escritório A deve ver 'enabled'
SELECT public.check_feature_flag('ai_generation', '<office_a_uuid>', NULL);
-- Esperado: 'enabled'

-- Test: escritório B (sem flag) deve ver global = 'disabled'
SELECT public.check_feature_flag('ai_generation', '<office_b_uuid>', NULL);
-- Esperado: 'disabled'
```
**Pass:** Isolamento correto ✅

---

### TA-04: Kill-switch sempre sobrepõe feature flag

```sql
-- Setup: ai_generation flag = enabled
SELECT public.set_feature_flag('ai_generation', 'enabled', 'global', NULL, 'setup TA-04', 'tester');

-- Ativar kill-switch ai_generation
-- (usa insert direto pois activate_kill_switch em global pede confirmação)
UPDATE public.system_kill_switches
SET is_active = true, activated_at = now(), activation_reason = 'Teste TA-04'
WHERE switch_type = 'ai_generation' AND scope = 'global';

-- Test: check_feature_flag deve retornar 'disabled' (kill-switch override)
SELECT public.check_feature_flag('ai_generation', NULL, NULL);
-- Esperado: 'disabled' (mesmo com flag = enabled)

-- Cleanup: desativar kill-switch
UPDATE public.system_kill_switches
SET is_active = false WHERE switch_type = 'ai_generation' AND scope = 'global';
```
**Pass:** Kill-switch overrides flag ✅

---

### TA-05: Shadow mode roteia para shadow_execution_log apenas

```sql
-- Setup: definir shadow_mode_legal = shadow
SELECT public.set_feature_flag('shadow_mode_legal', 'shadow', 'global', NULL, 'Teste TA-05', 'tester');

-- Test: check_feature_flag deve retornar 'shadow'
SELECT public.check_feature_flag('shadow_mode_legal', NULL, NULL);
-- Esperado: 'shadow'

-- Test: registrar execução de shadow
SELECT public.record_shadow_execution(
  'legal_ai_generation',
  NULL, NULL,
  'test_input_hash_ta05',
  'test_shadow_hash',
  512, 1500, NULL,
  'match', NULL, 'completed', NULL,
  '{"test": "TA-05"}'::jsonb
);
-- Esperado: UUID retornado

-- Verificar que registro existe
SELECT id, divergence_class, review_status FROM public.shadow_execution_log
WHERE feature_name = 'legal_ai_generation' ORDER BY created_at DESC LIMIT 1;
```
**Pass:** Registro criado, usuário não exposto ✅

---

### TA-06: Rollback desabilita nova execução imediatamente

```sql
-- Iniciar medição de rollback
SELECT public.record_rollback_timing('session_pipeline', 'kill_switch', 5, NULL, NULL);

-- Ativar kill-switch worker_drain
UPDATE public.system_kill_switches SET is_active = true WHERE switch_type = 'worker_drain';

-- Tentar claim_session_job após kill-switch
SELECT public.claim_session_job('test_worker', 'CPU', 1);
-- Esperado: EXCEPTION 'KILL_SWITCH_ACTIVE: worker_drain is enabled'

-- Cleanup
UPDATE public.system_kill_switches SET is_active = false WHERE switch_type = 'worker_drain';
```
**Pass:** Nova execução bloqueada imediatamente ✅

---

### TA-07: Escrita de flag é auditada

```sql
-- Executar set_feature_flag
SELECT public.set_feature_flag('ocr_auto_suggest', 'enabled', 'global', NULL, 'Teste TA-07 auditoria', 'tester');

-- Verificar auditoria
SELECT flag_name, old_value, new_value, was_rejected, changed_at
FROM public.feature_flag_audit_log
WHERE flag_name = 'ocr_auto_suggest'
ORDER BY changed_at DESC LIMIT 1;
-- Esperado: registro com new_value='enabled', was_rejected=false
```
**Pass:** Auditoria registrada ✅

---

### TA-08: Queries de monitoramento executam em < 3 segundos

```sql
-- Medir tempo de execução do dashboard
EXPLAIN ANALYZE SELECT public.get_rollout_monitoring_dashboard();
-- Esperado: execution time < 3000ms

-- Medir query de shadow drift
EXPLAIN ANALYZE SELECT public.query_shadow_drift('legal_ai_generation');
-- Esperado: < 3000ms
```
**Pass:** Tempo < 3s ✅

---

### TA-09: Abort trigger bloqueia avanço de fase

```sql
-- Acionar abort trigger em fase ativa
SELECT public.block_rollout_phase(
  '<phase_id>',
  'CROSS_TENANT_VIOLATION',
  'Cross-tenant data detected in test scenario',
  '{"tenant_a": "uuid1", "tenant_b": "uuid2"}'::jsonb
);

-- Tentar avançar fase (deve falhar)
SELECT public.advance_rollout_phase('<phase_id>', '<review_id>');
-- Esperado: EXCEPTION 'PHASE_NOT_ACTIVE'
```
**Pass:** Avanço bloqueado ✅

---

### TA-10: Operator safe mode bloqueia ações destrutivas

```sql
-- Ativar safe mode
SELECT public.enable_operator_safe_mode('Teste TA-10 — safe mode block');

-- Verificar que safe mode está ativo
SELECT public.check_operator_safe_mode(NULL);
-- Esperado: true

-- Registrar ação bloqueada
SELECT public.log_safe_mode_blocked_action(
  'DELETE_CASE',
  '{"case_id": "test-uuid"}'::jsonb,
  NULL
);

-- Verificar log de bloqueio
SELECT attempted_action, outcome FROM public.operator_safe_mode_log
WHERE outcome = 'blocked' ORDER BY attempted_at DESC LIMIT 1;
-- Esperado: attempted_action='DELETE_CASE', outcome='blocked'

-- Cleanup
SELECT public.disable_operator_safe_mode('Cleanup TA-10');
```
**Pass:** Ação destruitva bloqueada e auditada ✅

---

### TA-11: Thrashing protection — cooldown de 60 segundos

```sql
-- Alterar flag
SELECT public.set_feature_flag('ocr_auto_suggest', 'enabled', 'global', NULL, 'First change', 'tester');

-- Tentar alterar imediatamente (sem esperar 60s)
SELECT public.set_feature_flag('ocr_auto_suggest', 'disabled', 'global', NULL, 'Second change too fast', 'tester');
-- Esperado: ok=false, rejected=true, reason='THRASHING_COOLDOWN'

-- Verificar que rejeição foi auditada
SELECT was_rejected, reject_reason FROM public.feature_flag_audit_log
WHERE flag_name = 'ocr_auto_suggest' AND was_rejected = true ORDER BY changed_at DESC LIMIT 1;
```
**Pass:** Rejeição retornada e auditada ✅

---

## Testes Manuais

### TM-01: Habilitar escritório piloto
1. Criar escritório de teste no sistema
2. Executar: `SELECT public.set_feature_flag('rollout_pilot_office', 'enabled', 'office', '<office_id>', 'Habilitar piloto', 'owner');`
3. Verificar: `SELECT public.check_feature_flag('rollout_pilot_office', '<office_id>', NULL);` → 'enabled'
4. Verificar que outros escritórios ainda retornam 'disabled'
5. Verificar auditoria gerada

### TM-02: Desabilitar feature durante fase
1. Habilitar `legal_ai_generation` para um escritório
2. Verificar que juridicamente funciona (mock)
3. Executar: `SELECT public.set_feature_flag('legal_ai_generation', 'disabled', 'office', '<id>', 'Desabilitando mid-phase', 'owner');`
4. Verificar bloqueio imediato
5. Verificar auditoria

### TM-03: Verificar rollback gracioso
1. Criar 3 session_jobs em estado 'queued'
2. Ativar kill-switch worker_drain
3. Tentar `claim_session_job` → deve falhar
4. Verificar que jobs existentes em 'claimed' continuam até expirar lease
5. Medir timing com `record_rollback_timing`

### TM-04: Drill de kill-switch
1. Executar: `SELECT public.execute_global_freeze('Kill-switch drill — não é emergência real', 'DRILL-001');`
2. Verificar que todas as 5 etapas foram executadas
3. Verificar tempo total < 30 segundos
4. Executar `get_freeze_status()` para confirmar estado
5. Fazer unfreeze manual

### TM-05: Revisão de shadow mode
1. Registrar 10 execuções via `record_shadow_execution` com divergência variada
2. Consultar `query_shadow_drift('legal_ai_generation')`
3. Verificar métricas: divergence_trend_24h, unacceptable_rate_trend, last_20_sample_quality
4. Aprovar/rejeitar via `approve_shadow_execution`

### TM-06: Review formal de fase + avanço
1. Submeter review: `submit_phase_review('<phase_id>', 'pre_advance', '[]'::jsonb, 'Teste TM-06')`
2. Aprovar: `decide_phase_review('<review_id>', 'approved', 'Teste')`
3. **Não avançar** — apenas verificar que os gates estão configurados corretamente
4. Verificar que sem review aprovado, `advance_rollout_phase` falha

### TM-07: Sequência de freeze global
- Mesma que TM-04, mas documentar IDs e timestamps para auditoria completa
- Verificar que notificação a operadores é um passo manual documentado

### TM-08: Operator safe mode durante incidente simulado
1. `enable_operator_safe_mode('Incidente simulado TM-08')`
2. Tentar ação bloqueada → verificar rejeição
3. Executar ação permitida (kill-switch, read-only) → deve funcionar
4. Verificar log de ações bloqueadas
5. `disable_operator_safe_mode('Resolução simulada')`

---

## Critérios de Done

| Critério | Test | Status |
|----------|------|--------|
| Flag desabilitada bloqueia runtime | TA-01 | ⬜ |
| Flag habilitada permite runtime | TA-02 | ⬜ |
| Escopo de escritório funciona | TA-03 | ⬜ |
| Kill-switch overrides flag | TA-04 | ⬜ |
| Shadow mode → shadow log only | TA-05 | ⬜ |
| Rollback bloqueia nova execução | TA-06 | ⬜ |
| Flag write é auditada | TA-07 | ⬜ |
| Monitoring < 3s | TA-08 | ⬜ |
| Abort trigger bloqueia avanço | TA-09 | ⬜ |
| Safe mode bloqueia destrutivos | TA-10 | ⬜ |
| Thrashing protection funciona | TA-11 | ⬜ |
| Piloto de escritório habilitado | TM-01 | ⬜ |
| Desabilitar feature mid-phase | TM-02 | ⬜ |
| Rollback gracioso verificado | TM-03 | ⬜ |
| Kill-switch drill realizado | TM-04 | ⬜ |
| Shadow mode review validado | TM-05 | ⬜ |
| Fase review + avanço testado | TM-06 | ⬜ |
| Freeze global sequência | TM-07 | ⬜ |
| Safe mode durante incidente | TM-08 | ⬜ |
