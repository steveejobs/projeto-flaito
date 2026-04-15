// supabase/functions/nija-judge-simulation/index.ts
// JUIZ IA (NIJA-JUDGE) V2.0 - SISTEMA DE PROBABILIDADE ESTRUTURADO
// Simulação de decisão judicial com base em peça, dossiê e tendência jurisprudencial.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { NIJA_CORE_PROMPT } from "../_shared/nija-core-prompt.ts";
import { 
  calculateLegalProbability, 
  classifyProbability, 
  type ProbabilityFactors 
} from "../_shared/nija-probability-engine.ts";
import { getAgentConfig } from "../_shared/agent-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JudgeSimulationRequest {
  case_id: string;
  dossier_id?: string;
  office_id?: string;
  pipeline_stage?: string;
  draft_piece: {
    titulo: string;
    estrutura: Array<{ secao: string; conteudo: string }>;
  };
  review_report?: {
    score_qualidade: number;
    aprovado: boolean;
    issues: any[];
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { case_id, dossier_id, draft_piece, review_report, office_id: bodyOfficeId, pipeline_stage: bodyPipelineStage } = await req.json() as JudgeSimulationRequest;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // RESOLVER CONFIGURAÇÃO (UNIFIED AGENT CONFIG)
    const resolved = await getAgentConfig(supabase, "nija-judge-simulation", {
      office_id: bodyOfficeId,
      pipeline_stage: bodyPipelineStage || "JUIZ_IA"
    });

    if (!resolved || resolved.resolution.is_blocked) {
      throw new Error(`Agente nija-judge-simulation está desativado ou não configurado.`);
    }

    console.log(`[NIJA-JUDGE] Simulating judgment with config via ${resolved.resolution.source_level}`);

    // 1. Obter Dossiê
    const { data: dossier, error: dossierError } = await supabase
      .from("process_dossiers")
      .select("*")
      .eq("id", dossier_id || "invalid")
      .maybeSingle();

    if (dossierError || !dossier) {
        const { data: latestDossier } = await supabase
            .from("process_dossiers")
            .select("*")
            .eq("case_id", case_id)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!latestDossier) console.warn("[NIJA-JUDGE] No dossier found. Simulating without context.");
    }

    const systemPrompt = `${resolved.system_prompt}\n${resolved.extra_instructions || ""}`;

    const userPrompt = `
DADOS PARA ANÁLISE:
1. PEÇA: ${draft_piece.titulo}
2. ESTRUTURA DA PEÇA: ${JSON.stringify(draft_piece.estrutura)}
3. DOSSIÊ DO CASO: ${JSON.stringify(dossier, null, 2)}
4. AUDITORIA NIJA-REVIEW: ${JSON.stringify(review_report, null, 2)}

Ação: Realize a auditoria judicial e retorne os scores técnicos para o cálculo de probabilidade.
`;

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
        throw new Error(`Erro no AI Gateway: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // CÁLCULO ESTRUTURADO DA PROBABILIDADE
    const factors: ProbabilityFactors = result.scores_fatores;
    const finalScore = calculateLegalProbability(factors);
    const classification = classifyProbability(finalScore);

    const finalSimulation = {
      case_id,
      office_id: dossier?.office_id,
      dossier_id: dossier?.id,
      probabilidade_exito: finalScore,
      faixa: classification,
      tipo_decisao_provavel: result.decisao.tipo,
      pontos_fortes: result.swot.forcas,
      pontos_fracos: result.swot.fraquezas,
      lacunas_probatorias: result.riscos_detalhados.filter((r: any) => r.gravidade === 'ALTA').map((r: any) => r.titulo),
      sugestoes_melhoria: result.swot.oportunidades,
      fundamentos_provaveis: [result.decisao.fundamentacao_chave],
      score_qualidade_peca: factors.fundamentacao * 10,
      score_componentes: factors,
      observacao_juiz: result.observacao_final,
      alerta_risco: result.riscos_detalhados[0]?.titulo || "Análise de risco concluída sem perigos iminentes",
      riscos_processuais: result.riscos_detalhados,
      versao_motor: 'PROBABILITY_V1',
      config_resolver_id: resolved.resolution.config_id,
      config_resolver_version: resolved.resolution.version,
      config_resolver_source: resolved.resolution.source_level,
      config_fallback_used: resolved.resolution.fallback_used,
      _audit: {
        config_id: resolved.resolution.config_id,
        version: resolved.resolution.version,
        source_level: resolved.resolution.source_level,
        fallback_used: resolved.resolution.fallback_used
      }
    };

    // 2. Persistir no Banco
    const { data: savedData, error: dbError } = await supabase
      .from("judge_simulations")
      .insert(finalSimulation)
      .select()
      .single();

    if (dbError) {
        console.error("[NIJA-JUDGE] DB Persistence Error:", dbError.message);
    }

    return new Response(
      JSON.stringify(savedData || finalSimulation),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[NIJA-JUDGE] Fatal Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
