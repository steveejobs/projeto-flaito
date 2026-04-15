import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import OpenAI from "https://esm.sh/openai@4.24.1";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- SCHEMAS ---

const AuditStatusEnum = z.enum(["PASS", "WARN", "FAIL"]);
const SeverityEnum = z.enum(["CRITICAL", "MAJOR", "MINOR"]);

const AuditFindingSchema = z.object({
  dimension: z.string(),
  status: AuditStatusEnum,
  severity: SeverityEnum.optional(),
  message: z.string(),
  block_id: z.string().optional()
});

const AuditReportSchema = z.object({
  layers: z.object({
    structural: AuditStatusEnum,
    analytical: AuditStatusEnum
  }),
  dimensions: z.object({
    fact_integrity: AuditStatusEnum,
    authority_integrity: AuditStatusEnum,
    strategy_consistency: AuditStatusEnum,
    placeholder_integrity: AuditStatusEnum,
    playbook_compliance: AuditStatusEnum,
    logical_consistency: AuditStatusEnum
  }),
  findings: z.array(AuditFindingSchema),
  governance_7_blocks: z.object({
    fatos_ledger: z.string(),
    raciocinio_estrategico: z.string(),
    fundamentos_autoridade: z.string(),
    decisao_geracao: z.string(),
    audit_score: z.number(),
    integrity_hash: z.string(),
    protocolo_revisao: z.string()
  }),
  global_status: z.enum(["FINAL_APPROVED", "HUMAN_REVIEW_REQUIRED", "BLOCKED_HALLUCINATION_DETECTED"])
});

// --- CORE LOGIC ---

function runStructuralAudit(stage4: any, upstream: any): AuditFindingSchema[] {
  const findings: AuditFindingSchema[] = [];
  
  // 1. Placeholder Audit
  const missing = stage4.placeholder_status?.missing || [];
  if (missing.length > 0) {
    findings.push({
      dimension: "placeholder_integrity",
      status: "WARN",
      severity: "MAJOR",
      message: `Encontradas ${missing.length} variáveis não resolvidas (ex: ${missing.slice(0, 2).join(", ")}).`
    });
  }

  // 2. Traceability Audit (Structural)
  const assemblyMap = stage4.assembly_map || [];
  assemblyMap.forEach((block: any) => {
    if (block.mode === "CONTROLLED_COMPOSITION" && (!block.ledger_ids || block.ledger_ids.length === 0)) {
      findings.push({
        dimension: "fact_integrity",
        status: "FAIL",
        severity: "CRITICAL",
        message: "Bloco de composição livre sem vínculo de evidência no assembly_map.",
        block_id: block.block_id
      });
    }
  });

  return findings;
}

const STAGE_5_ANALYTICAL_PROMPT = `Você é o NIJA_STAGE_5_AUDITOR. Sua função é ANALISAR o documento Markdown final e compará-lo com os metadados de estratégia e autoridade.

DIMENSÕES DE AUDITORIA:
1. FACT_INTEGRITY: Existe alguma afirmação factual no texto que não esteja nos dados brutos (Ledger)?
2. AUTHORITY_INTEGRITY: Existe alguma citação (lei, jurisprudência) no texto que NÃO conste na lista de autoridades verificadas?
3. PLAYBOOK_COMPLIANCE: O documento segue a estrutura e tom exigidos pelo Playbook?
4. LOGICAL_CONSISTENCY: Os pedidos finais são suportados pela fundamentação apresentada?

ESTRUTURA DE RESPOSTA (JSON):
Retorne um objeto JSON seguindo o esquema AuditReportSchema (focando nos campos 'analytical' e 'findings').
NÃO tente corrigir o documento. Apenas reporte.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { dossier_id, office_id }: { dossier_id: string; office_id?: string } = await req.json();
    if (!dossier_id) throw new Error("dossier_id (Stage 4) é obrigatório.");

    // 1. Fetch Stage 4 Dossier (The target)
    const { data: stage4Dossier, error: s4Error } = await supabase
      .from("process_dossiers")
      .select("*")
      .eq("id", dossier_id)
      .single();

    if (s4Error || !stage4Dossier) throw new Error("Dossiê Estágio 4 não encontrado.");

    // 2. Structural Layer (Deterministic)
    const structuralFindings = runStructuralAudit(stage4Dossier, {});

    // 3. Analytical Layer (LLM Supplemental)
    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        { role: "system", content: STAGE_5_ANALYTICAL_PROMPT },
        { role: "user", content: `
          DOCUMENTO MONTADO:
          ${stage4Dossier.assembled_document_markdown}

          DADOS DE CONTROLE:
          - Estratégia: ${JSON.stringify(stage4Dossier.selected_strategy)}
          - Autoridades Verificadas: ${JSON.stringify(stage4Dossier.verified_authorities)}
          - Itens do Ledger: ${JSON.stringify(stage4Dossier.factual_summary)}
          - Mapeamento de Montagem: ${JSON.stringify(stage4Dossier.assembly_map)}
        ` },
      ],
      response_format: { type: "json_object" }
    });

    const aiContent = completion.choices[0].message.content;
    if (!aiContent) throw new Error("A IA retornou uma resposta de auditoria vazia.");
    
    const analyticalReport = JSON.parse(aiContent);

    // 4. Cálculo de Integridade do Artefato Final (SHA-256)
    const finalDocMarkdown = stage4Dossier.assembled_document_markdown || "";
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(finalDocMarkdown));
    const finalHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    // 5. Merge Reports
    const allFindings = [...structuralFindings, ...(analyticalReport.findings || [])];
    
    // Global Status Logic
    let globalStatus = analyticalReport.global_status || "FINAL_APPROVED";
    
    const hasFail = allFindings.some(f => f.status === "FAIL");
    const hasWarn = allFindings.some(f => f.status === "WARN");

    if (hasFail) globalStatus = "BLOCKED_HALLUCINATION_DETECTED";
    else if (hasWarn && globalStatus === "FINAL_APPROVED") globalStatus = "HUMAN_REVIEW_REQUIRED";

    const finalAuditReport = {
      layers: {
        structural: structuralFindings.some(f => f.status === "FAIL") ? "FAIL" : "PASS",
        analytical: analyticalReport.layers?.analytical || (hasFail ? "FAIL" : "PASS")
      },
      dimensions: analyticalReport.dimensions || {
        fact_integrity: "PASS",
        authority_integrity: "PASS",
        strategy_consistency: "PASS",
        placeholder_integrity: hasWarn ? "WARN" : "PASS",
        playbook_compliance: "PASS",
        logical_consistency: "PASS"
      },
      findings: allFindings,
      governance_7_blocks: {
        ...analyticalReport.governance_7_blocks,
        integrity_hash: finalHash,
        audit_score: analyticalReport.governance_7_blocks?.audit_score || (hasFail ? 40 : (hasWarn ? 75 : 95))
      },
      global_status: globalStatus
    };

    // 5. Persistence (Final Immutable Version)
    const { data: versionDossier } = await supabase
      .from("process_dossiers")
      .select("version")
      .eq("case_id", stage4Dossier.case_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (versionDossier?.version ?? 0) + 1;

    const { data: stage5Record, error: dbError } = await supabase
      .from("process_dossiers")
      .insert({
        case_id: stage4Dossier.case_id,
        office_id: stage4Dossier.office_id,
        version: nextVersion,
        parent_stage_4_id: dossier_id,
        audit_report: finalAuditReport,
        dossier_readiness_status: globalStatus,
        // Propagate Final Artifacts
        assembled_document_markdown: stage4Dossier.assembled_document_markdown,
        selected_strategy: stage4Dossier.selected_strategy,
        verified_authorities: stage4Dossier.verified_authorities,
        full_analysis: {
          ...stage4Dossier.full_analysis,
          stage_5_audit: finalAuditReport
        }
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return new Response(JSON.stringify({
      success: true,
      dossier_id: stage5Record.id,
      status: globalStatus,
      findings_count: allFindings.length,
      is_hallucination_free: !hasFail
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[nija-stage-5] Fatal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
