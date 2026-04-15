---
phase: 10
plan: 1
wave: 1
---

# Plan 10.1: Infraestrutura e Estratégia Inicial (Etapas 1-3)

## Objective
Estabelecer a base técnica do motor `nija-legal-strategy` e implementar as três primeiras etapas do pipeline estratégico: Classificação, Objetivos e Escolha da Peça.

## Context
- .gsd/SPEC.md (Dossier Engine V2)
- c:\Users\jarde\.gemini\antigravity\brain\250091ac-8aad-4b7c-a6a7-ca6c80ebf9fe/implementation_plan.md
- supabase/functions/nija-build-dossier/index.ts (Referência de padrão)

## Tasks

<task type="auto">
  <name>Setup da Edge Function nija-legal-strategy</name>
  <files>
    - supabase/functions/nija-legal-strategy/index.ts
  </files>
  <action>
    Criar o boilerplate da Edge Function:
    - Suporte a CORS
    - Autenticação via JWT (client role ou service role conforme necessário)
    - Conexão com Supabase
    - Estrutura de interfaces para as 9 etapas (Typescript)
  </action>
  <verify>ls supabase/functions/nija-legal-strategy/index.ts</verify>
  <done>Arquivo criado com boilerplate básico e sem erros de sintaxe.</done>
</task>

<task type="auto">
  <name>Implementação do Coração do Motor (Stages 1-3)</name>
  <files>
    - supabase/functions/nija-legal-strategy/index.ts
  </files>
  <action>
    Implementar a lógica de orquestração das etapas 1, 2 e 3:
    1. **Etapa 1 (Classificação)**: Extrair área, polo e fase do dossiê.
    2. **Etapa 2 (Objetivo)**: Definir objetivos principal/secundários e urgência via LLM.
    3. **Etapa 3 (Peça)**: Decidir o tipo de peça e justificativa.
    
    Usar `Gemini 1.5 Pro` via Lovable Gateway para garantir raciocínio jurídico profundo.
  </action>
  <verify>deno run --check supabase/functions/nija-legal-strategy/index.ts</verify>
  <done>Função processando as 3 primeiras etapas e retornando JSON estruturado parcial.</done>
</task>

## Success Criteria
- [ ] Edge Function funcional e acessível.
- [ ] Output JSON contém `etapa_1`, `etapa_2` e `etapa_3` preenchidos corretamente a partir de um dossiê de teste.
