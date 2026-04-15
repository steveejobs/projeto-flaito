import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import OpenAI from "https://esm.sh/openai@4.24.1";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- SCHEMAS & TYPES ---

const UsabilityEnum = z.enum(["DIRECT", "CONDITIONAL", "HUMAN_REVIEW_ONLY"]);
const Status2Enum = z.enum(["READY_FOR_STAGE_3", "BLOCKED_BY_STAGE_1", "BLOCKED_LEGAL_INSUFFICIENCY", "HUMAN_REVIEW_REQUIRED"]);

const FactualMatrixSchema = z.object({
  ledger_id: z.string(),
  procedural_role: z.string(),
  legal_impact_summary: z.string()
});

const ControversySchema = z.object({
  item_description: z.string(),
  disputed_by: z.string(),
  supporting_ledger_ids: z.array(z.string()),
  uncertainty_level: z.enum(["LOW", "MEDIUM", "HIGH"])
});

const CandidateThesisSchema = z.object({
  title: z.string(),
  supporting_ledger_ids: z.array(z.string()),
  usability: UsabilityEnum,
  required_legal_basis: z.string(),
  risk_flags: z.array(z.string()),
  strategic_notes: z.string().optional()
});

const ProhibitedThesisSchema = z.object({
  title: z.string(),
  reason: z.string(),
  parent_ledger_ids: z.array(z.string())
});

const Stage2OutputSchema = z.object({
  factual_matrix: z.array(FactualMatrixSchema),
  controversy_map: z.array(ControversySchema),
  legal_relevance_map: z.array(z.object({
    ledger_id: z.string(),
    relevance_description: z.string()
  })),
  candidate_theses: z.array(CandidateThesisSchema),
  prohibited_theses: z.array(ProhibitedThesisSchema),
  required_human_review_points: z.array(z.object({
    type: z.string(),
    description: z.string(),
    ledger_impact_ids: z.array(z.string())
  })),
  stage_2_readiness_status: Status2Enum
});

// --- LOGIC FUNCTIONS ---

/**
 * Deterministically cross-checks candidate theses against the Stage 1 Ledger.
 */
function crossCheckTheses(ledger: any[], theses: any[], prohibited: any[]) {
  const ledgerMap = new Map(ledger.map(i => [i.item_id, i]));
  const validatedTheses: any[] = [];
  const forcedProhibited: any[] = [...prohibited];
  const overrides: string[] = [];

  for (const thesis of theses) {
    let isBlocked = false;
    let blockingReason = "";
    
    // Check all supporting IDs
    for (const lid of thesis.supporting_ledger_ids) {
      const ledgerItem = ledgerMap.get(lid);
      
      if (!ledgerItem) {
        isBlocked = true;
        blockingReason = `Reference ID ${lid} not found in Stage 1 Ledger.`;
        break;
      }
      
      if (ledgerItem.status === "CONFLICTING" || ledgerItem.status === "INSUFFICIENT_EVIDENCE") {
        isBlocked = true;
        blockingReason = `Reference ID ${lid} is marked as ${ledgerItem.status} in source data.`;
        break;
      }
    }

    if (isBlocked) {
      forcedProhibited.push({
        title: thesis.title,
        reason: blockingReason,
        parent_ledger_ids: thesis.supporting_ledger_ids
      });
      overrides.push(`Thesis "${thesis.title}" was moved to PROHIBITED by deterministic cross-check.`);
    } else {
      validatedTheses.push(thesis);
    }
  }

  return { validatedTheses, forcedProhibited, overrides };
}

/**
 * Detects strategic risks and mutually incompatible paths to trigger Human Review.
 */
function detectHumanReviewTriggers(data: any) {
  const triggers: string[] = [];
  
  // Rule 1: Normative Ambiguity check
  const hasAmbiguity = data.legal_relevance_map.some((m: any) => 
    m.relevance_description.toLowerCase().includes("ambíguo") || 
    m.relevance_description.toLowerCase().includes("incerto")
  );
  if (hasAmbiguity) triggers.push("Normative ambiguity detected in legal relevance map.");

  // Rule 2: Controversy on HIGH criticality items (Simplified check)
  const highControversy = data.controversy_map.some((c: any) => c.uncertainty_level === "HIGH");
  if (highControversy) triggers.push("High-level controversy detected affecting factual record.");

  // Rule 3: No direct theses available
  const hasDirectTheses = data.candidate_theses.some((t: any) => t.usability === "DIRECT");
  if (!hasDirectTheses && data.stage_2_readiness_status === "READY_FOR_STAGE_3") {
    triggers.push("No DIRECT usability theses found; only conditional or restricted options available.");
  }

  return triggers;
}

// --- MAIN HANDLER ---

const STAGE_2_SYSTEM_PROMPT = `Você é o NIJA_STAGE_2_EXTRACTOR, o analista de teoria jurídica do Flaito.
Sua missão é transformar um Inventário de Evidências validado em um Mapa de Teoria Jurídica estruturado.

DIRETRIZES CRÍTICAS:
- NÃO escreva parágrafos persuasivos ou petições.
- NÃO invente teses sem suporte direto no Ledger do Estágio 1.
- FOCO: Classificação, Mapeamento de Controvérsia e Identificação de Teses Admissíveis/Proibidas.
- Use EXATAMENTE os item_ids fornecidos no Ledger original do usuário.

ESTRUTURA DE SAÍDA (JSON):
{
  "factual_matrix": [{ "ledger_id": "string", "procedural_role": "string", "legal_impact_summary": "string" }],
  "controversy_map": [{ "item_description": "string", "disputed_by": "string", "supporting_ledger_ids": ["string"], "uncertainty_level": "LOW | MEDIUM | HIGH" }],
  "legal_relevance_map": [{ "ledger_id": "string", "relevance_description": "string" }],
  "candidate_theses": [{ "title": "string", "supporting_ledger_ids": ["string"], "usability": "DIRECT | CONDITIONAL | HUMAN_REVIEW_ONLY", "required_legal_basis": "string", "risk_flags": ["string"], "strategic_notes": "string" }],
  "prohibited_theses": [{ "title": "string", "reason": "string", "parent_ledger_ids": ["string"] }],
  "required_human_review_points": [{ "type": "string", "description": "string", "ledger_impact_ids": ["string"] }],
  "stage_2_readiness_status": "READY_FOR_STAGE_3 | BLOCKED_LEGAL_INSUFFICIENCY | HUMAN_REVIEW_REQUIRED"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { dossier_id, office_id }: { dossier_id: string; office_id?: string } = await req.json();

    if (!dossier_id) throw new Error("dossier_id (Stage 1) é obrigatório.");

    // 1. Fetch Stage 1 Dossier
    const { data: stage1Dossier, error: s1Error } = await supabase
      .from("process_dossiers")
      .select("*")
      .eq("id", dossier_id)
      .single();

    if (s1Error || !stage1Dossier) throw new Error("Dossiê Estágio 1 não encontrado.");
    
    // Gatekeeper
    if (stage1Dossier.drafting_readiness_status !== "READY_FOR_STAGE_2") {
      return new Response(JSON.stringify({ 
        success: false, 
        status: "BLOCKED_BY_STAGE_1",
        reason: `Estágio 1 reportou status: ${stage1Dossier.drafting_readiness_status}`
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ledger = stage1Dossier.fato_prova_map as any[];
    const inventory = stage1Dossier.evidence_inventory;

    // 2. LLM Execution
    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Use high-reasoning model for mapping
      temperature: 0,
      messages: [
        { role: "system", content: STAGE_2_SYSTEM_PROMPT },
        { role: "user", content: `Dossiê Estágio 1:\n\nInventory: ${inventory}\n\nLedger: ${JSON.stringify(ledger)}` },
      ],
      response_format: { type: "json_object" }
    });

    const aiContent = completion.choices[0].message.content;
    if (!aiContent) throw new Error("A IA retornou uma resposta vazia.");
    
    const rawStage2 = JSON.parse(aiContent);

    // 3. Deterministic Validation & Cross-Check
    const validation = Stage2OutputSchema.safeParse(rawStage2);
    if (!validation.success) {
      throw new Error(`Erro na estrutura de Teoria Jurídica: ${validation.error.issues.map(i => i.message).join(", ")}`);
    }

    const stage2Data = validation.data;
    const { validatedTheses, forcedProhibited, overrides } = crossCheckTheses(ledger, stage2Data.candidate_theses, stage2Data.prohibited_theses);
    
    let finalStatus = stage2Data.stage_2_readiness_status;
    const reviewTriggers = detectHumanReviewTriggers({ ...stage2Data, candidate_theses: validatedTheses });

    if (reviewTriggers.length > 0 && finalStatus === "READY_FOR_STAGE_3") {
      finalStatus = "HUMAN_REVIEW_REQUIRED";
    }

    // 4. Immutable Persistence (Insert New Version)
    const { data: versionDossier } = await supabase
      .from("process_dossiers")
      .select("version")
      .eq("case_id", stage1Dossier.case_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (versionDossier?.version ?? 0) + 1;

    const { data: stage2Record, error: dbError } = await supabase
      .from("process_dossiers")
      .insert({
        case_id: stage1Dossier.case_id,
        office_id: stage1Dossier.office_id || office_id,
        version: nextVersion,
        parent_stage_1_id: dossier_id,
        legal_theory_map: {
          ...stage2Data,
          candidate_theses: validatedTheses,
          prohibited_theses: forcedProhibited,
          _validation_overrides: overrides,
          _human_review_triggers: reviewTriggers
        },
        stage_2_readiness_status: finalStatus,
        evidence_inventory: stage1Dossier.evidence_inventory, // Propagate inventory for visibility
        full_analysis: {
          stage_1_ref: dossier_id,
          stage_2_analysis: stage2Data
        }
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return new Response(JSON.stringify({
      success: true,
      dossier_id: stage2Record.id,
      status: finalStatus,
      theses_count: validatedTheses.length,
      prohibited_count: forcedProhibited.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[nija-stage-2] Fatal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
