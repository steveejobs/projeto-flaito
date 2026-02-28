// supabase/functions/lexos-nija-timebar/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { NIJA_CORE_PROMPT } from "../_shared/nija-core-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `${NIJA_CORE_PROMPT}

==================================================
### MÓDULO NIJA: ANÁLISE TEMPORAL (TIMEBAR) ###
==================================================

Você é um assistente jurídico especialista em prescrição e decadência no direito brasileiro.

FUNÇÃO:
Analise os dados fornecidos e retorne SOMENTE um JSON válido com a análise temporal completa.

REGRAS ABSOLUTAS:
1. NUNCA invente artigos de lei, súmulas ou jurisprudência
2. Se não tiver certeza, indique "Verificar em fonte oficial"
3. Forneça datas precisas de prescrição/decadência quando possível
4. Identifique causas de suspensão e interrupção

FORMATO DE SAÍDA:
{
  "tipo": "prescricao" | "decadencia",
  "prazoAnos": number,
  "fundamentoLegal": "string com artigo específico",
  "marcoInicial": "data ISO ou descrição",
  "dataLimite": "data ISO calculada",
  "status": "em_curso" | "iminente" | "consumada" | "interrompida",
  "causasSuspensao": ["array de causas identificadas"],
  "causasInterrupcao": ["array de causas identificadas"],
  "risco": "baixo" | "medio" | "alto" | "critico",
  "recomendacoes": ["array de ações recomendadas"],
  "observacoes": "texto livre com análise adicional"
}`;

async function callAI(body: unknown) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(body) },
      ],
      stream: false,
    }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error("[NIJA Timebar] AI gateway error:", resp.status, errorText);
    
    if (resp.status === 429) {
      throw new Error("Limite de requisições excedido. Aguarde e tente novamente.");
    }
    if (resp.status === 402) {
      throw new Error("Créditos de IA esgotados. Adicione créditos ao workspace.");
    }
    
    throw new Error(`AI gateway error: ${resp.status}`);
  }

  const json = await resp.json();
  const content = json.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("No content in AI response");
  }

  try {
    // Clean markdown code blocks if present
    let jsonContent = content.trim();
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith("```")) {
      jsonContent = jsonContent.slice(0, -3);
    }
    return JSON.parse(jsonContent.trim());
  } catch {
    console.error("[NIJA Timebar] Failed to parse AI response as JSON:", content);
    return { raw: content, parseError: true };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data = await req.json();
    console.log("[NIJA Timebar] request:", JSON.stringify(data).slice(0, 500));
    
    const result = await callAI(data);
    console.log("[NIJA Timebar] response generated");
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[NIJA Timebar] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
