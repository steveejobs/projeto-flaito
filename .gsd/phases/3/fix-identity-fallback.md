---
phase: 3
plan: fix-identity-fallback
wave: 2
gap_closure: true
---

# Fix: Fallback Confuso de Identidade e RAG via ILIKE

## Problem
1. O `variableResolver` e parte do `.webhook` possuem muito código spagheti tentando achar um cliente (client_id vs pacient_id).
2. A pesquisa em `legal_documents` do assistente chat usa `LIKE %term%`, trazendo pouca qualidade semântica.

## Root Cause
1. Dados legados sem `client_id` unificado.
2. Uso de ILIKE ao invés de busca vetorial (pg_vector) para RAG.

## Tasks

<task type="auto">
  <name>Consolidate test accounts script</name>
  <files>supabase/migrations/99999999999999_consolidate_clients.sql</files>
  <action>
    Criar script SQL que garanta que todos os pacientes tenham um referencial `client_id` oficial antes de aceitar clientes reais, removendo o risco de dados órfãos do fallback.
  </action>
  <verify>Check script execution logs or verify database state.</verify>
  <done>All users/patients have valid `client_id` and fallback code logic is simplified.</done>
</task>

<task type="auto">
  <name>Refactor variableResolver and webhook logic</name>
  <files>
    supabase/functions/_shared/variableResolver.ts
    supabase/functions/whatsapp-webhook/index.ts
  </files>
  <action>
    Unificar a resolução de identidade 100% no UID universal (`client_id`). Remover a lógica "spaghetti" que tenta buscar por `pacient_id` ou telefone antigo.
  </action>
  <verify>Review `variableResolver.ts` and ensure it only uses `client_id` paths.</verify>
  <done>Webhook and variableResolver use a clean, unified identity scheme.</done>
</task>
