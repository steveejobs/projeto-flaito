# ROADMAP - Projeto Flaito

## Milestone 1: Infraestrutura e Integração GSD [/]
O objetivo deste milestone é consolidar a infraestrutura de desenvolvimento e garantir que todos os módulos (Legal, Médico e Mensagens) estejam operacionais e integrados.

### Phase 1: Implementação do GSD [x]
- [x] Criar arquivos estruturais (ROADMAP, ARCHITECTURE, STACK)
- [x] Validar comandos do GSD no Antigravity
- [ ] Definir padrões de documentação para novas funcionalidades

### Phase 2: Refinamento de Integrações [/]
- [ ] Consolidar uso de `client_id` em todos os módulos
- [ ] Finalizar integração com Z-API (WhatsApp)
- [ ] Validar fluxos de notificações (Scheduler e Worker)

### Phase 3: Gap Closure (Go-Live Readiness) [x]
**Status**: ✅ Complete
**Objective**: Address gaps from milestone audit

**Gaps to Close:**
- [x] Fix: medical-agent-analysis reading from abolished ai_config table
- [x] Fix: nija-generate-piece RAG and guardrails (Revisão Humana Exigida)
- [x] Fix: Identity fallback consolidation in variableResolver and webhook

## Milestone 2: Auditoria e Estabilização [ ]

### Phase 4: Auditoria e Estabilização [x]
**Status**: ✅ Complete
**Objective**: Auditar módulos médico e legal e estabilizar workers de IA.
**Tasks**:
- [x] Implementar extração robusta de JSON (`jsonUtils.ts`)
- [x] Refinar orquestrador NIJA-MAESTRO e loop de feedback
- [x] Consolidar isolamento multi-tenant no worker de notificações
- [x] Definir padrões de documentação GSD (`docs/gsd-patterns.md`)

### Phase 5: Consolidação de Variáveis Dinâmicas [x]
**Status**: ✅ Complete
**Objective**: Garantir que templates e automações usem dados reais e padronizados
**Tasks**:
- [x] Implementar motor de resolução de variáveis (Metadata-Driven)
- [x] Padronizar variáveis no formato `{{entidade.campo}}`
- [x] Migrar templates jurídicos e mensagens

## Milestone 3: Motor Jurídico NIJA V2 — Pipeline Completo [ ]

### Phase 6: RAG Jurídico Avançado [x]
**Status**: ✅ Complete
**Objective**: Substituir busca por keyword (ilike) por RAG vetorial com embeddings semânticos, priorizando precisão e rastreabilidade das fontes jurídicas.
**Tasks**:
- [x] Habilitar `pgvector` no Supabase e criar tabela `legal_chunks`
- [x] Criar Edge Function `nija-embed-chunks` para indexação de documentos em chunks com embedding
- [x] Refatorar `nija-generate-piece`: busca vetorial com reranking + source tracking
- [x] Seed mínimo: 10+ teses e 10+ precedentes indexados

### Phase 7: Advanced Dossier Engine (NIJA V2) [x]
**Status**: ✅ Complete
**Objective**: Implementar o motor de dossiê de 9 estágios (Extração Atômica, Consolidação, Timeline, Fato x Prova, Gaps, Pedidos Estruturados, Resumo Tático e Versionamento).
**Tasks**:
- [x] Implementar Etapa 1: Extração por Documento (Atomic Extractor)
- [x] Implementar Etapas 2-4: Consolidação, Timeline e Mapa Fato x Prova
- [x] Implementar Etapas 5-7: Detecção de Lacunas, Pedidos e Resumo Tático
- [x] Implementar Etapas 8-9: Versionamento, Auditoria e Integração Final

### Phase 8: Juiz IA — Simulação de Decisão Judicial [x]
**Status**: ✅ Complete
**Objective**: Criar agente que simula a perspectiva do juiz e calcula probabilidade de êxito com base em prova, jurisprudência e qualidade da peça.
**Tasks**:
- [x] Criar Edge Function `nija-judge-simulation` (Agent Juiz IA)
- [x] Implementar modelo de probabilidade ponderado (Qp × Fe × Aj × Cj)
- [x] Criar tabela `judge_simulations` para histórico e auditoria
- [x] Integrar resultado na UI do Nija (score visual + laudo judicial)

### Phase 9: Orquestrador do Pipeline Completo (NIJA-MAESTRO) [x]
**Status**: ✅ Complete
**Objective**: Criar orquestrador que conecta todas as 8 etapas em sequência, com feedback loop automático (máx. 2 iterações de ajuste) e entrega da peça final consolidada.
**Tasks**:
- [x] Criar Edge Function `nija-pipeline-orchestrator`
- [x] Implementar feedback loop (ajuste pós-simulação quando score < threshold)
- [x] Refatorar `src/modules/legal/Nija.tsx` para consumir pipeline orquestrado
- [x] Testes end-to-end com caso real (latência < 60s)
### Phase 10: Motor de Estratégia Jurídica (NIJA-STRATEGY) [x]
**Status**: ✅ Complete
**Objective**: Transformar o dossiê em estratégia estruturada através de um pipeline de 9 etapas (Classificação, Objetivos, Peça, Teses, Provas, Riscos, Oportunidades, Estratégia Final e Preparação).
**Tasks**:
- [x] Criar Edge Function `nija-legal-strategy` com orquestração de 9 etapas
- [x] Criar coluna `estrategia_juridica` na tabela `process_dossiers`
- [x] Testar integração com o gerador de peças
- [x] Refinar prompts baseados em feedback jurídico

### Phase 11: Motor de Geração de Peças (NIJA-GEN-MOTOR) [x]
**Status**: ✅ Complete
**Objective**: Desenvolver o motor de geração de 9 etapas para peças jurídicas de alta fidelidade.
**Tasks**:
- [x] Implementar Edge Function `nija-gen-motor` com fluxo sequencial de 9 etapas
- [x] Integrar resolução de variáveis real-time via `variableResolver.ts`
- [x] Implementar agente revisor interno para auditoria de fatos e fundamentos
- [x] Integrar motor de geração ao orquestrador `NIJA-MAESTRO`

### Phase 12: Motor de Revisão Jurídica (NIJA-REVIEW V2) [x]
**Status**: ✅ Complete
**Objective**: Implementar um motor de auditoria rigorosa de 9 etapas para garantir a qualidade técnica, fática e estratégica das peças antes da entrega final.
**Tasks**:
- [x] Implementar Edge Function `nija-review-v2` com fluxo de 9 etapas
- [x] Configurar persona "Principal Legal Reviewer + Litigation Auditor"
- [x] Implementar matriz de confronto Dossiê x Peça (Etapa 2 e 5)
- [x] Integrar relatório de revisão no loop de feedback do NIJA-MAESTRO

### Phase 13: Juiz IA V2 (Simulação de 9 Estágios) [x]
**Status**: ✅ Complete
**Objective**: Evoluir o Juiz IA para um pipeline de 9 estágios de alta precisão, simulando a perspectiva judicial com rigor técnico e imparcialidade.
**Tasks**:
- [x] Refatorar Edge Function `nija-judge-simulation` para 9 estágios
- [x] Implementar modelo de probabilidade ponderado V2 (com foco em provas e fundamentos)
- [x] Criar componente `NijaJudgeReport` para visualização detalhada do laudo
- [x] Integrar feedback loop crítico com o orquestrador `NIJA-MAESTRO`
### Phase 14: Sistema de Probabilidade Jurídica (NIJA-PROBABILITY) [CONCLUÍDO]
**Status**: ✅ Concluído
**Objective**: Implementar o motor de scoring ponderado de 6 fatores (Provas, Fundamentação, Coerência, Jurisprudência, Lacunas e Risco) para cálculos precisos de probabilidade de êxito.
**Tasks**:
- [x] Criar utilitário de cálculo ponderado `nija-probability-engine.ts`
- [x] Refatorar `nija-judge-simulation` para extrair scores granulares de 0-10
- [x] Atualizar `NijaResultsPanel.tsx` e `NijaJudgeReport.tsx` com visualização detalhada
- [x] Integrar feedback loop de inconsistência no `NIJA-MAESTRO`


## Milestone 4: Integração Operacional e Go-to-Market [ ]

### Phase 15: Integração Completa NIJA-MAESTRO (End-to-End) [/]
**Status**: [/] In Progress
**Objective**: Conectar todos os módulos (dossiê, estratégia, geração, revisão, juiz, probabilidade) em um fluxo único, persistente e operacional, integrado com assinatura e mensageria.
**Tasks**:
- [x] Implementar Camada de Persistência e Schema de Integração (V2)
- [/] Evoluir Orquestador MAESTRO com loop de persistência e tratamento de erros
- [ ] Integrar Flow de Saída (Assinatura ZapSign + WhatsApp Notification)
- [ ] Atualizar Dashboard Operacional NIJA com Timeline e Gestão de Versões

### Phase 16: Hardening de Tipagem (Wave 0.6) [x]
**Status**: ✅ Complete
**Objective**: Reduzir erros de TypeScript (< 150) através da sincronização e hardening de arquivos críticos.
**Tasks**:
- [x] [Etapa 1.3] Hardening em `governanceClient`, `AIFillButton` e `DeleteCaseButton`
- [x] Sincronizar CaseDeadlines com schema real
- [x] 1.3 Hardening de Tipagem Crítica (Audit, AI Fill, Cases)
- [x] 1.4 Baseline e Evolução do Módulo Médico (Agenda, Iridologia, Pacientes)
- [x] Correção de propriedades em AI Panels (Plaud)
- [x] Validar meta de erros com `tsc --noEmit` (Zero erros nos arquivos prioritários)

### Phase 17: Infraestrutura de Faturamento (Billing & Asaas Integration) [x]
**Status**: ✅ Complete
**Objective**: Implantar a base de dados de faturamento e as Edge Functions vinculadas ao Asaas.
**Tasks**:
- [x] Push das migrações de Billing e Audit Logs
- [x] Deploy das Edge Functions (billing-generate, billing-approve, asaas-create-payment)
- [x] Configuração de Secrets e Smoke Tests

## Milestone 5: Segurança Médica Avançada (Governance V4) [ ]

### Phase 18: Clinical Decision Safety Engine (V3) [x]
**Status**: ✅ Complete
**Objective**: Implementar o motor de segurança context-aware (V3) com validação de orçamentos, audiência e thresholds de confiança.
**Tasks**:
- [x] Criar motor de enforcement `medical-safety-v3.ts`
- [x] Implementar gates de completude de dados clínicos
- [x] Integrar auditoria V3 server-side com tracking de bypass

### Phase 19: Medical Governance & Watchdog (V4) [x]
**Status**: ✅ Complete
**Objective**: Implementar monitoramento contínuo (Watchdog), detecção de padrões de risco e respostas automáticas reversíveis.
**Tasks**:
- [x] Criar infraestrutura de dados para estados de risco e incidentes
- [x] Implementar motor de governança comportamental vs operacional
- [x] Criar Edge Function `medical-governance-watchdog` (Cron)
- [x] Implementar Dashboard de Governança e Alertas UI
- [x] Validar fluxo E2E de suspensão temporária de canal/capability

## Milestone 6: Inteligência e Assistência Clínica (V5 & V6) [ ]

### Phase 20: Medical Governance Intelligence (V5) [x]
**Status**: ✅ Complete
**Objective**: Evoluir para inteligência operacional com detecção de padrões históricos, tendências de risco e sugestão de políticas (Policy Advisor).
**Tasks**:
- [ ] Criar infraestrutura para recomendações e snapshots de inteligência
- [ ] Implementar motor de análise histórica `medical-intelligence.ts`
- [ ] Criar Job de inteligência `medical-governance-intelligence`
- [ ] Expandir Dashboard com insights de IA e detecção de falsos positivos

### Phase 21: Clinical Copilot - Profissional Assistido (V6) [x]
**Status**: ✅ Complete
**Objective**: Implementar modo copiloto para assistência profissional interna com fluxo de revisão obrigatória e aprendizado contínuo.
**Tasks**:
- [ ] Estender schema clínico para suporte a rascunhos IA e revisão médica
- [ ] Implementar motor de orquestração `clinical-copilot.ts`
- [ ] Criar painel de configuração clínica (Modelos, Prompts, Especialidades)
- [ ] Implementar auditoria comparativa (AI vs Humano)

## Milestone 7: Manutenção e Qualidade Técnica [ ]

### Phase 22: Type Safety Maintenance & Contract Audit (P1) [/]
**Status**: [/] In Progress
**Objective**: Eliminar drift de tipos entre Supabase, Edge Functions e Frontend, reduzindo o uso de `as any`.
**Tasks**:
- [ ] Regenerar `src/types/supabase.ts` com schema atualizado
- [ ] Criar `src/types/nija-contracts.ts` com interfaces centralizadas
- [ ] Remediar `as any` em `NijaResultsPanel.tsx` e `LexosTimeline.tsx`
- [ ] Validar integridade com `tsc --noEmit`

## Milestone 8: Plataforma SaaS Escalável (B2B) [ ]

### Phase 23: SaaS Platform & Multi-Tenant Billing [ ]
**Status**: [ ] Not Started
**Objective**: Implementar camada de assinaturas, quotas e billing multi-tenant com isolamento de credenciais.
**Tasks**:
- [ ] Implementar Schema de Integrações e Auditoria (Fase 1)
- [ ] Implementar Helper de Criptografia e Resolver Dinâmico (Fase 1)
- [ ] Criar Fluxo de Validação Ativa de Provedor
- [ ] Refatorar Webhooks para Isolamento Multi-tenant
- [ ] Implementar Enforcement de Quotas no Backend
- [ ] Desenvolver UI de Gestão de Planos e Integrações
## Milestone 9: Inteligência Conversacional e Provas Digitais [ ]

### Phase 24: Reunião Jurídica Inteligente (Missão Crítica) [ ]
**Status**: [ ] Not Started
**Objective**: Implementar o módulo de gravação resiliente, transcrição diarizada e inteligência sobre reuniões longas.
**Tasks**:
- [ ] Implementar Schema de Banco de Dados e Storage (Meetings, Chunks, Transcriptions)
- [ ] Desenvolver Camada de Gravação Resiliente (MediaRecorder + IndexedDB)
- [ ] Criar Edge Function de Ingestão e Consolidação (`meeting-processor`)
- [ ] Implementar Pipeline de Transcrição e Diarização (Deepgram integration)
- [ ] Desenvolver Interface de Mapeamento de Speakers e Reprocessamento
- [ ] Integrar Motor de Inteligência Jurídica (NIJA) para Resumos e Insights
- [ ] Implementar Trilha de Auditoria e RLS Hardening
