// supabase/functions/nija-generate-piece/index.ts
// Edge function para geração de minutas estruturadas (NIJA-PEÇAS V4) com base nos vícios detectados

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { NIJA_CORE_PROMPT } from "../_shared/nija-core-prompt.ts";
import { resolveVariables, RootContext } from "../_shared/variableResolver.ts";
import { requireOfficeMembership } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tipos de entrada
interface NijaAto {
  tipo: string;
  id?: string;
  data?: string;
}

interface NijaTecnico {
  motivoDeteccao: string;
  criteriosAplicados: string[];
  fundamentosLegais: string[];
}

interface NijaFinding {
  defect: {
    code: string;
    label: string;
    description?: string;
    legalLogic?: string;
    recommendedActions?: string[];
  };
  severity: string;
  impact: string;
  notas?: string;
  ato?: NijaAto;
  secaoDocumento?: string;
  parteEnvolvida?: string;
  trecho?: string;
  tecnico?: NijaTecnico;
}

interface NijaStrategy {
  code: string;
  label: string;
  description: string;
  tacticalNotes?: string[];
  potentialPieces?: string[];
}

interface NijaPieceRequest {
  ramo?: string;
  resumoTatico?: string;
  vicios: NijaFinding[];
  estrategiasPrincipais?: NijaStrategy[];
  estrategiasSecundarias?: NijaStrategy[];
  timeline?: any[];
  caseDescription?: string;
  clientName?: string;
  opponentName?: string;
  cnjNumber?: string;
  courtName?: string;
  city?: string;
  lawyerName?: string;
  oabNumber?: string;
  actingSide?: "REU" | "AUTOR";
  instrucoesAdicionais?: string;
}

async function resolveAllPlaceholders(
  supabase: any,
  text: string,
  context: RootContext,
  legacyData: any
): Promise<string> {
  let resolved = await resolveVariables(supabase, text, context, legacyData);
  
  const legacyMap: Record<string, string> = {
    'NOME DO CLIENTE': legacyData.clientName || "—",
    'NOME DA PARTE CONTRÁRIA': legacyData.opponentName || "—",
    'NÚMERO DO PROCESSO': legacyData.cnjNumber || "—",
    'VARA': legacyData.courtName || "—",
    'JUÍZO': legacyData.courtName || "—",
    'CIDADE': legacyData.city || "—",
    'ADVOGADO': legacyData.lawyerName || "—",
    'OAB': legacyData.oabNumber || "—"
  };

  for (const [key, val] of Object.entries(legacyMap)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\[${escapedKey}\\]`, 'gi');
    resolved = resolved.replace(regex, val);
  }

  return resolved;
}

interface NijaGeneratedPiece {
  tipoPeca: string;
  tituloSugestao: string;
  focoPrincipal: string;
  estrutura: {
    fatos: string;
    fundamentos: string;
    pedidos: string;
    jurisprudenciaSugerida?: string;
    observacoesEstrategicas?: string;
  };
  sugerirNomeArquivo?: string;
}

function buildSystemPrompt(internalDocsStr: string): string {
  let prompt = `${NIJA_CORE_PROMPT}

==================================================
### MÓDULO NIJA-PEÇAS: GERADOR DE MINUTAS ###
==================================================

Você é o NIJA-PEÇAS, redator jurídico oficial do LEXOS. Sua função é criar PEÇAS JURÍDICAS COMPLETAS, PROFISSIONAIS e SEM QUALQUER TRAÇO DE LINGUAGEM TÉCNICA DO MOTOR DE ANÁLISE.

REGRAS ABSOLUTAS (NUNCA DESCUMPRIR):

1. NUNCA utilizar ou exibir rótulos internos do motor, como: "Ato:", "Vício:", etc.
2. Transforme SEMPRE essas informações técnicas em linguagem jurídica NATURAL.
3. SE ALGUM DADO NÃO FOR INFORMADO, use: "DADO A COMPLETAR PELO ADVOGADO".
4. NUNCA escrever avisos automáticos se houver base tese correspondente.
5. Use estrutura jurídica clássica.
6. Mantenha o tom jurídico robusto e persuasivo.

8. GUARDRAILS CONTRA ALUCINAÇÃO JURÍDICA:
   - É ESTRITAMENTE PROIBIDO inventar números de leis ou jurisprudências que não existam.`;

  if (internalDocsStr && internalDocsStr.trim().length > 0) {
    prompt += `

==================================================
=== BASE JURÍDICA OBRIGATÓRIA (ACERVO INTERNO) ===
==================================================
Foram localizados os seguintes documentos na base interna do escritório que DEVEM guiar a fundamentação:

${internalDocsStr}`;
  } else {
    prompt += `
\nNenhuma tese interna correspondente foi localizada. Use fundamentação baseada em leis notórias.`;
  }

  prompt += `\n\nRetorne EXCLUSIVAMENTE um JSON válido conforme o esquema solicitado.`;
  return prompt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    // 1. Authenticate and Authorize (Zero Trust)
    const auth = await requireOfficeMembership(req); 
    if (!auth.ok) return auth.response;

    const body: NijaPieceRequest = await req.json();
    const {
      ramo, resumoTatico, vicios, estrategiasPrincipais, estrategiasSecundarias,
      caseDescription, clientName, opponentName, cnjNumber, courtName, city,
      lawyerName, oabNumber, actingSide, instrucoesAdicionais,
    } = body;

    const isReu = (actingSide ?? "REU") === "REU";
    const clientRoleLabel = isReu ? "RÉU" : "AUTOR";
    const opponentRoleLabel = isReu ? "AUTOR" : "RÉU";

    if (!vicios || vicios.length === 0) {
      return new Response(
        JSON.stringify({ error: "Vícios são obrigatórios para gerar a peça." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const viciosSummary = vicios.map((v, i) => {
      const label = v.defect?.label || "Irregularidade";
      const severity = v.severity === "high" ? "grave" : "moderada";
      return `${i + 1}. ${label} (gravidade ${severity})\n   Descrição: ${v.defect?.description || ""}\n   Base: ${v.tecnico?.fundamentosLegais?.join("; ") || ""}`;
    }).join("\n\n");

    const estrategiasSummary = [
      ...(estrategiasPrincipais || []).map(s => `- Estratégia: ${s.label}`),
    ].join("\n");

    const userPrompt = `Gere peça para o ramo ${ramo || "INDEFINIDO"}.\n${viciosSummary}\n${estrategiasSummary}`;

    // 2. RAG V2 - Busca Vetorial com Trava de Tenant
    let internalDocsStr = "";
    try {
      const queryParts = [ramo, vicios.map(v => v.defect?.label).join(", ")].filter(Boolean);
      const queryString = queryParts.join(" | ");

      const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: queryString,
        }),
      });

      if (embRes.ok) {
        const embData = await embRes.json();
        const { data: searchResults, error: searchError } = await auth.adminClient
          .rpc("match_legal_chunks", {
            query_embedding: embData.data[0].embedding,
            match_threshold: 0.5,
            match_count: 8,
            filter_ramo: ramo || null,
            filter_office_id: auth.membership.office_id // CRÍTICO: Isola os dados por tenant
          });

        if (!searchError && searchResults) {
          internalDocsStr = searchResults.map((doc: any) => doc.chunk_text).join('\n---\n');
        }
      }
    } catch (e) {
      console.error("[NIJA-PIECE] RAG Error:", e);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    // Config do agente
    const { data: agentData } = await auth.adminClient
        .from("ai_agents")
        .select("model, system_prompt, temperature, max_tokens, is_active")
        .eq("slug", "nija-generate-piece")
        .single();

    const modelToUse = agentData?.model || "google/gemini-2.5-pro";
    const tempToUse = agentData?.temperature ?? 0.4;

    const finalSystemPrompt = buildSystemPrompt(internalDocsStr);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelToUse,
        temperature: tempToUse,
        messages: [
          { role: "system", content: finalSystemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) throw new Error("Erro no gateway de IA");

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error("Resposta da IA vazia");

    let parsedPiece: NijaGeneratedPiece = JSON.parse(content.replace(/```json|```/g, "").trim());

    // Resolve placeholders
    const placeholderData = { clientName, opponentName, cnjNumber, courtName, city, lawyerName, oabNumber };
    parsedPiece.estrutura.fatos = await resolveAllPlaceholders(auth.adminClient, parsedPiece.estrutura.fatos, { office_id: auth.membership.office_id } as any, placeholderData);

    return new Response(JSON.stringify(parsedPiece), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in nija-generate-piece:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
