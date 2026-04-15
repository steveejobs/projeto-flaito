---
phase: 5
plan: 1
wave: 1
---

# Plan 5.1: Core Variable Resolution Refactoring

## Objective
Implement a metadata-driven variable resolution engine and standardize names based on the `{{entity.field}}` pattern.

## Context
- `supabase/migrations/20260325164154_create_dynamic_variables_table.sql`
- `supabase/functions/_shared/variableResolver.ts`
- `system_proposal.md`

## Tasks

<task type="auto">
  <name>Update Dynamic Variables Metadata</name>
  <files>
    - supabase/migrations/20260325164154_create_dynamic_variables_table.sql
  </files>
  <action>
    - Atualizar o seed para incluir os novos nomes padronizados (`client.name`, `case.number`, etc).
    - Adicionar aliases no banco ou garantir que o resolver suporte mapeamento legado.
  </action>
  <verify>grep "client.name" supabase/migrations/20260325164154_create_dynamic_variables_table.sql</verify>
  <done>Novos nomes inseridos via seed.</done>
</task>

<task type="auto">
  <name>Refactor variableResolver.ts</name>
  <files>
    - supabase/functions/_shared/variableResolver.ts
  </files>
  <action>
    - Substituir o emaranhado de `if/else` por uma resolução genérica baseada em `source_table` e `source_field`.
    - Adicionar validação de `client_id` em todas as queries.
    - Implementar fallback seguro ("—") para campos vazios.
    - Garantir que placeholders inexistentes sejam removidos do texto final.
  </action>
  <verify>Testar via edge function ou script Node.</verify>
  <done>Motor de resolução desacoplado e funcional.</done>
</task>

## Success Criteria
- [ ] O motor resolve `{{client.name}}` corretamente a partir de `clients.full_name`.
- [ ] Variáveis inexistentes não quebram o sistema nem vazam.
