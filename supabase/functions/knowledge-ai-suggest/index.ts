import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SuggestedPrecedent {
  tribunal: string;
  tipo: string;
  numero: string | null;
  tese: string;
  observacao: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Query inválida", suggestions: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const systemPrompt = `Você é um assistente jurídico especializado em direito brasileiro.
Sua tarefa é sugerir precedentes jurídicos relevantes com base no tema fornecido pelo usuário.

Para cada precedente sugerido, retorne:
- tribunal: STJ, STF, TST, TRT, TJ ou outro tribunal competente
- tipo: Súmula, Súmula Vinculante, Acórdão, Tema Repetitivo, OJ, ou outro tipo aplicável
- numero: número do precedente se aplicável (ex: "382" para Súmula 382)
- tese: resumo da tese em 2-4 linhas

Retorne exatamente 3 a 5 precedentes mais relevantes para o tema.
Foque em precedentes consolidados e amplamente aplicados.
Responda APENAS com JSON válido no formato especificado, sem texto adicional.`;

    const userPrompt = `Sugira precedentes jurídicos relevantes para o seguinte tema:

"${query.trim()}"

Responda no formato JSON:
{
  "precedentes": [
    {
      "tribunal": "STJ",
      "tipo": "Súmula",
      "numero": "123",
      "tese": "Texto da tese resumida em 2-4 linhas."
    }
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos.", suggestions: [] }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos para continuar.", suggestions: [] }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`Erro no gateway de IA: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON da resposta
    let parsed: { precedentes?: SuggestedPrecedent[] } = { precedentes: [] };
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseErr) {
      console.error("Erro ao parsear resposta da IA:", parseErr, content);
      return new Response(
        JSON.stringify({ 
          error: "Erro ao processar sugestões da IA", 
          suggestions: [],
          raw: content 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const suggestions: SuggestedPrecedent[] = (parsed.precedentes || []).map((p) => ({
      tribunal: p.tribunal || "Desconhecido",
      tipo: p.tipo || "Precedente",
      numero: p.numero || null,
      tese: p.tese || "",
      observacao: "Sugestão gerada por IA – confirmar antes de usar.",
    }));

    return new Response(
      JSON.stringify({ suggestions, query: query.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("knowledge-ai-suggest error:", err);
    return new Response(
      JSON.stringify({ 
        error: err instanceof Error ? err.message : "Erro desconhecido",
        suggestions: [] 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
