# GO/NO-GO REVIEW TEMPLATE — Flaito Rollout Phase Advancement
**Stage:** 14 | **Uso:** Preencher antes de avançar qualquer fase de rollout

---

## Identificação da Revisão

| Campo | Valor |
|-------|-------|
| **Fase Atual (número)** | `___` |
| **Fase sendo avaliada** | `___` |
| **Data da revisão** | `___` |
| **Revisor responsável** | `___` |
| **ID da revisão (RPC)** | `___` |
| **Duração da fase ativa** | `___ horas` |
| **Cooldown satisfeito?** | Sim / Não |

---

## Critérios de Verificação — Bloqueadores (todos devem ser ✅)

| # | Critério | Valor Observado | Limite | Status |
|---|----------|-----------------|--------|--------|
| 1 | Dead-letter rate (1h) | ___% | < 5% | ✅ / ❌ |
| 2 | Dead-letter absoluto (24h) | ___ | < 50 | ✅ / ❌ |
| 3 | Sessão presa máxima (min) | ___ min | < 60 min | ✅ / ❌ |
| 4 | Kill-switches globais ativos | ___ | = 0 | ✅ / ❌ |
| 5 | Alertas críticos abertos | ___ | < 5 | ✅ / ❌ |
| 6 | Abort triggers nas últimas 24h | ___ | = 0 | ✅ / ❌ |

---

## Critérios de Shadow Mode (se aplicável)

| # | Feature | Unacceptable Rate | Divergence Trend 24h | Status |
|---|---------|-------------------|----------------------|--------|
| 1 | legal_ai_generation | ___% | ___% | ✅ / ❌ |
| 2 | medical_ai_generation | ___% | ___% | ✅ / ❌ |
| 3 | ocr_auto_suggest | ___% | ___% | ✅ / ❌ |

Limites: unacceptable_rate < 5%, divergence_trend < 20%

---

## Smoke Validations (9 flags críticas)

Execute: `SELECT public.run_all_smoke_validations('<phase_id>', '<office_id>');`

| Flag | Valor Esperado | Observado | Match? |
|------|----------------|-----------|--------|
| ai_generation | disabled | ___ | ✅ / ❌ |
| legal_ai_generation | ___ | ___ | ✅ / ❌ |
| medical_ai_generation | ___ | ___ | ✅ / ❌ |
| medical_certification_flow | ___ | ___ | ✅ / ❌ |
| voice_critical_actions | ___ | ___ | ✅ / ❌ |
| ocr_auto_suggest | ___ | ___ | ✅ / ❌ |
| operator_destructive_actions | ___ | ___ | ✅ / ❌ |
| shadow_mode_legal | ___ | ___ | ✅ / ❌ |
| shadow_mode_medical | ___ | ___ | ✅ / ❌ |

**Blockers encontrados:** ___ (deve ser = 0)

---

## Métricas de Rollback

| Superfície | ROLLBACK_EFFECT_TIME_MS | Meta (≤ 30s) | Status |
|------------|-------------------------|---------------|--------|
| session_pipeline | ___ ms | ≤ 30.000 | ✅ / ❌ |
| ai_generation | ___ ms | ≤ 30.000 | ✅ / ❌ |

---

## Limites da Próxima Fase

| Parâmetro | Valor Configurado | Aceitável? |
|-----------|-------------------|------------|
| Max escritórios | ___ | ✅ / ❌ |
| Max sessões/dia | ___ | ✅ / ❌ |
| Max jobs ativos | ___ | ✅ / ❌ |
| Budget cap (USD) | ___ | ✅ / ❌ |
| Módulos habilitados | ___ | ✅ / ❌ |

---

## Checklist Operacional

- [ ] Runbook de rollback revisado e disponível
- [ ] Drill de kill-switch realizado nesta fase
- [ ] Monitor de shadow mode configurado
- [ ] Plano de notificação de operadores pronto
- [ ] Janela de monitoramento definida (`___ horas`)
- [ ] Responsável de plantão identificado para próxima fase: `___`

---

## Decisão

```
[ ] GO    — Todos os critérios bloqueadores passaram. Cooldown satisfeito.
            Avançar para fase ___

[ ] NO-GO — Falha em critério(s) bloqueador(es):
            Critério(s) falhando: ___
            Ação necessária: ___
            Re-avaliação em: ___

[ ] CONDITIONAL — Aprovado com condições:
            Condições: ___
            Deadline: ___
```

**Decisão:** ________________

**Justificativa:**
```
___
```

---

## Submissão via RPC

```sql
-- 1. Submeter revisão
SELECT public.submit_phase_review(
  '<phase_id>',
  'pre_advance',
  '[{"item": "dead_letter_ok", "passed": true}, ...]'::jsonb,
  'Revisão pré-avanço fase 1→2. Todos bloqueadores passaram.',
  ARRAY['link-ao-dashboard', 'link-ao-monitoramento']
);

-- 2. Decidir
SELECT public.decide_phase_review(
  '<review_id>',
  'approved',
  'Todos os critérios bloqueadores satisfeitos. GO para fase 2.'
);

-- 3. Avançar fase (requer review_id aprovado)
SELECT public.advance_rollout_phase(
  '<phase_id>',
  '<review_id>',
  'Avanço aprovado por revisão formal em 2026-04-10'
);
```
