---
phase: 23
plan: 4
wave: 3
gap_closure: false
---

# P23-W3-PLAN-04: Quota Enforcement Service

Implementar o controle de limites de consumo (Quotas) para garantir a sustentabilidade financeira do SaaS e evitar abuso de recursos de IA caros.

## Tasks

- [ ] Criar `supabase/functions/_shared/saas-quotas.ts`
  - [ ] Implementar `checkQuota(adminClient, officeId, resourceType)`
  - [ ] Implementar `incrementUsage(adminClient, officeId, resourceType)`
  - [ ] Suporte para recursos: `legal_pieces`, `medical_analysis`
- [ ] Integrar Quota em `nija-pipeline-orchestrator` (ou motor de geração)
  - [ ] Bloquear geração se `legal_pieces_used >= legal_pieces_limit`
- [ ] Integrar Quota em `medical-agent-analysis`
  - [ ] Bloquear análise se `medical_analysis_used >= medical_analysis_limit`
- [ ] Implementar bypass para `OWNER` em ambiente de desenvolvimento (opcional)

## Verify
- [ ] Testar bloqueio de peça jurídica ao atingir limite manual no banco.
- [ ] Verificar incremento correto da quota após sucesso na operação.
