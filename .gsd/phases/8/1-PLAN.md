---
phase: 8
plan: 1
wave: 1
---

# Plan 8.1: Juiz IA — nija-judge-simulation

## Objetivo
Criar a Edge Function `nija-judge-simulation` — o agente central do sistema de Simulação de Decisão Judicial, que analisa a peça e o caso da perspectiva de um juiz imparcial e calcula a probabilidade de êxito.

## Contexto
- `supabase/functions/nija-review-piece/` — ReviewReport a usar como entrada
- `supabase/functions/_shared/vectorSearch.ts` — RAG de precedentes
- `supabase/functions/_shared/nija-core-prompt.ts` — guardrails base

## Tasks

<task type="auto">
  <name>Criar migration para tabela judge_simulations</name>
  <files>supabase/migrations/[timestamp]_judge_simulations.sql</files>
  <action>
    ```sql
    CREATE TABLE judge_simulations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id uuid REFERENCES cases(id),
      office_id uuid REFERENCES offices(id),
      dossier_id uuid REFERENCES process_dossiers(id),
      probabilidade_exito integer CHECK (probabilidade_exito BETWEEN 0 AND 100),
      faixa text CHECK (faixa IN ('MUITO_BAIXA','BAIXA','MEDIA','ALTA')),
      tipo_decisao_provavel text,
      pontos_fortes jsonb DEFAULT '[]',
      pontos_fracos jsonb DEFAULT '[]',
      lacunas_probatorias jsonb DEFAULT '[]',
      sugestoes_melhoria jsonb DEFAULT '[]',
      fundamentos_provaveis jsonb DEFAULT '[]',
      score_qualidade_peca integer,  -- herdado do ReviewReport
      score_componentes jsonb,        -- { Qp, Fe, Aj, Cj } desagregados
      observacao_juiz text,
      alerta_risco text,
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE judge_simulations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "office_isolation" ON judge_simulations
      USING (office_id = (SELECT office_id FROM profiles WHERE id = auth.uid()));
    ```
  </action>
  <verify>`SELECT * FROM information_schema.tables WHERE table_name = 'judge_simulations';`</verify>
  <done>Tabela criada com RLS</done>
</task>

<task type="auto">
  <name>Criar Edge Function nija-judge-simulation</name>
  <files>supabase/functions/nija-judge-simulation/index.ts</files>
  <action>
    ENTRADA:
    ```
    {
      draft_piece: NijaGeneratedPiece,
      dossier: ProcessDossier,
      review_report: ReviewReport,
      rag_chunks?: LegalChunk[]  // precedentes já recuperados
    }
    ```

    SYSTEM PROMPT (persona do Juiz):
    "Você é um Juiz de Direito experiente, imparcial e técnico. Analise a peça submetida e simule qual seria sua decisão com base nos elementos apresentados. Seja rigoroso e honesto — sua análise ajudará o advogado a melhorar a peça antes do protocolo real."

    PIPELINE DO AGENTE:
    1. Ler a peça: identificar tese central, pedidos e fundamentação
    2. Cruzar fatos com provas disponíveis (dossiê.provas)
    3. Avaliar força da argumentação (coerência lógica)
    4. Consultar os chunks RAG fornecidos (tendência dos tribunais)
    5. Identificar pontos que o adversário atacará
    6. Formular convicção → tipo de decisão provável
    7. Calcular probabilidade via modelo ponderado

    MODELO DE PROBABILIDADE (calcular no código, NÃO no LLM):
    ```
    Qp = review_report.score_qualidade / 100           // peso 0.30
    Fe = provas_disponíveis / total_alegações           // peso 0.30 (estimar do dossier)
    Aj = score_aderência_rag (0–1, calculado via avg similarity dos chunks) // peso 0.25
    Cj = 1 - (issues_criticos / (issues_criticos + 2)) // peso 0.15 (penaliza issues)
    P = Math.round((0.30*Qp + 0.30*Fe + 0.25*Aj + 0.15*Cj) * 100)
    ```
    Faixa: >= 75 → ALTA | 55–74 → MEDIA | 35–54 → BAIXA | < 35 → MUITO_BAIXA

    OUTPUT JSON (estrutura completa definida em implementation_plan.md seção F).

    APÓS receber resposta do LLM:
    - Calcular P(êxito) no código (não confiar no LLM para o número)
    - Upsert em judge_simulations (persistir resultado)
    - Retornar: JudgeSimulation + { probabilidade_exito, score_componentes }

    NÃO: apresentar o número bruto sem contextualização
    MODELO: buscar de ai_agents slug="nija-judge-simulation", fallback: google/gemini-2.5-pro (máx precisão)
  </action>
  <verify>
    Chamar com inputs reais (peça gerada + dossiê). Verificar:
    - `probabilidade_exito` entre 0 e 100
    - `tipo_decisao_provavel` é string válida
    - `pontos_fortes` e `pontos_fracos` são arrays não-vazios
    - Registro persistido em `judge_simulations`
  </verify>
  <done>
    - Edge Function deployada
    - Probabilidade calculada via código (não LLM)
    - Resultado persistido em judge_simulations
    - Todos campos do JudgeSimulation preenchidos
  </done>
</task>

## Success Criteria
- [ ] Tabela `judge_simulations` criada com RLS
- [ ] `nija-judge-simulation` retorna probabilidade calculada por código (0–100)
- [ ] Pontos fortes, fracos, lacunas e sugestões retornados
- [ ] Resultado persistido no banco para auditoria
