---
phase: 20
plan: 1
wave: 1
---

# Phase 20: Medical Governance Intelligence (V5)

Este plano detalha a implementação da camada de inteligência operacional (V5) para detecção de padrões, tendências de risco e recomendações assistidas.

## Proposed Changes

### Wave 0: Database Infrastructure
- [ ] Criar migration `20260408120000_governance_v5_intelligence.sql`
  - Tabela `medical_governance_recommendations`
  - Tabela `medical_governance_snapshots`
- [ ] Aplicar migration no projeto `ccvbosbjtlxewqybvwqj`

### Wave 1: Shared Intelligence Core
- [ ] Criar `supabase/functions/_shared/medical-intelligence.ts`
  - Lógica de `analyzeHistoricalGovernancePatterns`
  - Lógica de `computeRiskTrends`
  - Lógica de `detectFalsePositiveSignals`

### Wave 2: Intelligence Edge Worker
- [ ] Criar Edge Function `medical-governance-intelligence`
  - Implementar processamento em lote via Cron
  - Persistir snapshots e recomendações

### Wave 3: Admin Dashboard V5
- [ ] Atualizar `MedicalGovernanceDashboard.tsx`
  - Seção de Insights de Inteligência
  - Feed de Recomendações de Policy (Advisor)
  - Gráficos/Indicadores de Tendência de Risco

### Wave 4: Verification
- [ ] Criar `test_intelligence_v5.mjs`
- [ ] Validar detecção de downgrade persistente e geração de recomendação
- [ ] Validar tendência de risco (worsening/improving)

## Verification Plan
- Executar `node test_intelligence_v5.mjs`
- Verificar visualmente os insights no dashboard administrativo.
