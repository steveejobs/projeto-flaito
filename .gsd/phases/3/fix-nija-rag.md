---
phase: 3
plan: fix-nija-rag
wave: 1
gap_closure: true
---

# Fix: Risco de RAG Fantasma (Legal) e Guardrails

## Problem
O `nija-generate-piece` não força o banco de jurisprudência ou RAG (que só está no chat via ilike básico). Isso abre margem enorme para petições alucinadas (inventar artigos ou súmulas).

## Root Cause
Ausência de RAG vetorial forte na geração de peças e falta de avisos na UI de que o conteúdo requer revisão humana.

## Tasks

<task type="auto">
  <name>Add Revisão Humana Exigida alert</name>
  <files>
    src/components/layout/LegalShell.tsx
    src/modules/legal/components/NijaGenerator.tsx
  </files>
  <action>
    Incluir um alerta grande de "Revisão Humana Exigida" em todas as telas que gerem petições do NIJA. Utilize os componentes visuais do sistema (Alert, Badge).
  </action>
  <verify>Inspect the UI components to ensure the alert is present.</verify>
  <done>User sees a clear warning before and after generating automatic petitions.</done>
</task>

<task type="auto">
  <name>Improve RAG implementation</name>
  <files>supabase/functions/nija-generate-piece/index.ts</files>
  <action>
    Implement strict guardrails in the prompt to prevent hallucination (e.g. "do not invent citations"). Require the LLM to only use user-provided context or strictly acknowledged legal databases.
  </action>
  <verify>Check the nija-generate-piece prompt structure.</verify>
  <done>Prompt contains strong guardrails.</done>
</task>
