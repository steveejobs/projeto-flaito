---
phase: 19
plan: 1
wave: 1
---

# PLAN: Medical Governance V4 Implementation

## Goal
Implementar vigilância ativa, detecção de padrões de risco (Watchdog) e respostas automáticas (v4) integrado ao Clinical Engine (V3).

## Wave 1: Core Analytics & Watchdog
- [x] Implementar engine de análise temporal `analyzeGovernancePatterns`
- [x] Criar Edge Function `medical-governance-watchdog`
- [x] Configurar persistência de incidentes e estados de risco

## Wave 2: Runtime Enforcement
- [x] Integrar restrições da tabela `medical_risk_states` em `enforceMedicalCapabilityV3`
- [x] Atualizar Edge Functions para consultar restrições ativas antes do processamento

## Wave 3: UI & Verification
- [ ] Criar Dashboard de Governança (`MedicalGovernanceDashboard.tsx`)
- [ ] Implementar feed de alertas em tempo real
- [ ] Rodar script de verificação Node.js E2E
