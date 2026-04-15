import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import OpenAI from "https://esm.sh/openai@4.24.1";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- SCHEMAS ---

const AssemblyModeEnum = z.enum(["DETERMINISTIC_ONLY", "CONTROLLED_COMPOSITION", "VERBATIM_TEMPLATE"]);

const AssemblyBlockSchema = z.object({
  block_id: z.string(),
  mode: AssemblyModeEnum,
  template_id: z.string().optional(),
  title: z.string(),
  content: z.string(),
  ledger_ids: z.array(z.string()).optional(),
  authority_ids: z.array(z.string()).optional(),
  placeholders_found: z.array(z.string()).optional()
});

const Stage4OutcomeSchema = z.object({
  assembled_document_markdown: z.string(),
  assembly_map: z.array(AssemblyBlockSchema),
  placeholder_status: z.object({
    resolved: z.array(z.string()),
    missing: z.array(z.string())
  }),
  stage_4_readiness_status: z.enum(["READY_FOR_AUDIT", "HUMAN_REVIEW_REQUIRED", "BLOCKED_ASSEMBLY"])
});

// --- HELPER: Handlebars-lite Resolver ---
function resolvePlaceholders(text: string, data: any): { content: string, resolved: string[], missing: string[] } {
  const resolved: string[] = [];
  const missing: string[] = [];
  
  const content = text.replace(/\{\{\s*([a-zA-Z0-9._]+)\s*\}\}/g, (match, key) => {
    const val = key.split('.').reduce((o: any, i: any) => (o && o[i] !== undefined ? o[i] : undefined), data);
    if (val !== undefined && val !== null && val !== "") {
      resolved.push(key);
      return String(val);
    } else {
      missing.push(key);
      return `[MISSING: ${key}]`;
    }
  });
  
  return { content, resolved, missing };
}

// --- MAIN AI PROMPT ---
const STAGE_4_SYSTEM_PROMPT = `Você é o NIJA_STAGE_4_ASSEMBLER. Sua função é montar o corpo de um documento jurídico baseado estritamente em dados validados.

REGRAS DE OURO:
1. NÃO invente fatos ou teorias. Use apenas o Ledger e a Estratégia fornecida.
2. NÃO use metadados (IDs) no corpo do texto Markdown.
3. Para blocos CONTROLLED_COMPOSITION, crie uma narrativa fluida baseada nos ledger_ids indicados.
4. Mantenha as citações verificadas exatamente como fornecidas no Estágio 3.5.
5. Se faltar um dado essencial, use a sintaxe [MISSING: CHAVE].

ESTRUTURA DE SAÍDA:
Retorne um objeto JSON contendo o Markdown final e o mapeamento de blocos conforme o esquema Zod.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { dossier_id, office_id }: { dossier_id: string; office_id?: string } = await req.json();
    if (!dossier_id) throw new Error("dossier_id (Stage 3.5) é obrigatório.");

    // 1. Fetch Stage 3.5 Dossier
    const { data: stage35Dossier, error: s35Error } = await supabase
      .from("process_dossiers")
      .select("*")
      .eq("id", dossier_id)
      .single();

    if (s35Error || !stage35Dossier) throw new Error("Dossiê Estágio 3.5 não encontrado.");

    // 2. Security Gatekeeper
    if (stage35Dossier.citation_readiness_status !== "READY_FOR_DRAFTING") {
      throw new Error(`Montagem abortada: Status de autoridade é '${stage35Dossier.citation_readiness_status}'.`);
    }

    const finalOfficeId = stage35Dossier.office_id || office_id;

    // 3. Fetch Knowledge (Templates & Clauses)
    const { data: knowledge } = await supabase
      .from("office_knowledge")
      .select("*")
      .eq("office_id", finalOfficeId)
      .in("type", ["piece", "clause", "playbook"]);

    // 4. Data Preparation for Replacement
    // Merging entities from dossier and strategy
    const templateData = {
      client: stage35Dossier.full_analysis?.stage_1_validation?.entities?.client || {},
      court: stage35Dossier.full_analysis?.stage_1_validation?.entities?.court || {},
      case: {
        number: stage35Dossier.full_analysis?.case_metadata?.case_number || "NO_NUMBER",
        type: stage35Dossier.selected_strategy?.type
      },
      today: new Date().toLocaleDateString('pt-BR')
    };

    // 5. Orchestrate Assembly with LLM
    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
    
    // We send the full context but ask for a block-by-block response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        { role: "system", content: STAGE_4_SYSTEM_PROMPT },
        { role: "user", content: `
          CONTEXTO DE MONTAGEM:
          - Estratégia Selecionada: ${JSON.stringify(stage35Dossier.selected_strategy)}
          - Argumentação: ${JSON.stringify(stage35Dossier.argument_structure)}
          - Autoridades Verificadas: ${JSON.stringify(stage35Dossier.verified_authorities)}
          - Itens do Ledger (Evidências): ${JSON.stringify(stage35Dossier.factual_summary)} 
          - Bibliotecas Aprovadas (Templates/Clauses): ${JSON.stringify(knowledge)}
          - Dados Existentes: ${JSON.stringify(templateData)}
        ` },
      ],
      response_format: { type: "json_object" }
    });

    const aiContent = completion.choices[0].message.content;
    if (!aiContent) throw new Error("A IA retornou uma resposta vazia.");
    
    const rawAssembly = JSON.parse(aiContent);

    // 6. Post-Processing: Deterministic Replacement on Blocks
    // We iterate over the AI-suggested blocks and run our deterministic resolver on them
    const finalBlocks = [];
    const allResolved: string[] = [];
    const allMissing: string[] = [];

    for (const block of rawAssembly.assembly_map || []) {
      const resolved = resolvePlaceholders(block.content, templateData);
      finalBlocks.push({
        ...block,
        content: resolved.content,
        placeholders_found: [...resolved.resolved, ...resolved.missing]
      });
      allResolved.push(...resolved.resolved);
      allMissing.push(...resolved.missing);
    }

    // 7. Validation & Formatting
    const finalMarkdown = finalBlocks.map(b => b.content).join("\n\n");
    
    let readiness = "READY_FOR_AUDIT";
    if (allMissing.length > 0) readiness = "HUMAN_REVIEW_REQUIRED";

    const assemblyOutcome = {
      assembled_document_markdown: finalMarkdown,
      assembly_map: finalBlocks,
      placeholder_status: {
        resolved: Array.from(new Set(allResolved)),
        missing: Array.from(new Set(allMissing))
      },
      stage_4_readiness_status: readiness
    };

    // 8. Persistence (Immutable Record)
    const { data: versionDossier } = await supabase
      .from("process_dossiers")
      .select("version")
      .eq("case_id", stage35Dossier.case_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (versionDossier?.version ?? 0) + 1;

    const { data: stage4Record, error: dbError } = await supabase
      .from("process_dossiers")
      .insert({
        case_id: stage35Dossier.case_id,
        office_id: finalOfficeId,
        version: nextVersion,
        parent_stage_3_5_id: dossier_id,
        assembled_document_markdown: assemblyOutcome.assembled_document_markdown,
        assembly_map: assemblyOutcome.assembly_map,
        placeholder_status: assemblyOutcome.placeholder_status,
        stage_4_readiness_status: assemblyOutcome.stage_4_readiness_status,
        // Propagate essential data
        selected_strategy: stage35Dossier.selected_strategy,
        argument_structure: stage35Dossier.argument_structure,
        verified_authorities: stage35Dossier.verified_authorities,
        full_analysis: {
          ...stage35Dossier.full_analysis,
          stage_4_assembly: {
             blocks_count: finalBlocks.length,
             missing_placeholders: allMissing.length
          }
        }
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return new Response(JSON.stringify({
      success: true,
      dossier_id: stage4Record.id,
      status: readiness,
      blocks_assembled: finalBlocks.length,
      missing_count: allMissing.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[nija-stage-4] Fatal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
