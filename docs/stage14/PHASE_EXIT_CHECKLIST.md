# PHASE EXIT CHECKLIST — Flaito Rollout
**Uso:** Preencher ao finalizar cada fase de rollout antes de solicitar avanço

---

## Fase ___: ________________

**Data de início da fase:** ___  
**Duração mínima requerida:** ___ horas  
**Data desta avaliação:** ___  
**Avaliador:** ___

---

## Seção 1 — Critérios de Estabilidade Obrigatórios

Execute: `SELECT public.run_readiness_checks('phase_exit');`

| Check | Resultado | Passa? |
|-------|-----------|--------|
| Dead-letter rate < 5% (1h) | ___% | ✅ / ❌ |
| Dead-letter absoluto < 50 (24h) | ___ | ✅ / ❌ |
| Sessão presa máx < 60 min | ___ min | ✅ / ❌ |
| Kill-switches globais = 0 | ___ | ✅ / ❌ |
| Alertas críticos < 5 | ___ | ✅ / ❌ |

**Todos bloqueadores passando?** ✅ / ❌

---

## Seção 2 — Cooldown Verification

```sql
SELECT cooldown_until, cooldown_reason FROM public.rollout_phases WHERE status = 'active';
```

| Item | Verificado? |
|------|-------------|
| Cooldown expirado (se existia) | ✅ / ❌ |
| Nenhuma mudança de budget cap nas últimas 24h | ✅ / ❌ |
| Nenhuma expansão de cohort nas últimas 24h | ✅ / ❌ |
| Nenhum freeze/unfreeze nas últimas 24h | ✅ / ❌ |

---

## Seção 3 — Shadow Mode Review (se aplicável)

Execute: `SELECT public.query_shadow_drift('<feature>');`

| Feature | Sample (total) | Unacceptable Rate | Passes? |
|---------|----------------|-------------------|---------|
| legal_ai_generation | ___ | ___% (< 5%) | ✅ / ❌ |
| medical_ai_generation | ___ | ___% (< 5%) | ✅ / ❌ |

**Reviews pendentes:** ___  
`SELECT jsonb_array_length(public.list_pending_shadow_reviews());`

---

## Seção 4 — Smoke Validations

Execute: `SELECT public.run_all_smoke_validations('<phase_id>', '<office_id>');`

**Blockers encontrados:** ___ (deve ser = 0)

---

## Seção 5 — Rollback Capability

| Item | Verificado? |
|------|-------------|
| Drill de kill-switch realizado nesta fase | ✅ / ❌ |
| ROLLBACK_EFFECT_TIME_MS medido e ≤ 30s | ✅ / ❌ |
| Runbook de rollback revisado | ✅ / ❌ |

```sql
-- Ver timing de rollback mais recente
SELECT rollback_surface, rollback_effect_time_ms, measurement_status
FROM public.rollback_effect_timing ORDER BY trigger_at DESC LIMIT 5;
```

---

## Seção 6 — Abort Triggers

```sql
SELECT trigger_type, COUNT(*), MAX(created_at)
FROM public.rollout_abort_triggers
WHERE created_at >= now() - interval '7 days'
GROUP BY trigger_type;
```

**Abort triggers na fase:** ___  
**Se houver triggers:** Todos foram resolvidos? ✅ / ❌

---

## Seção 7 — Decisão Go/No-Go

| Seção | Resultado |
|-------|-----------|
| 1. Estabilidade obrigatória | ✅ / ❌ |
| 2. Cooldown | ✅ / ❌ |
| 3. Shadow mode | ✅ / ❌ / N/A |
| 4. Smoke validations | ✅ / ❌ |
| 5. Rollback capability | ✅ / ❌ |
| 6. Abort triggers | ✅ / ❌ |

**DECISÃO FINAL:** GO ✅ | NO-GO ❌

---

## Submissão

```sql
-- 1. Submeter review
SELECT public.submit_phase_review('<phase_id>', 'pre_advance', '<checklist_json>'::jsonb, '<notas>', ARRAY['<evidencias>']);

-- 2. Aprovar (mesmo revisor pode aprovar em rollouts internos, mas idealmente outro owner)
SELECT public.decide_phase_review('<review_id>', 'approved', '<notas finais>');

-- 3. Avançar
SELECT public.advance_rollout_phase('<phase_id>', '<review_id>', 'Phase exit checklist aprovado');
```
