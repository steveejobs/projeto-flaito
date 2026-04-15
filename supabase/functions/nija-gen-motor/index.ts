// supabase/functions/nija-gen-motor/index.ts
// MOTOR DE GERAÇÃO JURÍDICA (NIJA-GEN-MOTOR) V2.0
// Execução Sequencial Etapa por Etapa (1 a 9)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { NIJA_CORE_PROMPT } from "../_shared/nija-core-prompt.ts";
import { resolveVariables, RootContext } from "../_shared/variableResolver.ts";
import { extractJson } from "../_shared/jsonUtils.ts";
import { getAgentConfig } from "../_shared/agent-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- INTERFACES ---

interface GenMotorRequest {
  dossier_id: string;
  strategy_data: any;
  office_id?: string;
  pipeline_stage?: string;
  options?: {
    model?: string;
    temperature?: number;
  };
}

interface GenMotorResponse {
  tipo_peca: string;
  peca_final: string;
  resumo_da_peca: string;
  nivel_confianca: number;
  observacoes: string;
  revisao: {
    coerente: boolean;
    problemas: string[];
    melhorias_sugeridas: string[];
  };
  _audit?: {
    config_id: string;
    version: number;
    source_level: string;
    fallback_used: boolean;
  };
}

// --- SERVIÇO ---

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const logs: string[] = [];

  try {
    const { dossier_id, strategy_data, options, office_id: bodyOfficeId, pipeline_stage } = await req.json() as GenMotorRequest;
    
    // Configurações ambiente
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const log = (msg: string) => {
      const time = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[NIJA-GEN-MOTOR][${time}s] ${msg}`);
      logs.push(`${time}s: ${msg}`);
    };

    log("Iniciando Motor de Geração...");

    // ETAPA 1: PREPARAÇÃO DO CONTEXTO
    log("Etapa 1: Pessoalizando Contexto...");
    const { data: dossier, error: dossierErr } = await supabase
      .from("process_dossiers")
      .select("*, cases(*)")
      .eq("id", dossier_id)
      .single();
    
    if (dossierErr) throw new Error(`Dossiê não encontrado: ${dossierErr.message}`);

    // ETAPA 1.5: RESOLVER CONFIGURAÇÃO (UNIFIED AGENT CONFIG)
    const resolved = await getAgentConfig(supabase, "nija-gen-motor", {
      office_id: bodyOfficeId || dossier?.cases?.office_id,
      pipeline_stage: pipeline_stage || "GENERATION"
    });

    if (!resolved || resolved.resolution.is_blocked) {
      throw new Error(`Agente nija-gen-motor está desativado ou não configurado para este contexto.`);
    }

    log(`Configuração resolvida via ${resolved.resolution.source_level} (Model: ${resolved.model})`);

    const context = {
      fatos_relevantes: strategy_data.etapa_9?.dados_para_geracao?.fatos_relevantes || [],
      provas: strategy_data.etapa_9?.dados_para_geracao?.provas || { fortes: [], gaps: [] },
      teses: strategy_data.etapa_9?.dados_para_geracao?.teses || [],
      pedidos: strategy_data.etapa_9?.dados_para_geracao?.pedidos || [],
      tipo_peca: strategy_data.etapa_9?.dados_para_geracao?.tipo_peca || "PETICAO_GENERICA"
    };

    // ETAPA 2: SELEÇÃO DA ESTRUTURA
    log("Etapa 2: Definindo Estrutura...");
    const estrutura = [
      "Endereçamento",
      "Qualificação das Partes",
      "Síntese dos Fatos",
      "Preliminares e Prejudiciais (se houver)",
      "Do Mérito e Fundamentação Jurídica",
      "Dos Pedidos e Requerimentos",
      "Provas",
      "Valor da Causa e Fechamento"
    ];

    // ETAPA 3: INJEÇÃO DE VARIÁVEIS
    log("Etapa 3: Resolvendo Variáveis...");
    const root_context: RootContext = {
      client_id: dossier.cases?.client_id,
      office_id: dossier.cases?.office_id,
      case_id: dossier.case_id,
    };
    
    if (!root_context.client_id) {
        log("AVISO: client_id ausente. Variáveis do cliente podem não ser resolvidas.");
    }

    // --- FUNÇÃO AUXILIAR LLM (VIA GATEWAY LOVABLE - MULTI-LLM) ---
    const callLLM = async (system: string, user: string) => {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options?.model || resolved.model,
          temperature: options?.temperature ?? resolved.temperature,
          max_tokens: resolved.max_tokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`AI Gateway Error: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      return data.choices[0].message.content;
    };

    // ETAPA 3.5: RAG - CONHECIMENTO DO ESCRITÓRIO (PERSONALIZAÇÃO)
    log("Etapa 3.5: Pesquisando base de conhecimento do escritório...");
    let officeContext = "";
    try {
        const queryText = `${context.tipo_peca} ${context.teses.join(" ")}`;
        // Gerar embedding da query
        const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "text-embedding-3-small",
                input: queryText
            }),
        });
        
        if (embRes.ok) {
            const { data: embData } = await embRes.json();
            const embedding = embData[0].embedding;

            const { data: matches } = await supabase.rpc("match_legal_chunks", {
                query_embedding: embedding,
                match_threshold: 0.5,
                match_count: 5,
                p_office_id: root_context.office_id
            });

            if (matches && matches.length > 0) {
                log(`Encontrados ${matches.length} trechos de conhecimento personalizado.`);
                officeContext = "REFERÊNCIAS DO ESCRITÓRIO (USE COMO BASE):\n" + 
                    matches.map((m: any) => `[${m.metadata?.title || 'Trecho'}]: ${m.content}`).join("\n\n");
            }
        }
    } catch (e: any) {
        log(`Aviso: Erro na busca RAG personalizada: ${e.message}`);
    }

    const nijaSystemBase = `${resolved.system_prompt}\n${resolved.extra_instructions || ""}\n\n${officeContext}`;

    // ETAPA 4: NARRATIVA FÁTICA
    log("Etapa 4: Gerando Narrativa Fática...");
    const fatosDraft = await callLLM(
      `${nijaSystemBase}\nFoco: Redação da SEÇÃO DE FATOS. Construa uma narrativa cronológica e persuasiva baseada no dossiê.`,
      `Dossiê: ${JSON.stringify(dossier.consolidado_data)}\nFatos Estratégicos: ${JSON.stringify(context.fatos_relevantes)}`
    );

    // ETAPA 5: FUNDAMENTAÇÃO JURÍDICA
    log("Etapa 5: Gerando Fundamentação Jurídica...");
    const fundamentosDraft = await callLLM(
      `${nijaSystemBase}\nFoco: Redação do MÉRITO e FUNDAMENTOS. Conecte as teses jurídicas com os fatos e as provas identificadas.`,
      `Teses: ${JSON.stringify(context.teses)}\nProvas: ${JSON.stringify(context.provas)}\nFatos Gerados: ${fatosDraft}`
    );

    // ETAPA 6: CONSTRUÇÃO DOS PEDIDOS
    log("Etapa 6: Estruturando Pedidos...");
    const pedidosDraft = await callLLM(
      `${nijaSystemBase}\nFoco: Redação da SEÇÃO DE PEDIDOS. Garanta que todos os pedidos estejam alinhados com o mérito e sejam juridicamente precisos.`,
      `Pedidos Sugeridos: ${JSON.stringify(context.pedidos)}\nFundamentos: ${fundamentosDraft}`
    );

    // ETAPA 7: CONSOLIDAÇÃO DA PEÇA
    log("Etapa 7: Consolidando Seções...");
    const pecaConsolidada = `
# ${context.tipo_peca.toUpperCase()}

**EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DA ...**

**CLIENTE:** {{client.name_full}}
**PROCESSO Nº:** {{case.cnj_number}}

## I. SÍNTESE DOS FATOS
${fatosDraft}

## II. DOS FUNDAMENTOS JURÍDICOS
${fundamentosDraft}

## III. DOS PEDIDOS
${pedidosDraft}

**Termos em que, pede deferimento.**
**{{lawyer.name}} - OAB/{{lawyer.oab}}**
    `;

    // ETAPA 8: REVISÃO INTERNA
    log("Etapa 8: Executando Auditoria de Qualidade...");
    const revisaoOutput = await callLLM(
       `Você é o Senior Legal Auditor. Analise a peça gerada e compare com o dossiê. Procure por: 1. Contradições fáticas. 2. Falta de fundamento para algum pedido. 3. Lacunas graves. Retorne um JSON: { "coerente": boolean, "problemas": [], "melhorias_sugeridas": [] }`,
       `Dossiê: ${JSON.stringify(dossier.consolidado_data)}\nPeça: ${pecaConsolidada}`
    );
    const revisao = extractJson(revisaoOutput);

    // ETAPA 9: OUTPUT FINAL
    log("Etapa 9: Gerando Output Final.");
    
    // Final Variable Resolution (Injetando dados reais se disponíveis agora ou deixando {{tags}} para a UI)
    const finalDraft = await resolveVariables(supabase, pecaConsolidada, root_context, {});

    const response: GenMotorResponse = {
      tipo_peca: context.tipo_peca,
      peca_final: finalDraft,
      resumo_da_peca: strategy_data.etapa_8?.estrategia_final?.abordagem || "Peça gerada com base no dossiê.",
      nivel_confianca: revisao.coerente ? 0.95 : 0.7,
      observacoes: "Peça de alta fidelidade gerada via NIJA-GEN-MOTOR.",
      revisao,
      _audit: {
        config_id: resolved.resolution.config_id,
        version: resolved.resolution.version,
        source_level: resolved.resolution.source_level,
        fallback_used: resolved.resolution.fallback_used
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[NIJA-GEN-MOTOR] Fatal Error:", errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg, logs }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
