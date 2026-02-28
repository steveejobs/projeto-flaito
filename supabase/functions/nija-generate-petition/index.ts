// supabase/functions/nija-generate-petition/index.ts
// Edge function para geração de peças jurídicas com IA baseada nos vícios e estratégias do NIJA

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { NIJA_CORE_PROMPT } from "../_shared/nija-core-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

interface PetitionRequest {
  ramo: string;
  resumoTatico?: string;
  vicios?: NijaFinding[];
  estrategiasPrincipais?: NijaStrategy[];
  estrategiasSecundarias?: NijaStrategy[];
  textoBase?: string;
  engineTecnico?: any;
  findings?: NijaFinding[];
  selectedStrategy?: NijaStrategy;
  caseDescription?: string;
  clientName?: string;
  opponentName?: string;
  cnjNumber?: string;
  courtName?: string;
  city?: string;
  lawyerName?: string;
  oabNumber?: string;
  actingSide?: "REU" | "AUTOR"; // Perspectiva processual
}

const SYSTEM_PROMPT = `${NIJA_CORE_PROMPT}

==================================================
### MÓDULO NIJA: GERADOR DE PETIÇÕES ###
==================================================

Você é um assistente jurídico especializado em redigir peças processuais no direito brasileiro.

REGRAS ABSOLUTAS:
1. NUNCA invente números de processos, jurisprudência ou decisões específicas
2. Use APENAS marcadores [INSERIR JURISPRUDÊNCIA] onde citações específicas seriam necessárias
3. Mantenha linguagem técnica e formal do direito brasileiro
4. Estruture a peça de forma clara: FATOS, FUNDAMENTOS JURÍDICOS (DIREITO), PEDIDOS
5. Inclua aviso de que o texto precisa de revisão humana antes de uso
6. Respeite o ramo do direito indicado e seus procedimentos específicos
7. Baseie-se APENAS nos vícios e estratégias informados
8. Use os fundamentos legais fornecidos no campo "tecnico.fundamentosLegais" de cada vício
9. Cite os trechos processuais fornecidos para embasar as alegações
10. Identifique claramente qual ato/documento originou cada vício

FORMATO DE SAÍDA:
Retorne a peça em texto corrido, estruturada em seções claras.`;

serve(async (req) => {
  // Preflight CORS - Safari fix: always return Content-Type: application/json
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    const body: PetitionRequest = await req.json();
    const {
      ramo,
      resumoTatico,
      vicios,
      estrategiasPrincipais,
      estrategiasSecundarias,
      textoBase,
      findings,
      selectedStrategy,
      caseDescription,
      clientName,
      opponentName,
      cnjNumber,
      courtName,
      city,
      lawyerName,
      oabNumber,
      actingSide,
    } = body;

    // Usar vicios do novo formato ou findings do formato legado
    const viciosToUse = vicios || findings || [];
    const estrategiasToUse = estrategiasPrincipais || (selectedStrategy ? [selectedStrategy] : []);

    if (viciosToUse.length === 0) {
      return new Response(
        JSON.stringify({ error: "Vícios são obrigatórios para gerar a peça." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construir resumo detalhado dos vícios com contexto completo
    const viciosSummary = viciosToUse.map((v, i) => {
      const list: string[] = [];
      list.push(`${i + 1}. **${v.defect?.label || "Vício"}** (${v.defect?.code || "N/A"}) – ${v.severity || "N/A"}`);
      
      if (v.ato) {
        list.push(`- Ato: ${v.ato.tipo}${v.ato.data ? ` em ${v.ato.data}` : ""}`);
      }
      if (v.secaoDocumento) {
        list.push(`- Seção: ${v.secaoDocumento}`);
      }
      if (v.parteEnvolvida) {
        list.push(`- Parte envolvida: ${v.parteEnvolvida}`);
      }
      if (v.trecho) {
        list.push(`- Trecho: "${v.trecho}"`);
      }
      if (v.tecnico) {
        list.push(`- Motivo da detecção: ${v.tecnico.motivoDeteccao}`);
        if (v.tecnico.fundamentosLegais?.length > 0) {
          list.push(`- Fundamentos: ${v.tecnico.fundamentosLegais.join("; ")}`);
        }
      }
      if (v.notas) {
        list.push(`- Nota: ${v.notas}`);
      }
      
      return list.join("\n");
    }).join("\n\n");

    const estrategiasSummary = estrategiasToUse.map(s => 
      `- **${s.label}**: ${s.description}${s.potentialPieces?.length ? ` (Peças: ${s.potentialPieces.join(", ")})` : ""}`
    ).join("\n");

    // Determinar perspectiva processual
    const perspectiva = actingSide === "AUTOR" ? "AUTOR (parte ativa/reclamante)" : "RÉU (parte passiva/reclamado)";
    const clienteLabel = actingSide === "AUTOR" ? "Autor/Reclamante" : "Réu/Reclamado";
    const parteContrariaLabel = actingSide === "AUTOR" ? "Réu/Reclamado" : "Autor/Reclamante";

    const userPrompt = `
Gere uma peça jurídica completa com base nas seguintes informações:

## PERSPECTIVA PROCESSUAL (CRÍTICO!)
Você está atuando pelo: **${perspectiva}**
- Cliente que representamos: ${clienteLabel}
- Parte contrária: ${parteContrariaLabel}

A peça deve ser redigida INTEGRALMENTE na perspectiva de ${actingSide === "AUTOR" ? "ATAQUE" : "DEFESA"}.
${actingSide === "REU" 
  ? "Como réu, a peça deve focar em: contestar alegações, apontar vícios do autor, demonstrar ilegitimidade/carência de ação, requerer improcedência ou extinção."
  : "Como autor, a peça deve focar em: fundamentar pretensão, demonstrar direito, apontar vícios do réu, requerer procedência e condenação."
}

REGRA ABSOLUTA SOBRE O RAMO DO DIREITO:
1. Você NÃO PODE adivinhar ou inventar o ramo do direito.
2. Você SEMPRE deve usar EXCLUSIVAMENTE o valor recebido no campo "ramo".
3. Se "ramo" vier preenchido, repita exatamente esse valor no texto (sem adaptar).
4. Se "ramo" vier vazio, nulo ou indefinido, escreva no resumo: "Ramo identificado: INDEFINIDO – ramo não identificado com segurança. Confirme manualmente.".
5. É PROIBIDO escrever "TRABALHISTA" se o campo "ramo" não contiver "TRABALHISTA".

## RAMO DO DIREITO (campo obrigatório)
${ramo || "INDEFINIDO"}

## RESUMO TÁTICO
${resumoTatico || "Não informado"}

## VÍCIOS DETECTADOS (com contexto completo)
${viciosSummary}

## ESTRATÉGIAS SUGERIDAS
${estrategiasSummary || "Não especificadas - escolher a mais adequada aos vícios"}

## TEXTO-BASE / CONTEXTO ADICIONAL
${textoBase || caseDescription || "Não informado - adaptar conforme necessário"}

## PARTES (usar placeholders se não informado)
- ${clienteLabel} (nosso cliente): ${clientName || "[NOME DO CLIENTE]"}
- ${parteContrariaLabel} (parte contrária): ${opponentName || "[NOME DA PARTE CONTRÁRIA]"}

## PROCESSO
- Número CNJ: ${cnjNumber || "[NÚMERO DO PROCESSO]"}
- Juízo/Tribunal: ${courtName || "[JUÍZO COMPETENTE]"}
- Cidade/Comarca: ${city || "[CIDADE]"}

## ADVOGADO
- Nome: ${lawyerName || "[NOME DO ADVOGADO]"}
- OAB: ${oabNumber || "[NÚMERO OAB]"}

INSTRUÇÕES ESPECÍFICAS:
1. Na seção FATOS, use os trechos e atos identificados para construir a narrativa cronológica
2. Na seção FUNDAMENTOS, cite os fundamentos legais fornecidos para cada vício
3. Na seção PEDIDOS, formule pedidos específicos baseados nas estratégias sugeridas
4. Sempre que referenciar um vício, mencione o ato/documento de origem
5. Mantenha coerência com a perspectiva de ${actingSide === "AUTOR" ? "ATAQUE" : "DEFESA"} em toda a peça

Gere a peça processual mais adequada.
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Serviço de IA não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling AI gateway for petition generation...");
    
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errorText = await aiResponse.text();
      console.error(`AI gateway error: ${status} - ${errorText}`);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos para continuar." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao comunicar com serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "Resposta vazia do serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Petition generated successfully");

    // Retornar como texto da petição
    return new Response(JSON.stringify({ 
      petition: content,
      avisoRevisao: "ATENÇÃO: Este rascunho foi gerado automaticamente e DEVE ser revisado por advogado habilitado antes de qualquer uso."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in nija-generate-petition:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
