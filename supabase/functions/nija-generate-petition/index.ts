// supabase/functions/nija-generate-petition/index.ts
// Edge function para geração de peças jurídicas com IA baseada nos vícios e estratégias do NIJA

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { NIJA_CORE_PROMPT } from "../_shared/nija-core-prompt.ts";
import { requireOfficeMembership } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NijaFinding {
  defect: {
    code: string;
    label: string;
    description?: string;
  };
  severity: string;
  trecho?: string;
  tecnico?: {
    fundamentosLegais: string[];
  };
}

interface PetitionRequest {
  ramo: string;
  resumoTatico?: string;
  vicios?: NijaFinding[];
  estrategiasPrincipais?: any[];
  clientName?: string;
  opponentName?: string;
  cnjNumber?: string;
  courtName?: string;
  city?: string;
  lawyerName?: string;
  oabNumber?: string;
  actingSide?: "REU" | "AUTOR";
}

const SYSTEM_PROMPT = `${NIJA_CORE_PROMPT}
\nVocê é um assistente jurídico de alto nível. Redija peças processuais impecáveis.
REGRAS:
1. NUNCA invente dados.
2. Use linguagem formal.
3. Baseie-se APENAS nos vícios informados.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    // 1. Authenticate (Zero Trust)
    const auth = await requireOfficeMembership(req);
    if (!auth.ok) return auth.response;

    const body: PetitionRequest = await req.json();
    const {
      ramo, vicios, clientName, opponentName, cnjNumber, courtName, city, actingSide
    } = body;

    if (!vicios || vicios.length === 0) {
        return new Response(JSON.stringify({ error: "Vícios requeridos" }), { status: 400, headers: corsHeaders });
    }

    console.log(`[NIJA-PETITION] Generating for office: ${auth.membership.office_id}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
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
          { role: "user", content: `Gere petição para ${ramo}. Vícios: ${JSON.stringify(vicios)}` },
        ],
      }),
    });

    if (!aiResponse.ok) throw new Error("Erro na IA");
    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    return new Response(JSON.stringify({ 
      petition: content,
      avisoRevisao: "Peça gerada por IA. Revisão humana obrigatória."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in nija-generate-petition:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
