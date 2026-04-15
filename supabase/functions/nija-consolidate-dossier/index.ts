import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import OpenAI from "https://esm.sh/openai@4.24.1";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- SCHEMAS & TYPES ---

const StatusEnum = z.enum(["FOUND", "NOT_FOUND", "CONFLICTING", "INSUFFICIENT_EVIDENCE"]);
const ReadinessEnum = z.enum(["READY_FOR_STAGE_2", "BLOCKED_MISSING_EVIDENCE", "BLOCKED_CONFLICTING_RECORD"]);
const SeverityEnum = z.enum(["BLOCKING", "WARNING"]);

const SourceSchema = z.object({
  doc_id: z.string().uuid(),
  section_id: z.string().optional(),
  span: z.string().optional(),
  page_ref: z.string().optional(),
}).refine(s => s.section_id || s.span || s.page_ref, {
  message: "FOUND items must have at least one granular locator (section_id, span, or page_ref)."
});

const EvidenceLedgerItemSchema = z.object({
  item_id: z.string(),
  category: z.string(),
  value: z.string(),
  status: StatusEnum,
  source: SourceSchema.optional(),
  notes: z.string().optional(),
}).refine(item => {
  if (item.status === "FOUND") return !!item.source;
  return true;
}, {
  message: "Items marked as FOUND must have valid source linkage."
});

const DossierOutputSchema = z.object({
  evidence_inventory: z.string().min(50),
  strict_evidence_ledger: z.array(EvidenceLedgerItemSchema),
  blocking_issues_list: z.array(z.object({
    type: z.string(),
    description: z.string(),
    severity: SeverityEnum
  })),
  drafting_readiness_status: ReadinessEnum
});

const HIGH_CRITICALITY_CATEGORIES = [
  "case identity",
  "parties and representatives",
  "core procedural dates",
  "core procedural events",
  "claims",
  "requests",
  "central evidentiary support",
  "explicit documentary conflicts",
  "essential missing annexes"
];

// --- LOGIC FUNCTIONS ---

/**
 * Detects documentary insufficiency before LLM execution.
 */
function checkInputQuality(extractions: any[]) {
  const totalTextLength = extractions.reduce((acc, e) => acc + (JSON.stringify(e.extraction_json).length), 0);
  const totalDocs = extractions.length;
  const emptyExtractions = extractions.filter(e => !e.extraction_json || Object.keys(e.extraction_json).length === 0).length;

  const signals = {
    nearEmptyText: totalTextLength < 300,
    zeroUsableDocs: totalDocs === 0,
    allEmpty: emptyExtractions === totalDocs && totalDocs > 0,
    noisyContext: totalTextLength < 1000 && totalDocs > 5 // Many docs but very little content
  };

  const isBroken = signals.zeroUsableDocs || signals.allEmpty || (signals.nearEmptyText && totalDocs < 2);
  const quality = isBroken ? "BROKEN" : (signals.noisyContext ? "NOISY" : "GOOD");

  return { quality, signals };
}

/**
 * Evaluates the ledger and overrides readiness based on deterministic rules.
 */
function processValidationLayer(rawJson: any) {
  const issues: string[] = [];
  const overrides: string[] = [];
  
  // 1. Schema Validation (Aborts if malformed)
  const validation = DossierOutputSchema.safeParse(rawJson);
  if (!validation.success) {
    throw new Error(`Invalid Ledger Structure: ${validation.error.issues.map(i => i.message).join(", ")}`);
  }

  const data = validation.data;
  const ledger = data.strict_evidence_ledger;
  let finalStatus = data.drafting_readiness_status;

  // 2. Deterministic Logical Rules
  const hasConflicts = ledger.some(i => i.status === "CONFLICTING");
  const missingHigh = ledger.some(i => {
    const isHigh = HIGH_CRITICALITY_CATEGORIES.some(cat => i.category.toLowerCase().includes(cat));
    return isHigh && (i.status === "NOT_FOUND" || i.status === "INSUFFICIENT_EVIDENCE");
  });

  if (ledger.length === 0) {
    throw new Error("Validation Failure: Evidence ledger is empty.");
  }

  // CONFLICTING overrides everything
  if (hasConflicts && finalStatus !== "BLOCKED_CONFLICTING_RECORD") {
    finalStatus = "BLOCKED_CONFLICTING_RECORD";
    overrides.push("Forced BLOCKED due to conflicting evidence items.");
  } 
  // Missing HIGH items overrides READY
  else if (missingHigh && finalStatus !== "BLOCKED_MISSING_EVIDENCE") {
    finalStatus = "BLOCKED_MISSING_EVIDENCE";
    overrides.push("Forced BLOCKED due to missing HIGH criticality items.");
  }
  // If all is FOUND and clean, but LLM said BLOCKED
  else if (!hasConflicts && !missingHigh && ledger.every(i => i.status === "FOUND") && finalStatus !== "READY_FOR_STAGE_2") {
    finalStatus = "READY_FOR_STAGE_2";
    overrides.push("Promoted to READY: All high criticality items found with source linkage.");
  }

  return {
    validatedData: {
      ...data,
      drafting_readiness_status: finalStatus
    },
    validationMetadata: {
      schema_valid: true,
      overrides_applied: overrides,
      high_criticality_missing: missingHigh,
      has_conflicts: hasConflicts,
      validation_timestamp: new Date().toISOString()
    }
  };
}

// --- MAIN HANDLER ---

const DEFAULT_SYSTEM_PROMPT = `Você é o NIJA_STAGE_1_EXECUTOR, o auditor forense do Flaito.
Sua tarefa é construir um Inventário de Evidências e um Mapa da Verdade completo e rigoroso.

DIRETRIZ CRÍTICA: TOLERÂNCIA ZERO A ALUCINAÇÃO.
- Marque como NOT_FOUND ou INSUFFICIENT_EVIDENCE se não houver prova direta.
- Marque como CONFLICTING se houver contradição documental.
- ITENS FOUND EXIGEM SOURCE LINKAGE (doc_id + section/span).

FORMATO DE SAÍDA (JSON):
{
  "evidence_inventory": "Markdown das 9 seções",
  "strict_evidence_ledger": [
    {
      "item_id": "string",
      "category": "string",
      "value": "string",
      "status": "FOUND | NOT_FOUND | CONFLICTING | INSUFFICIENT_EVIDENCE",
      "source": { "doc_id": "uuid", "section_id": "string", "span": "string", "page_ref": "string" },
      "notes": "string"
    }
  ],
  "blocking_issues_list": [
    { "type": "string", "description": "string", "severity": "BLOCKING | WARNING" }
  ],
  "drafting_readiness_status": "READY_FOR_STAGE_2 | BLOCKED_MISSING_EVIDENCE | BLOCKED_CONFLICTING_RECORD"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { case_id, office_id, pipeline_stage }: { case_id: string; office_id?: string; pipeline_stage?: string } = await req.json();

    if (!case_id) throw new Error("case_id é obrigatório.");

    // 0. Agent Config
    const { getAgentConfig } = await import("../_shared/agent-resolver.ts");
    const config = await getAgentConfig(supabase, "nija-consolidate-dossier", {
      office_id,
      pipeline_stage: pipeline_stage || "STAGE_1"
    });

    if (!config || !config.is_active) throw new Error("Agente Stage 1 desativado.");

    // 1. Fetch case documents and verify Stage 0 readiness
    const { data: caseDocs, error: dcError } = await supabase
      .from("documents")
      .select("id")
      .eq("case_id", case_id);
    
    if (dcError) throw dcError;
    const docIds = caseDocs?.map(d => d.id) || [];

    if (docIds.length > 0) {
      const { data: canonicals, error: canonicalError } = await supabase
        .from("nija_canonical_documents")
        .select("document_id, processing_status, input_quality_score")
        .in("document_id", docIds)
        .eq("processing_status", "COMPLETED");

      if (canonicalError) throw canonicalError;

      const processedIds = new Set(canonicals?.map(c => c.document_id));
      const missing = docIds.filter(id => !processedIds.has(id));

      if (missing.length > 0) {
        throw new Error(`Estágio 1 Bloqueado: Os documentos [${missing.join(", ")}] ainda não passaram pelo Processamento Canônico (Estágio 0).`);
      }

      const broken = canonicals?.filter(c => c.input_quality_score === "BROKEN");
      if (broken && broken.length > 0) {
        throw new Error(`Estágio 1 Bloqueado: Documentos corrompidos ou insuficientes detectados no Estágio 0.`);
      }
    }

    // 2. Fetch Extractions
    const { data: extractions, error: extError } = await supabase
      .from("nija_extractions")
      .select("extraction_json, document_id")
      .eq("case_id", case_id);

    if (extError) throw extError;

    const inputQuality = checkInputQuality(extractions || []);
    if (inputQuality.quality === "BROKEN") {
      throw new Error("Insuficiência Documental Crítica: Os documentos fornecidos não possuem conteúdo processável suficiente.");
    }

    const context = extractions.map(e => JSON.stringify({ doc_id: e.document_id, data: e.extraction_json })).join("\n---\n");

    // 2. LLM Execution
    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
    const completion = await openai.chat.completions.create({
      model: config.model || "gpt-4o",
      temperature: 0,
      messages: [
        { role: "system", content: config.system_prompt || DEFAULT_SYSTEM_PROMPT },
        { role: "user", content: `Extrações atômicas:\n\n${context}` },
      ],
      response_format: { type: "json_object" }
    });

    const aiContent = completion.choices[0].message.content;
    if (!aiContent) throw new Error("A IA retornou uma resposta vazia.");
    
    // 3. Validation Layer (Deterministic)
    const { validatedData, validationMetadata } = processValidationLayer(JSON.parse(aiContent));

    // 4. Persistence
    const { data: lastDossier } = await supabase
      .from("process_dossiers")
      .select("version")
      .eq("case_id", case_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (lastDossier?.version ?? 0) + 1;

    const { data: finalDossier, error: dbError } = await supabase
      .from("process_dossiers")
      .insert({
        case_id,
        office_id,
        version: nextVersion,
        evidence_inventory: validatedData.evidence_inventory,
        drafting_readiness_status: validatedData.drafting_readiness_status,
        fato_prova_map: validatedData.strict_evidence_ledger,
        lacunas_detectadas: validatedData.blocking_issues_list,
        full_analysis: {
          ...validatedData,
          stage_1_validation: {
            ...validationMetadata,
            input_quality: inputQuality
          }
        },
        documentos_utilizados: extractions.map(e => e.document_id),
        config_resolver_id: config.resolution.config_id
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return new Response(JSON.stringify({
      success: true,
      dossier_id: finalDossier.id,
      readiness: validatedData.drafting_readiness_status,
      quality: inputQuality.quality
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[nija-consolidate-dossier] Validation Layer Error:", error);
    // Generic error for user, full error in logs
    return new Response(JSON.stringify({ 
      error: "Falha na validação do dossiê ou insuficiência de dados.",
      details: error.message.includes("Invalid Ledger") ? "Estrutura do documento inválida." : error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


