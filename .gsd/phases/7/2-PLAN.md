---
phase: 7
plan: 2
wave: 2
---

# Plan 7.2: Inteligência e Consolidação (Nija V2)

## Objetivo
Unificar as extrações atômicas em um dossiê jurídico mestre, gerando timelines, mapeamento fato x prova, detecção de lacunas e resumos táticos.

## Contexto
- `nija_doc_extractions` (saída do Plan 7.1)
- `process_dossiers` table (a ser atualizada)
- Etapas 2, 3, 4, 5, 6 e 7 do Dossiê

## Tasks

<task type="auto">
  <name>Atualizar schema process_dossiers (V2)</name>
  <files>supabase/migrations/20260403171000_update_dossier_v2.sql</files>
  <action>
    Extender a tabela `process_dossiers` para os campos estruturados do NIJA V2.
    
    SQL:
    ```sql
    ALTER TABLE process_dossiers 
    ADD COLUMN IF NOT EXISTS timeline_factual jsonb DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS timeline_processual jsonb DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS fato_prova_map jsonb DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS lacunas_detectadas jsonb DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS pedidos_estruturados jsonb DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS resumo_tatico jsonb DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS documentos_utilizados uuid[] DEFAULT '{}';
    ```
  </action>
  <verify>
    Check column existence in `information_schema.columns`.
  </verify>
  <done>Schema atualizado para suportar inteligência de 9 estágios</done>
</task>

<task type="auto">
  <name>Implementar orquestrador nija-consolidate-dossier</name>
  <files>supabase/functions/nija-consolidate-dossier/index.ts</files>
  <action>
    Esta função executa as ETAPAS 2 a 7 simultaneamente ou sequencialmente via LLM (Gemini 1.5/2.0 Pro recomendada pelo tamanho do contexto consolidado).
    
    LOGICA:
    1. Coletar todos os JSONs de `nija_doc_extractions` para o `case_id`.
    2. Prompt de Consolidação:
       - Unificar Partes, Fatos e Pedidos (Remover duplicatas).
       - Construir Timelines (Factual e Processual).
       - Mapear Fatos a Provas (linkar document_id original).
       - Detectar Lacunas (Gaps).
       - Gerar Resumo Tático.
    3. Persistir o Dossier como uma NOVE VERSÃO na tabela `process_dossiers`.
    
    REGRAS:
    - Rastreabilidade: Toda prova deve citar seu `document_id`.
    - Integridade: Não inventar fatos extras.
  </action>
  <verify>
    Chamar com case_id que possua pelo menos 2 documentos extraídos.
    Verificar se o `fato_prova_map` contém itens com `document_id` válido.
  </verify>
  <done>Orquestrador consolidando documentos e gerando inteligência mapeada</done>
</task>

## Success Criteria
- [ ] Dossier consolidado contém Timeline factual e processual
- [ ] Gaps (lacunas) são detectados com base na ausência de provas estruturadas
- [ ] Cada fato em `fato_prova_map` rastreia o documento de origem
