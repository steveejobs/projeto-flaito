---
phase: 7
plan: 3
wave: 3
---

# Plan 7.3: Versionamento e Integração UI (Nija V2)

## Objetivo
Finalizar o ciclo de vida do dossiê com controle de versão, auditoria de documentos utilizados e visualização rica no painel do advogado.

## Contexto
- `src/components/legal/Nija.tsx` (atualização de visualização)
- `process_dossiers` table (status_revisao e versionamento)
- Etapas 8 e 9 do Dossiê

## Tasks

<task type="auto">
  <name>Garantir versionamento e controle de auditoria</name>
  <files>supabase/functions/nija-consolidate-dossier/index.ts</files>
  <action>
    Refinar a persistência:
    - Incrementar `version` a cada nova consolidação do mesmo `case_id`.
    - Registrar `documentos_utilizados` (UUIDs).
    - Definir `status_revisao` inicial como 'PENDENTE'.
  </action>
  <verify>
    Executar a função 2 vezes para o mesmo `case_id` e verificar se a versão incrementou para 2.
  </verify>
  <done>Histórico de dossiê preservado com rastreabilidade de arquivos</done>
</task>

<task type="auto">
  <name>Atualizar Nija UI para exibir Dossiê Inteligente</name>
  <files>src/components/legal/Nija.tsx</files>
  <action>
    Refatorar a exibição do Dossiê:
    - Adicionar seção "Mapa de Fatos e Provas" (Fact-Evidence Mapping).
    - Exibir "Timeline Factual" e "Timeline Processual" em componentes de lista/gráficos simples.
    - Destacar "Lacunas de Prova" (Gaps) com alertas visuais (BADGES).
    - Mostrar "Resumo Tático" em destaque no topo.
  </action>
  <verify>
    Visualizar o dashboard e confirmar que os novos campos JSONb são renderizados.
  </verify>
  <done>UI atualizada com visão executiva e tática do caso</done>
</task>

## Success Criteria
- [ ] Dossiê mantém histórico de versões (não sobrescreve, adiciona)
- [ ] UI exibe claramente o vínculo entre fato e documento original
- [ ] Lacunas (Gaps) são visíveis para o advogado agir
