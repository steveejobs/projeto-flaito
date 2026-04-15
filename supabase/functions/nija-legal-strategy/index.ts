// supabase/functions/nija-legal-strategy/index.ts
// MOTOR DE ESTRATÉGIA JURÍDICA (NIJA-STRATEGY) V1.0
// Sequential Execution: Stage 1 to 9

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { NIJA_CORE_PROMPT } from "../_shared/nija-core-prompt.ts";
import { getAgentConfig } from "../_shared/agent-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- INTERFACES ---

interface LegalStrategyRequest {
  case_id?: string;
  dossier_id?: string;
  dossier_json?: any; 
  office_id?: string;
  pipeline_stage?: string;
}

// Interfaces de Saída por Etapa
interface Stage1Response {
  area_direito: string;
  tipo_acao: string;
  polo_cliente: string;
  fase_processual: string;
  complexidade: "BAIXA" | "MEDIA" | "ALTA";
}

interface Stage2Response {
  objetivo_principal: string;
  objetivos_secundarios: string[];
  nivel_urgencia: "BAIXO" | "MEDIO" | "ALTO";
}

interface Stage3Response {
  tipo_peca: string;
  justificativa: string;
}

interface Tese {
  tese: string;
  fundamento_legal: string;
  relevancia: number; // 0-10
  risco: string;
}

interface Stage4Response {
  teses_selecionadas: Tese[];
}

interface Stage5Response {
  provas_fortes: string[];
  provas_parciais: string[];
  provas_ausentes: string[];
  provas_contraditorias: string[];
}

interface Risco {
  descricao: string;
  impacto: string;
  probabilidade: string;
}

interface Stage6Response {
  riscos: Risco[];
}

interface Oportunidade {
  acao_sugerida: string;
  impacto_esperado: string;
}

interface Stage7Response {
  oportunidades: Oportunidade[];
}

interface Stage8Response {
  estrategia_final: {
    tipo_peca: string;
    abordagem: string;
    principais_teses: string[];
    pontos_de_ataque: string[];
    pontos_de_defesa: string[];
    riscos: string[];
    oportunidades: string[];
  };
}

interface Stage9Response {
  dados_para_geracao: {
    tipo_peca: string;
    teses: Tese[];
    fatos_relevantes: string[];
    provas: {
      fortes: string[];
      gaps: string[];
    };
    pedidos: string[];
    observacoes_estrategicas: string;
  };
}

interface FullStrategyResponse {
  etapa_1?: Stage1Response;
  etapa_2?: Stage2Response;
  etapa_3?: Stage3Response;
  etapa_4?: Stage4Response;
  etapa_5?: Stage5Response;
  etapa_6?: Stage6Response;
  etapa_7?: Stage7Response;
  etapa_8?: Stage8Response;
  etapa_9?: Stage9Response;
  error?: string;
}

// --- SERVIÇO ---

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { case_id, dossier_id, dossier_json, office_id: bodyOfficeId, pipeline_stage: bodyPipelineStage } = await req.json() as LegalStrategyRequest;
    
    // Configurações ambiente
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`[NIJA-STRATEGY] Processing strategy for dossier_id: ${dossier_id || 'JSON_INPUT'}`);

    // 1. Obter Dossiê
    let dossier = dossier_json;
    if (!dossier && dossier_id) {
       const { data, error } = await supabase
         .from("process_dossiers")
         .select("*")
         .eq("id", dossier_id)
         .single();
       if (error) throw new Error(`Dossiê não encontrado: ${error.message}`);
       dossier = data;
    } else if (!dossier && case_id) {
       const { data, error } = await supabase
         .from("process_dossiers")
         .select("*")
         .eq("case_id", case_id)
         .order("version", { ascending: false })
         .limit(1)
         .single();
       if (error) throw new Error(`Nenhum dossiê vinculado ao caso ${case_id}`);
       dossier = data;
    }

    if (!dossier) throw new Error("Entrada inválida: forneça case_id, dossier_id ou dossier_json");

    // 1.5. RESOLVER CONFIGURAÇÃO (UNIFIED AGENT CONFIG)
    const resolved = await getAgentConfig(supabase, "nija-legal-strategy", {
      office_id: bodyOfficeId || dossier?.office_id,
      pipeline_stage: bodyPipelineStage || "ESTRATEGIA"
    });

    if (!resolved || resolved.resolution.is_blocked) {
      throw new Error(`Agente nija-legal-strategy está desativado ou não configurado.`);
    }

    console.log(`[NIJA-STRATEGY] Config resolved via ${resolved.resolution.source_level}`);

    // --- PIPELINE SEQUENCIAL ---
    const systemPrompt = `
${NIJA_CORE_PROMPT}

${resolved.system_prompt}
${resolved.extra_instructions || ""}

Sua missão é transformar o dossiê de um processo em uma ESTRATÉGIA JURÍDICA vencedora.

REGRAS DE OURO:
- Siga as 9 etapas EXATAMENTE na ordem.
- Cada etapa deve influenciar a seguinte (Cadeia de Pensamento).
- O polo do cliente (Autor/Réu) é o seu norte: defenda-o com agressividade técnica.
- Se houver Gaps de prova no dossiê, transforme-os em RISCOS na Etapa 6 e em OPORTUNIDADES de saneamento na Etapa 7.

--- FORMATO DE SAÍDA (RESPOSTA JSON OBRIGATÓRIA) ---
{
  "etapa_1": {
    "area_direito": "string",
    "tipo_acao": "string",
    "polo_cliente": "string",
    "fase_processual": "string",
    "complexidade": "BAIXA | MEDIA | ALTA"
  },
  "etapa_2": {
    "objetivo_principal": "string",
    "objetivos_secundarios": ["string"],
    "nivel_urgencia": "BAIXO | MEDIO | ALTO"
  },
  "etapa_3": {
    "tipo_peca": "string",
    "justificativa": "string"
  },
  "etapa_4": {
    "teses_selecionadas": [
      { "tese": "string", "fundamento_legal": "string", "relevancia": 0-10, "risco": "string" }
    ]
  },
  "etapa_5": {
    "provas_fortes": ["string"],
    "provas_parciais": ["string"],
    "provas_ausentes": ["string"],
    "provas_contraditorias": ["string"]
  },
  "etapa_6": {
    "riscos": [
      { "descricao": "string", "impacto": "string", "probabilidade": "string" }
    ]
  },
  "etapa_7": {
    "oportunidades": [
      { "acao_sugerida": "string", "impacto_esperado": "string" }
    ]
  },
  "etapa_8": {
    "estrategia_final": {
      "tipo_peca": "string",
      "abordagem": "string",
      "principais_teses": ["string"],
      "pontos_de_ataque": ["string"],
      "pontos_de_defesa": ["string"],
      "riscos": ["string"],
      "oportunidades": ["string"]
    }
  },
  "etapa_9": {
    "dados_para_geracao": {
      "tipo_peca": "string",
      "teses": [{ "tese": "string", "fundamento_legal": "string", "relevancia": "number" }],
      "fatos_relevantes": ["string"],
      "provas": { "fortes": ["string"], "gaps": ["string"] },
      "pedidos": ["string"],
      "observacoes_estrategicas": "string"
    }
  }
}
`;

    const userPrompt = `
Abaixo está o dossiê consolidado do processo:
------------------------------------------
${JSON.stringify(dossier, null, 2)}
------------------------------------------

PROCESSE AS 9 ETAPAS E RETORNE O JSON FINAL.
`;

    console.log("[NIJA-STRATEGY] Calling LLM (Gemini 1.5 Pro)");

    // Chamada para OpenAI Direta
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolved.model.includes("gpt") ? resolved.model : "gpt-4o", 
        temperature: resolved.temperature,
        max_tokens: resolved.max_tokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`Erro no AI Gateway: ${aiResponse.status} ${await aiResponse.text()}`);
    }

    const aiData = await aiResponse.json();
    const strategyResult = JSON.parse(aiData.choices[0].message.content);

    // Salvar estratégia no banco (Opcional, mas recomendado para histórico)
    if (dossier.id) {
       await supabase
         .from("process_dossiers")
         .update({ estrategista_data: strategyResult })
         .eq("id", dossier.id);
    }

    return new Response(
      JSON.stringify({
        ...strategyResult,
        _audit: {
          config_id: resolved.resolution.config_id,
          version: resolved.resolution.version,
          source_level: resolved.resolution.source_level,
          fallback_used: resolved.resolution.fallback_used
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[NIJA-STRATEGY] Fatal Error:", errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
