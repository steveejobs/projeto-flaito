---
phase: 3
plan: fix-medical-agent
wave: 1
gap_closure: true
---

# Fix: Agente Médico (Clinical Analysis) está órfão

## Problem
O arquivo `medical-agent-analysis\index.ts` está buscando configs na tabela abolida `ai_config` ao invés da tabela nova `ai_agents` gerida pela UI (AIAgentsManager). Os médicos mudarão os prompts na UI e nada acontecerá.

## Root Cause
A UI foi atualizada para usar a tabela `ai_agents`, mas a edge function `medical-agent-analysis` não foi refatorada e continua apontando para a estrutura legada `ai_config`.

## Tasks

<task type="auto">
  <name>Fix medical-agent-analysis DB fetch</name>
  <files>supabase/functions/medical-agent-analysis/index.ts</files>
  <action>
    Update the database fetch logic in `medical-agent-analysis/index.ts` to read from the `ai_agents` table instead of `ai_config`. Ensure it queries using the correct tenant identifier (e.g. office_id or client_id as appropriate for ai_agents).
  </action>
  <verify>Check the edge function source code to ensure `ai_config` is no longer referenced.</verify>
  <done>The edge function successfully fetches the prompt and settings from `ai_agents`.</done>
</task>
