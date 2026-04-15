# GSD (Get Shit Done) Patterns & Workflows - Flaito

Este documento define os padrões de desenvolvimento e automação para o projeto Flaito, seguindo a metodologia GSD 2.0.

## 1. Estrutura do Diretório .gsd

O diretório `.gsd` é o cérebro da automação do projeto:
- `ROADMAP.md`: Visão geral de alto nível das fases e progresso.
- `STATE.md`: Estado atual da sessão de desenvolvimento (Fase, Task, Status).
- `phases/`: Contém diretórios para cada fase (`1`, `2`, `3`...), com seus respectivos planos (`PLAN.md`), sumários (`SUMMARY.md`) e verificações (`VERIFICATION.md`).

## 2. Ciclo de Vida de uma Fase

1.  **Planejamento (`/plan {n}`)**: Criação de `PLAN.md` com tarefas atômicas e critérios de aceitação (`<task>` e `<verify>`).
2.  **Discussão (`/discuss-phase`)**: Alinhamento de escopo antes da execução.
3.  **Execução (`/execute {n}`)**: Implementação das tarefas em ondas (waves). Commits atômicos por tarefa.
4.  **Verificação (`/verify {n}`)**: Auditoria técnica para garantir que o objetivo da fase foi atingido.
5.  **Conclusão (`/complete-milestone`)**: Arquivamento e atualização do roadmap.

## 3. Padrões de Código (Clean AI Code)

- **Edge Functions**: Devem usar o utilitário compartilhado `jsonUtils.ts` para parse de respostas de IA.
- **Variáveis**: Devem ser resolvidas via `variableResolver.ts`.
- **Logs**: Todas as funções críticas devem implementar logs estruturados com `correlationId`.
- **Multi-tenancy**: O isolamento de dados por `office_id` e `client_id` deve ser validado em todas as queries e funções.

## 4. Workflows de IA (NIJA-MAESTRO)

- O pipeline jurídico segue 9 etapas: Preparação -> Análise -> Resolução -> Redação (3x) -> Consolidação -> Auditoria -> Output.
- O **AI Judge** deve ser invocado como guardrail de qualidade final.
- **Fail-fast**: Se o score de auditoria for insuficiente, o orquestrador deve tentar um loop de refinamento antes de entregar o resultado.

---
*Assinado: NIJA-BOT (GSD Orchestrator)*
