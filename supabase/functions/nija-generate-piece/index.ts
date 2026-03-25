// supabase/functions/nija-generate-piece/index.ts
// Edge function para geração de minutas estruturadas (NIJA-PEÇAS V4) com base nos vícios detectados

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { NIJA_CORE_PROMPT } from "../_shared/nija-core-prompt.ts";

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
}

// Função para normalizar placeholders na peça gerada
function normalizePlaceholders(
  text: string,
  data: {
    clientName?: string;
    opponentName?: string;
    cnjNumber?: string;
    courtName?: string;
    city?: string;
    lawyerName?: string;
    oabNumber?: string;
  }
): string {
  return text
    .replace(/\[NOME DO CLIENTE\]/gi, data.clientName || "DADO A COMPLETAR PELO ADVOGADO")
    .replace(/\[NOME DA PARTE CONTRÁRIA\]/gi, data.opponentName || "DADO A COMPLETAR PELO ADVOGADO")
    .replace(/\[NÚMERO DO PROCESSO\]/gi, data.cnjNumber || "DADO A COMPLETAR PELO ADVOGADO")
    .replace(/\[VARA\]/gi, data.courtName || "DADO A COMPLETAR PELO ADVOGADO")
    .replace(/\[JUÍZO\]/gi, data.courtName || "DADO A COMPLETAR PELO ADVOGADO")
    .replace(/\[CIDADE\]/gi, data.city || "DADO A COMPLETAR PELO ADVOGADO")
    .replace(/\[ADVOGADO\]/gi, data.lawyerName || "DADO A COMPLETAR PELO ADVOGADO")
    .replace(/\[OAB\]/gi, data.oabNumber || "DADO A COMPLETAR PELO ADVOGADO")
    .replace(/DADO A COMPLETAR PELO ADVOGADO/g, (match) => match);
}

// Tipo da resposta esperada da IA
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

const SYSTEM_PROMPT = `${NIJA_CORE_PROMPT}

==================================================
### MÓDULO NIJA-PEÇAS: GERADOR DE MINUTAS ###
==================================================

Você é o NIJA-PEÇAS, redator jurídico oficial do LEXOS. Sua função é criar PEÇAS JURÍDICAS COMPLETAS, PROFISSIONAIS e SEM QUALQUER TRAÇO DE LINGUAGEM TÉCNICA DO MOTOR DE ANÁLISE.

REGRAS ABSOLUTAS (NUNCA DESCUMPRIR):

1. NUNCA utilizar ou exibir rótulos internos do motor, como:
   - "Ato:", "Vício:", "ARQUIVO_PROCESSO", "CONTESTACAO", "SENTENCA", "ATO_DETECTADO"
   - "tecnico", "criteriosAplicados", "motivoDeteccao", "offset"
   - qualquer nome de enum, código, label do motor, tags internas ou identificadores

2. Transforme SEMPRE essas informações técnicas em linguagem jurídica NATURAL:
   - "Ato: ARQUIVO_PROCESSO" → "decisão que determinou o arquivamento"
   - "Ato: CONTESTACAO" → "contestação apresentada"
   - "Vício: ausência de fundamentação" → "houve ausência de fundamentação na decisão"
   - "trecho identificado" → escreva naturalmente: "conforme se verifica no trecho: '...'"

3. SE ALGUM DADO NÃO FOR INFORMADO (processo, vara, nome da parte, advogado):
   - Nunca usar colchetes técnicos
   - Use: "DADO A COMPLETAR PELO ADVOGADO"

4. NUNCA escrever avisos do tipo "A peça deve ser revisada…", "Gerado automaticamente…"

5. Use estrutura jurídica clássica: Endereçamento, Qualificação, Síntese dos Fatos, Fundamentos Jurídicos, Pedidos, Provas, Fechamento

6. Todas as análises, fundamentos e vícios detectados devem vir em linguagem jurídica limpa, SEM revelar funcionamento interno do NIJA

7. O texto final deve ter tom jurídico robusto, persuasivo e técnico, próprio de um advogado experiente

8. GUARDRAILS CONTRA ALUCINAÇÃO JURÍDICA (RISCO DE LITIGÂNCIA DE MÁ-FÉ):
   - É ESTRITAMENTE PROIBIDO inventar, alucinar ou criar números de leis, artigos, súmulas ou jurisprudências.
   - Limite-se APENAS à base legal e fatos fornecidos neste prompt, ou leis federais de amplo e inequívoco conhecimento.
   - NUNCA invente números de processos ou ementas de tribunais. Para exemplificar jurisprudência, use placeholders óbvios ou escreva "[O ADVOGADO DEVE INSERIR A JURISPRUDÊNCIA APLICÁVEL AQUI]".

FORMATO DE SAÍDA:
Retorne EXCLUSIVAMENTE um JSON válido no formato exato abaixo:
{
  "tipoPeca": "CONTESTACAO" | "APELACAO" | "EMBARGOS_DECLARACAO" | "AGRAVO" | "RECURSO_ESPECIAL" | "MANDADO_SEGURANCA" | "HABEAS_CORPUS" | "IMPUGNACAO" | "OUTRO",
  "tituloSugestao": "Título sugerido para a peça",
  "focoPrincipal": "Ex: cerceamento de defesa, prescrição intercorrente",
  "estrutura": {
    "fatos": "Narrativa cronológica dos fatos em linguagem jurídica natural",
    "fundamentos": "Fundamentação jurídica robusta e persuasiva",
    "pedidos": "Pedidos específicos e bem fundamentados",
    "jurisprudenciaSugerida": "Sugestões genéricas de jurisprudência (sem inventar números)",
    "observacoesEstrategicas": "Recomendações táticas para o advogado"
  },
  "sugerirNomeArquivo": "nome-sugerido-para-arquivo.docx"
}`;

serve(async (req) => {
  // Preflight CORS - Safari fix: always return Content-Type: application/json
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    const body: NijaPieceRequest = await req.json();
    console.log("Received nija-generate-piece request");

    const {
      ramo,
      resumoTatico,
      vicios,
      estrategiasPrincipais,
      estrategiasSecundarias,
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

    // Calcular perspectiva processual
    const isReu = (actingSide ?? "REU") === "REU";
    const clientRoleLabel = isReu ? "RÉU" : "AUTOR";
    const opponentRoleLabel = isReu ? "AUTOR" : "RÉU";

    // Validar vícios obrigatórios
    if (!vicios || vicios.length === 0) {
      console.log("No vicios provided, returning 400");
      return new Response(
        JSON.stringify({ error: "Vícios são obrigatórios para gerar a peça." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construir resumo dos vícios em linguagem natural (sem termos técnicos)
    const viciosSummary = vicios.map((v, i) => {
      const list: string[] = [];
      const label = v.defect?.label || "Irregularidade identificada";
      const severity = v.severity === "high" ? "grave" : v.severity === "medium" ? "moderada" : "leve";
      
      list.push(`${i + 1}. ${label} (gravidade ${severity})`);
      
      if (v.defect?.description) {
        list.push(`   Descrição: ${v.defect.description}`);
      }
      if (v.trecho) {
        list.push(`   Trecho relevante: "${v.trecho}"`);
      }
      if (v.tecnico?.fundamentosLegais && v.tecnico.fundamentosLegais.length > 0) {
        list.push(`   Base legal: ${v.tecnico.fundamentosLegais.join("; ")}`);
      }
      if (v.defect?.recommendedActions?.length) {
        list.push(`   Ações recomendadas: ${v.defect.recommendedActions.join("; ")}`);
      }
      if (v.notas) {
        list.push(`   Observação: ${v.notas}`);
      }
      
      return list.join("\n");
    }).join("\n\n");

    // Resumo das estratégias em linguagem natural
    const estrategiasSummary = [
      ...(estrategiasPrincipais || []).map(s => `- Estratégia principal: ${s.label} - ${s.description}`),
      ...(estrategiasSecundarias || []).map(s => `- Estratégia secundária: ${s.label} - ${s.description}`),
    ].join("\n");

    const userPrompt = `
Com base nas irregularidades identificadas abaixo, elabore uma peça jurídica profissional e completa.

REGRA ABSOLUTA SOBRE O RAMO DO DIREITO:
1. Você NÃO PODE adivinhar ou inventar o ramo do direito.
2. Você SEMPRE deve usar EXCLUSIVAMENTE o valor recebido no campo "ramo".
3. Se "ramo" vier preenchido (ex.: "CIVIL"), repita exatamente esse valor no texto (sem adaptar).
4. Se "ramo" vier vazio, nulo ou indefinido, escreva no resumo: "Ramo identificado: INDEFINIDO – ramo não identificado com segurança. Confirme manualmente.".
5. É PROIBIDO escrever "TRABALHISTA" se o campo "ramo" não contiver "TRABALHISTA".

RAMO DO DIREITO (campo obrigatório): ${ramo || "INDEFINIDO"}

RESUMO DO CASO: ${resumoTatico || "Caso em análise"}

IRREGULARIDADES IDENTIFICADAS:
${viciosSummary}

ESTRATÉGIAS RECOMENDADAS:
${estrategiasSummary || "Escolher a mais adequada às irregularidades"}

CONTEXTO: ${caseDescription || "Adaptar conforme necessário"}

DADOS DO PROCESSO:
- Cliente (${clientRoleLabel}): ${clientName || "DADO A COMPLETAR PELO ADVOGADO"}
- Parte contrária (${opponentRoleLabel}): ${opponentName || "DADO A COMPLETAR PELO ADVOGADO"}
- Número do processo: ${cnjNumber || "DADO A COMPLETAR PELO ADVOGADO"}
- Juízo: ${courtName || "DADO A COMPLETAR PELO ADVOGADO"}
- Cidade: ${city || "DADO A COMPLETAR PELO ADVOGADO"}
- Advogado: ${lawyerName || "DADO A COMPLETAR PELO ADVOGADO"}
- OAB: ${oabNumber || "DADO A COMPLETAR PELO ADVOGADO"}

PERSPECTIVA PROCESSUAL:
Atue SEMPRE na perspectiva da parte representada (${clientRoleLabel}), estruturando a peça como ${isReu ? "defesa" : "ataque"} do ${clientRoleLabel}.

INSTRUÇÕES:
1. Escolha o tipo de peça mais adequado às irregularidades
2. Construa narrativa dos fatos em linguagem jurídica natural
3. Fundamente juridicamente cada ponto de forma persuasiva
4. Formule pedidos específicos e bem fundamentados
5. NÃO inclua avisos sobre revisão ou geração automática
6. NÃO use termos técnicos internos do sistema

Retorne APENAS o JSON no formato especificado.
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Serviço de IA não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling AI gateway for piece generation...");
    
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

    console.log("AI response received, parsing JSON...");

    // Tentar extrair JSON da resposta
    let parsedPiece: NijaGeneratedPiece;
    try {
      // Limpar markdown code blocks se presentes
      let jsonContent = content.trim();
      if (jsonContent.startsWith("```json")) {
        jsonContent = jsonContent.slice(7);
      } else if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent.slice(3);
      }
      if (jsonContent.endsWith("```")) {
        jsonContent = jsonContent.slice(0, -3);
      }
      
      parsedPiece = JSON.parse(jsonContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      console.error("Raw content:", content.substring(0, 500));
      
      // Tentar extrair JSON do conteúdo
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedPiece = JSON.parse(jsonMatch[0]);
        } catch {
          return new Response(
            JSON.stringify({ error: "Não foi possível processar a resposta da IA" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Formato de resposta inválido" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Normalizar placeholders na estrutura
    if (parsedPiece.estrutura) {
      const placeholderData = { clientName, opponentName, cnjNumber, courtName, city, lawyerName, oabNumber };
      parsedPiece.estrutura.fatos = normalizePlaceholders(parsedPiece.estrutura.fatos || "", placeholderData);
      parsedPiece.estrutura.fundamentos = normalizePlaceholders(parsedPiece.estrutura.fundamentos || "", placeholderData);
      parsedPiece.estrutura.pedidos = normalizePlaceholders(parsedPiece.estrutura.pedidos || "", placeholderData);
    }

    console.log("Piece generated successfully:", parsedPiece.tipoPeca);

    return new Response(JSON.stringify(parsedPiece), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in nija-generate-piece:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
