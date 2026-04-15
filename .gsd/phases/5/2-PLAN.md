---
phase: 5
plan: 2
wave: 1
---

# Plan 5.2: Template Unified Migration and UX

## Objective
Unify juridical templates and frontend messaging to use the new standardized variables.

## Context
- `supabase/functions/nija-generate-piece/index.ts`
- `src/utils/templateEngine.ts`

## Tasks

<task type="auto">
  <name>Migrate Nija Generate Piece</name>
  <files>
    - supabase/functions/nija-generate-piece/index.ts
  </files>
  <action>
    - Importar e usar `variableResolver.ts` em vez de substituição manual.
    - Alterar o padrão de detecção de `[VAR]` para `{{var}}` (ou suportar ambos temporariamente).
  </action>
  <verify>Testar geração de peça legal.</verify>
  <done>Módulo jurídico integrado ao motor global.</done>
</task>

<task type="auto">
  <name>Sync Frontend templateEngine</name>
  <files>
    - src/utils/templateEngine.ts
  </files>
  <action>
    - Atualizar tipos e funções de ajuda para refletir o novo padrão.
    - Criar função para retornar metadados das variáveis para o UI (categorias).
  </action>
  <verify>npm run dev (build check)</verify>
  <done>Frontend sincronizado com o padrão de variáveis.</done>
</task>

## Success Criteria
- [ ] `nija-generate-piece` resolve variáveis dinamicamente via `variableResolver`.
- [ ] Interface de configurações de mensagens mostra categorias corretas.
