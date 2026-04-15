import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import OpenAI from "https://esm.sh/openai@4.24.1";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- SCHEMAS ---

const ModeEnum = z.enum(["HIGH_FIDELITY_AUTO", "ASSISTED", "HUMAN_REQUIRED"]);
const Status3Enum = z.enum(["READY_FOR_AUTHORITY_VERIFICATION", "BLOCKED_STRATEGY", "HUMAN_REVIEW_REQUIRED"]);

const StrategyOutputSchema = z.object({
  selected_strategy: z.object({
    primary_thesis_title: z.string(),
    supporting_thesis_titles: z.array(z.string()),
    selection_justification: z.string(),
    playbook_alignment_id: z.string().optional().describe("ID do playbook versionado de referência")
  }),
  rejected_theses: z.array(z.object({
    title: z.string(),
    reason: z.string()
  })).describe("Registro obrigatório de por que teses candidatas foram descartadas"),
  argument_structure: z.object({
    main_arguments: z.array(z.string()),
    supporting_arguments: z.array(z.string()),
    fallback_arguments: z.array(z.string())
  }),
  risk_assessment: z.object({
    evidentiary_risks: z.array(z.string()),
    strategic_risks: z.array(z.string()),
    authority_risks: z.array(z.string()),
    citation_risks: z.array(z.string()),
    playbook_alignment_risks: z.array(z.string())
  }),
  execution_mode: ModeEnum,
  stage_3_readiness_status: Status3Enum
});

// --- LOGIC ---

/**
 * HIGH_FIDELITY_AUTO (HFA):
 * Indica prontidão para MONTAGEM automática.
 * NUNCA implica autorização para PROTOCOLO automático.
 */
function calculateFinalMode(aiMode: string, theoryMap: any): string {
  let mode = aiMode;
  const theses = theoryMap.candidate_theses || [];
  const selectedTitle = theoryMap._selected_primary_title; 
  const selectedThesis = theses.find((t: any) => t.title === selectedTitle);

  // ... (regras de downgrade mantidas)

  // Rule 1: No direct thesis -> No Auto
  const hasDirect = theses.some((t: any) => t.usability === "DIRECT");
  if (!hasDirect && mode === "HIGH_FIDELITY_AUTO") {
    mode = "ASSISTED";
  }

  // Rule 2: Selected thesis is CONDITIONAL -> ASSISTED/HUMAN
  if (selectedThesis?.usability === "CONDITIONAL" && mode === "HIGH_FIDELITY_AUTO") {
    mode = "ASSISTED";
  }

  // Rule 3: Selected thesis is HUMAN_REVIEW_ONLY -> HUMAN_REQUIRED
  if (selectedThesis?.usability === "HUMAN_REVIEW_ONLY") {
    mode = "HUMAN_REQUIRED";
  }

  // Rule 4: Stage 2 was already HUMAN_REVIEW_REQUIRED -> Max ASSISTED
  if (theoryMap.stage_2_readiness_status === "HUMAN_REVIEW_REQUIRED" && mode === "HIGH_FIDELITY_AUTO") {
    mode = "ASSISTED";
  }

  return mode;
}

// --- MAIN ---

const STAGE_3_SYSTEM_PROMPT = `Você é o NIJA_STAGE_3_STRATEGY_ENGINE, o arquiteto de estratégia jurídica do Flaito.
Sua missão é selecionar EXATAMENTE UMA tese primária e estruturar o plano de ataque.

DIRETRIZES CRÍTICAS:
- NÃO escreva petições ou parágrafos narrativos.
- ARGUMENT_STRUCTURE: Use apenas tópicos estruturais e referências (No Prose). Nada de virar quase-petição.
- REJECTED_THESES: Você deve registrar explicitamente POR QUE cada tese candidata foi rejeitada (auxilia auditoria).
- NÃO utilize teses proibidas.
- NÃO invente novos fatos. Use apenas o Ledger validado e o Mapa de Teoria fornecidos.
- DEFINA caminhos de Fallback (argumentos subsidiários) caso a tese principal seja rejeitada.

MODOS DE EXECUÇÃO:
- HIGH_FIDELITY_AUTO: Significa apto para MONTAGEM automática. NUNCA significa apto para protocolo automático. Requer revisão normativa.
- ASSISTED: Requer validação humana por haver condicionalidade ou risco médio.
- HUMAN_REQUIRED: Risco estratégico alto ou tese restrita.

ESTRUTURA DE SAÍDA (JSON):
{
  "selected_strategy": {
    "primary_thesis_title": "string",
    "supporting_thesis_titles": ["string"],
    "selection_justification": "string",
    "playbook_alignment_id": "string"
  },
  "rejected_theses": [{ "title": "string", "reason": "string" }],
  "argument_structure": {
    "main_arguments": ["string"],
    "supporting_arguments": ["string"],
    "fallback_arguments": ["string"]
  },
  "risk_assessment": {
    "evidentiary_risks": ["string"],
    "strategic_risks": ["string"],
    "authority_risks": ["string"],
    "citation_risks": ["string"],
    "playbook_alignment_risks": ["string"]
  },
  "execution_mode": "HIGH_FIDELITY_AUTO | ASSISTED | HUMAN_REQUIRED",
  "stage_3_readiness_status": "READY_FOR_AUTHORITY_VERIFICATION | BLOCKED_STRATEGY | HUMAN_REVIEW_REQUIRED"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { dossier_id, office_id }: { dossier_id: string; office_id?: string } = await req.json();
    if (!dossier_id) throw new Error("dossier_id (Stage 2) é obrigatório.");

    // 1. Fetch Stage 2 Dossier
    const { data: stage2Dossier, error: s2Error } = await supabase
      .from("process_dossiers")
      .select("*")
      .eq("id", dossier_id)
      .single();

    if (s2Error || !stage2Dossier) throw new Error("Dossiê Estágio 2 não encontrado.");

    // Gatekeeper
    if (stage2Dossier.stage_2_readiness_status !== "READY_FOR_STAGE_3" && 
        stage2Dossier.stage_2_readiness_status !== "HUMAN_REVIEW_REQUIRED") {
      return new Response(JSON.stringify({ 
        success: false, 
        status: "BLOCKED_BY_STAGE_2",
        reason: `Estágio 2 reportou status: ${stage2Dossier.stage_2_readiness_status}`
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const theoryMap = stage2Dossier.legal_theory_map;

    // 2. LLM Execution
    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        { role: "system", content: STAGE_3_SYSTEM_PROMPT },
        { role: "user", content: `Teoria Jurídica (Estágio 2):\n\n${JSON.stringify(theoryMap)}` },
      ],
      response_format: { type: "json_object" }
    });

    const aiContent = completion.choices[0].message.content;
    if (!aiContent) throw new Error("A IA retornou uma resposta vazia.");
    
    const rawStage3 = JSON.parse(aiContent);

    // 3. Deterministic Validation & Overrides
    const validation = StrategyOutputSchema.safeParse(rawStage3);
    if (!validation.success) {
      throw new Error(`Erro na estrutura da Estratégia: ${validation.error.issues.map(i => i.message).join(", ")}`);
    }

    const strategyData = validation.data;
    const finalMode = calculateFinalMode(strategyData.execution_mode, {
      ...theoryMap,
      _selected_primary_title: strategyData.selected_strategy.primary_thesis_title
    });

    // 4. Persistence (Immutable Version++)
    const { data: versionDossier } = await supabase
      .from("process_dossiers")
      .select("version")
      .eq("case_id", stage2Dossier.case_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (versionDossier?.version ?? 0) + 1;

    const { data: stage3Record, error: dbError } = await supabase
      .from("process_dossiers")
      .insert({
        case_id: stage2Dossier.case_id,
        office_id: stage2Dossier.office_id || office_id,
        version: nextVersion,
        parent_stage_2_id: dossier_id,
        selected_strategy: strategyData.selected_strategy,
        argument_structure: strategyData.argument_structure,
        risk_assessment: strategyData.risk_assessment,
        execution_mode: finalMode,
        stage_3_readiness_status: strategyData.stage_3_readiness_status,
        -- Propagate previous maps for auditability
        legal_theory_map: stage2Dossier.legal_theory_map,
        fato_prova_map: stage2Dossier.fato_prova_map,
        evidence_inventory: stage2Dossier.evidence_inventory,
        full_analysis: {
          stage_1_ref: stage2Dossier.parent_stage_1_id,
          stage_2_ref: dossier_id,
          stage_3_analysis: strategyData
        }
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return new Response(JSON.stringify({
      success: true,
      dossier_id: stage3Record.id,
      mode: finalMode,
      status: strategyData.stage_3_readiness_status
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[nija-stage-3] Fatal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
