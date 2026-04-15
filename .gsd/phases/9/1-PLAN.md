---
phase: 9
plan: 1
wave: 1
---

# Plan 9.1: Orquestrador do Pipeline Completo — nija-pipeline-orchestrator

## Objetivo
Criar a Edge Function `nija-pipeline-orchestrator` que conecta todas as 8 etapas do pipeline NIJA V2 em sequência, com feedback loop automático para ajuste pós-simulação, e refatorar a UI do Nija para consumir o novo pipeline.

## Contexto
- `supabase/functions/nija-full-analysis/` — Etapa 2
- `supabase/functions/nija-build-dossier/` — Etapa 1 (persistência do dossiê)
- `supabase/functions/nija-generate-piece/` — Etapa 5
- `supabase/functions/nija-review-piece/` — Etapa 6
- `supabase/functions/nija-judge-simulation/` — Etapa 7
- `src/modules/legal/Nija.tsx` — UI a refatorar

## Tasks

<task type="auto">
  <name>Criar Edge Function nija-pipeline-orchestrator</name>
  <files>supabase/functions/nija-pipeline-orchestrator/index.ts</files>
  <action>
    ENTRADA:
    ```
    {
      case_id: string,
      raw_text?: string,           // texto do processo (opcional se full_analysis já foi feita)
      full_analysis?: object,      // reutilizar análise existente se disponível
      piece_type?: string,         // forçar tipo de peça (opcional)
      score_threshold?: number     // threshold para feedback loop (default: 65)
    }
    ```

    PIPELINE (executar em sequência):
    ```
    Etapa 1: nija-build-dossier → ProcessDossier
    Etapa 2: [se raw_text fornecido] nija-full-analysis → StrategicAnalysis
             [senão] usar full_analysis fornecido
    Etapa 3: Seleção de peça base (lógica interna: ramo + fase + polo + vícios → tipo_peca)
    Etapa 4: variableResolver (resolver variáveis do template)
    Etapa 5: nija-generate-piece → DraftPiece (passando RAG context)
    Etapa 6: nija-review-piece → ReviewReport
    Etapa 7: nija-judge-simulation → JudgeSimulation (probabilidade + laudo)
    Etapa 8: FEEDBACK LOOP
      - Se (JudgeSimulation.probabilidade_exito < score_threshold) AND (iteração < 2):
        → Construir instrução corretiva baseada em sugestoes_melhoria
        → Re-executar Etapa 5 com instrução corretiva adicional no prompt
        → Re-executar Etapas 6 e 7
      - Senão: encerrar com peça atual
    ```

    OUTPUT:
    ```json
    {
      "final_piece": NijaGeneratedPiece,
      "review_report": ReviewReport,
      "judge_simulation": JudgeSimulation,
      "pipeline_metadata": {
        "iterations": 1 | 2,
        "score_final": number,
        "ajuste_aplicado": boolean,
        "ajuste_esgotado": boolean,
        "etapas_executadas": string[]
      },
      "dossier_id": string
    }
    ```

    LIMITES CRÍTICOS:
    - Máximo 2 iterações de ajuste (evitar loop infinito)
    - Timeout da função: 120s (configurar no deploy)
    - Log de cada etapa com timestamp para rastrear latência
    - NÃO: chamar nija-full-analysis se full_analysis já foi fornecido (custo)
  </action>
  <verify>
    Chamar com case_id real + raw_text de processo. Verificar:
    - Response contém todos os campos: final_piece, review_report, judge_simulation
    - pipeline_metadata.etapas_executadas lista todas as etapas
    - Latência total < 90s (logar tempo por etapa)
    - Quando probabilidade < 65: pipeline_metadata.ajuste_aplicado = true
  </verify>
  <done>
    - Orquestrador chama todas as 8 etapas em sequência
    - Feedback loop ativo (ajuste quando score < threshold)
    - Output consolidado com peça final + laudo judicial
  </done>
</task>

<task type="checkpoint:human-verify">
  <name>Refatorar Nija.tsx para consumir o pipeline orquestrado</name>
  <files>src/modules/legal/Nija.tsx</files>
  <action>
    Adicionar chamada ao `nija-pipeline-orchestrator` na UI como nova opção premium.
    Exibir progressivamente:
    1. Indicador de etapa atual (Dossiê → Análise → Geração → Revisão → Juiz IA → Final)
    2. Card de score de probabilidade com badge de faixa (ALTA/MEDIA/BAIXA/MUITO_BAIXA)
    3. Laudo do Juiz IA accordion (pontos fortes, pontos fracos, lacunas, sugestões)
    4. Issues da Revisão com severidade visual (vermelho = CRITICO, amarelo = WARNING)
    5. Peça final com botão de download (manter fluxo atual)

    NÃO: remover o fluxo atual (nija-generate-piece direto) — manter como opção "Rápida"
    O novo pipeline é a opção "Completo (Juiz IA)" — checkbox na UI
  </action>
  <verify>
    Verificação visual: usuário confirma que vê o score de probabilidade e o laudo do Juiz IA após geração.
  </verify>
  <done>
    - UI exibe indicador de etapas durante processamento
    - Score de probabilidade visível com faixa colorida
    - Laudo do Juiz IA acessível em accordion
    - Issues da revisão visíveis com severidade
  </done>
</task>

## Success Criteria
- [ ] `nija-pipeline-orchestrator` encadeia todas as 8 etapas e retorna output consolidado
- [ ] Feedback loop funciona: quando score < 65, ajuste é aplicado (máx. 2x)
- [ ] Latência do pipeline completo < 90s
- [ ] UI Nija.tsx exibe score de êxito, laudo judicial e issues de revisão
- [ ] Opção "Geração Rápida" (fluxo atual) mantida
