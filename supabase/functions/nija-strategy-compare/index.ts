// supabase/functions/nija-strategy-compare/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { NIJA_CORE_PROMPT } from "../_shared/nija-core-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StrategyCompareRequest {
  tipoAnalise: 'prescricao' | 'decadencia';
  naturezaPretensao: string;
  marcoInicial: {
    data: string;
    descricao: string;
  };
  notaTecnicaBase: string;
}

const SYSTEM_PROMPT = `${NIJA_CORE_PROMPT}

==================================================
### MÓDULO NIJA: COMPARADOR DE ESTRATÉGIAS ###
==================================================

Você é um assistente jurídico especializado em estratégia processual no direito brasileiro. Sua função é analisar uma nota técnica de prescrição/decadência e gerar 3 cenários estratégicos distintos para o caso.

CENÁRIOS A GERAR:
1. CONSERVADOR: Tese com menor risco, baseada em entendimentos consolidados e jurisprudência pacificada
2. PROVÁVEL: Tese equilibrada, com bom custo-benefício entre risco e resultado
3. AGRESSIVO: Tese inovadora ou minoritária, com maior risco mas potencial de resultado mais favorável

PARA CADA CENÁRIO, FORNEÇA:
1. tese_central: Resumo claro e direto da tese (1-2 frases)
2. fundamentos_legais: Array de dispositivos legais e precedentes (APENAS os que existem de fato, se não tiver certeza, não cite)
3. pontos_controvertidos: Array de pontos onde há divergência ou incerteza
4. riscos_contramedidas: Array de objetos {risco, contramedida} com riscos e como mitigá-los
5. proximos_passos: Array de ações práticas ordenadas para implementar a estratégia

REGRAS ABSOLUTAS:
- NUNCA invente artigos de lei, súmulas ou julgados
- Se não tiver certeza sobre um fundamento, indique "Verificar em fonte oficial"
- Seja específico e prático nos próximos passos
- Mantenha linguagem técnica jurídica mas acessível

FORMATO DE RESPOSTA:
Retorne APENAS um JSON válido no seguinte formato, sem texto adicional:
{
  "cenarios": [
    {
      "tipo": "conservador",
      "tese_central": "...",
      "fundamentos_legais": ["...", "..."],
      "pontos_controvertidos": ["...", "..."],
      "riscos_contramedidas": [{"risco": "...", "contramedida": "..."}],
      "proximos_passos": ["...", "..."]
    },
    {
      "tipo": "provavel",
      ...
    },
    {
      "tipo": "agressivo",
      ...
    }
  ]
}`;

serve(async (req) => {
  // Preflight CORS - Safari fix: always return Content-Type: application/json
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    const payload: StrategyCompareRequest = await req.json();
    
    console.log('[NIJA Strategy] start', { tipo: payload.tipoAnalise });

    // NIJA Fase 1: Guardrail - verificar tamanho mínimo da nota técnica
    const MIN_CHARS_REQUIRED = 1500;
    const notaTecnica = payload.notaTecnicaBase || "";
    if (notaTecnica.length < MIN_CHARS_REQUIRED) {
      console.error(`[NIJA Strategy] Nota técnica muito curta: ${notaTecnica.length} chars`);
      return new Response(
        JSON.stringify({
          error: "LEITURA_INSUFICIENTE",
          message: `Nota técnica muito curta (${notaTecnica.length} caracteres). Mínimo necessário: ${MIN_CHARS_REQUIRED} caracteres.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const tipoLabel = payload.tipoAnalise === 'decadencia' ? 'decadência' : 'prescrição';

    const userPrompt = `Com base na análise de ${tipoLabel} abaixo, gere 3 cenários estratégicos (conservador, provável, agressivo):

NATUREZA DA PRETENSÃO/DIREITO: ${payload.naturezaPretensao}

MARCO INICIAL:
- Data: ${payload.marcoInicial.data}
- Descrição: ${payload.marcoInicial.descricao}

NOTA TÉCNICA BASE:
${payload.notaTecnicaBase}

Gere os 3 cenários estratégicos em formato JSON conforme especificado.`;

    console.log('[NIJA Strategy] fetch AI gateway');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[NIJA Strategy] gateway error', { status: response.status, body: errorText });

      if (errorText.toLowerCase().includes('overloaded')) {
        return new Response(
          JSON.stringify({ error: "Servidor ocupado. Aguarde e tente novamente." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao processar comparação de teses" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    console.log('[NIJA Strategy] raw response length:', rawContent.length);

    // Parse JSON from response
    let parsedCenarios;
    try {
      // Try to extract JSON from the response
      const jsonMatch = rawContent.match(/\{[\s\S]*"cenarios"[\s\S]*\}/);
      if (jsonMatch) {
        parsedCenarios = JSON.parse(jsonMatch[0]);
      } else {
        // Try parsing the whole content as JSON
        parsedCenarios = JSON.parse(rawContent);
      }
    } catch (parseErr) {
      console.error('[NIJA Strategy] JSON parse error:', parseErr);
      console.error('[NIJA Strategy] Raw content:', rawContent.substring(0, 500));
      
      // Return a fallback structure with the raw content
      return new Response(
        JSON.stringify({ 
          error: "Não foi possível processar a resposta. Tente novamente.",
          rawContent: rawContent.substring(0, 1000)
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('[NIJA Strategy] success, cenarios count:', parsedCenarios?.cenarios?.length);

    return new Response(
      JSON.stringify(parsedCenarios),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('[NIJA Strategy] error', { message: error instanceof Error ? error.message : 'unknown' });
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
