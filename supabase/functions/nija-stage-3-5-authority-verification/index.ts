import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import OpenAI from "https://esm.sh/openai@4.24.1";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- SCHEMAS ---

const Status35Enum = z.enum(["READY_FOR_DRAFTING", "HUMAN_REVIEW_REQUIRED", "BLOCKED_UNVERIFIED_AUTHORITIES"]);

const AuthoritySchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  title: z.string(),
  identifier: z.string().optional(),
  source_url: z.string().optional(),
  confidence_score: z.number().optional()
});

const VerificationOutputSchema = z.object({
  verified_authorities: z.array(AuthoritySchema),
  rejected_authorities: z.array(z.object({
    title: z.string(),
    reason: z.string()
  })),
  authority_support_map: z.array(z.object({
    argument: z.string(),
    linked_authority_ids: z.array(z.string())
  })),
  playbook_compatibility_report: z.object({
    status: z.string(),
    deviations: z.array(z.string()),
    recommendation: z.string()
  }),
  citation_readiness_status: Status35Enum
});

// --- LOGIC ---

async function fetchApprovedKnowledge(supabase: any, office_id: string) {
  const { data, error } = await supabase
    .from("office_knowledge")
    .select("*")
    .eq("office_id", office_id)
    .eq("is_active", true);
    
  if (error) throw error;
  return data || [];
}

// --- MAIN ---

const STAGE_3_5_SYSTEM_PROMPT = `Você é o NIJA_STAGE_3_5_VERIFIER, o auditor de autoridade legal do Flaito.
Sua missão é verificar se a estratégia do Estágio 3 está suportada por autoridades reais e aprovadas.

DIRETRIZES CRÍTICAS:
- NÃO escreva petições.
- NÃO invente citações. 
- REJEITE qualquer autoridade que não conste na base de conhecimento oficial fornecida.
- VERIFIQUE se os identificadores (RE, Lei, Súmula) batem exatamente com a base.
- ANALISE o alinhamento com o Playbook do escritório.

ESTRUTURA DE SAÍDA (JSON):
{
  "verified_authorities": [{ "type": "string", "title": "string", "identifier": "string", "source_url": "string" }],
  "rejected_authorities": [{ "title": "string", "reason": "string" }],
  "authority_support_map": [{ "argument": "string", "linked_authority_ids": ["string"] }],
  "playbook_compatibility_report": { "status": "COMPATIBLE | DEVIATED", "deviations": ["string"], "recommendation": "string" },
  "citation_readiness_status": "READY_FOR_DRAFTING | HUMAN_REVIEW_REQUIRED | BLOCKED_UNVERIFIED_AUTHORITIES"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { dossier_id, office_id }: { dossier_id: string; office_id?: string } = await req.json();
    if (!dossier_id) throw new Error("dossier_id (Stage 3) é obrigatório.");

    // 1. Fetch Stage 3 Dossier
    const { data: stage3Dossier, error: s3Error } = await supabase
      .from("process_dossiers")
      .select("*")
      .eq("id", dossier_id)
      .single();

    if (s3Error || !stage3Dossier) throw new Error("Dossiê Estágio 3 não encontrado.");

    const finalOfficeId = stage3Dossier.office_id || office_id;

    // 2. Fetch Knowledge Base (Playbooks, Precedents, Laws)
    const approvedKnowledge = await fetchApprovedKnowledge(supabase, finalOfficeId);

    // 3. LLM Verification
    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        { role: "system", content: STAGE_3_5_SYSTEM_PROMPT },
        { role: "user", content: `Estratégia Estágio 3: ${JSON.stringify(stage3Dossier.selected_strategy)}\n\nArgumentos: ${JSON.stringify(stage3Dossier.argument_structure)}\n\nBase de Conhecimento Aprovada:\n${JSON.stringify(approvedKnowledge)}` },
      ],
      response_format: { type: "json_object" }
    });

    const aiContent = completion.choices[0].message.content;
    if (!aiContent) throw new Error("A IA retornou uma resposta vazia.");
    
    const rawStage35 = JSON.parse(aiContent);

    // 4. Deterministic Validation
    const validation = VerificationOutputSchema.safeParse(rawStage35);
    if (!validation.success) {
      throw new Error(`Erro na estrutura de Verificação: ${validation.error.issues.map(i => i.message).join(", ")}`);
    }

    const verificationData = validation.data;
    
    // Deterministic Rule: If primary arguments lack verified authority -> Block
    let finalStatus = verificationData.citation_readiness_status;
    if (verificationData.verified_authorities.length === 0 && verificationData.rejected_authorities.length > 0) {
      finalStatus = "BLOCKED_UNVERIFIED_AUTHORITIES";
    }

    // 5. Persistence (Immutable Version++)
    const { data: versionDossier } = await supabase
      .from("process_dossiers")
      .select("version")
      .eq("case_id", stage3Dossier.case_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (versionDossier?.version ?? 0) + 1;

    const { data: stage35Record, error: dbError } = await supabase
      .from("process_dossiers")
      .insert({
        case_id: stage3Dossier.case_id,
        office_id: finalOfficeId,
        version: nextVersion,
        parent_stage_3_id: dossier_id, // Linking to Stage 3
        verified_authorities: verificationData.verified_authorities,
        rejected_authorities: verificationData.rejected_authorities,
        authority_support_map: verificationData.authority_support_map,
        playbook_compatibility_report: verificationData.playbook_compatibility_report,
        citation_readiness_status: finalStatus,
        // Propagate metadata
        selected_strategy: stage3Dossier.selected_strategy,
        argument_structure: stage3Dossier.argument_structure,
        fato_prova_map: stage3Dossier.fato_prova_map,
        evidence_inventory: stage3Dossier.evidence_inventory,
        full_analysis: {
          ...stage3Dossier.full_analysis,
          stage_3_5_verification: verificationData
        }
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return new Response(JSON.stringify({
      success: true,
      dossier_id: stage35Record.id,
      status: finalStatus,
      verified_count: verificationData.verified_authorities.length,
      rejected_count: verificationData.rejected_authorities.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[nija-stage-3-5] Fatal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
