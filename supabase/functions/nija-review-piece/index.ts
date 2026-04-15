import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAgentConfig } from "../_shared/agent-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReviewRequest {
  draft_piece: {
    titulo: string;
    estrutura: Array<{ secao: string; conteudo: string }>;
  };
  dossier: any;
  office_id?: string;
  pipeline_stage?: string;
}

const REVIEW_SYSTEM_PROMPT = `
Você é o PRINCIPAL JURÍDICO REVIWER + AUDITOR DE LITIGÂNCIA SÊNIOR da Flaito (NIJA-REVIEW V2).
Sua missão é atuar como o advogado mais crítico e experiente do escritório, revisando a peça jurídica de um colega.

### REGRAS DE OURO:
- NÃO REESCREVA A PEÇA. Sua função é AUDITAR, DETECTAR ERROS e APONTA MELHORIAS.
- SEJA EXTREMAMENTE RIGOROSO. Não suavize problemas. Erros fáticos ou fundamentação fraca devem ser apontados sem hesitação.
- TRATE O DOSSIÊ COMO A VERDADE ABSOLUTA (GROUND TRUTH). Qualquer divergência da peça em relação ao dossiê é um ERRO CRÍTICO.

### FLUXO DE AUDITORIA (9 ETAPAS OBRIGATÓRIAS):

1. **VALIDAÇÃO ESTRUTURAL**: Verifique se a peça contém: Endereçamento, Qualificação das Partes, Fatos, Fundamentação, Pedidos, Valor da Causa e Fechamento.
2. **COERÊNCIA FÁTICA**: Compare os fatos narrados na peça com o Dossiê fornecido. Identifique distorções, datas erradas ou omissões graves.
3. **FUNDAMENTAÇÃO JURÍDICA**: Avalie se os fundamentos legais são adequados ao ramo detectado. Marque como CRÍTICO o uso de argumentos genéricos ou base legal inexistente.
4. **ANÁLISE DOS PEDIDOS**: Verifique se os pedidos estão coerentes com os fatos e se estão juridicamente corretos e completos.
5. **VERIFICAÇÃO DE PROVAS**: Mapeie se os pontos relevantes da narrativa possuem base probatória no dossiê. Identifique alegações sem prova.
6. **DETECÇÃO DE INCONSISTÊNCIAS**: Localize contradições internas ou conflitos entre fatos e pedidos.
7. **IDENTIFICAÇÃO DE LACUNAS**: Aponte a ausência de teses, argumentos ou provas críticas que deveriam estar presentes.
8. **AVALIAÇÃO DE QUALIDADE**: Atribua nota 0-10 baseada em clareza, força argumentativa e rigor técnico.
9. **RELATÓRIO FINAL**: Veredito final (Aprovado ou Reprovado) e nível de risco (Baixo, Médio ou Alto).

### FORMATO DE SAÍDA (JSON OBRIGATÓRIO):
{
  "etapa_1_estrutura": { "estrutura_valida": boolean, "problemas_estrutura": ["string"] },
  "etapa_2_fatos": { "coerencia_fatica": boolean, "problemas_fatos": ["string"] },
  "etapa_3_fundamentacao": { "fundamentacao_valida": boolean, "falhas_fundamentacao": ["string"] },
  "etapa_4_pedidos": { "pedidos_validos": boolean, "problemas_pedidos": ["string"] },
  "etapa_5_provas": { "provas_ok": ["string"], "provas_faltantes": ["string"], "provas_mal_utilizadas": ["string"] },
  "etapa_6_inconsistencias": { "inconsistencias": ["string"] },
  "etapa_7_lacunas": { "lacunas": ["string"] },
  "etapa_8_qualidade": { "qualidade_geral": 0-10, "nivel_profissional": "baixo | médio | alto" },
  "relatorio_final": { 
    "aprovado": boolean, 
    "nivel_risco": "baixo | médio | alto", 
    "problemas_criticos": ["string"], 
    "melhorias_recomendadas": ["string"], 
    "resumo_revisao": "Resumo técnico de 2-3 linhas para o advogado."
  }
}
`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { draft_piece, dossier, office_id: bodyOfficeId, pipeline_stage: bodyPipelineStage } = await req.json() as ReviewRequest;
    
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. RESOLVER CONFIGURAÇÃO (UNIFIED AGENT CONFIG)
    const resolved = await getAgentConfig(supabase, "nija-review-piece", {
      office_id: bodyOfficeId || dossier?.office_id,
      pipeline_stage: bodyPipelineStage || "REVISAO"
    });

    if (!resolved || resolved.resolution.is_blocked) {
      throw new Error(`Agente nija-review-piece está desativado ou não configurado.`);
    }

    console.log(`[NIJA-REVIEW] Config resolved via ${resolved.resolution.source_level}`);

    const userPrompt = `
ANALISE A SEGUINTE PEÇA JURÍDICA:
TÍTULO: ${draft_piece.titulo}
CONTEÚDO:
${draft_piece.estrutura.map(s => `[${s.secao.toUpperCase()}]\n${s.conteudo}`).join("\n\n")}

CONTEXTO DO DOSSIÊ (CASO):
RAMO: ${dossier.ramo}
POLO: ${dossier.polo}
RESUMO TÁTICO: ${dossier.resumo_tatico}
VÍCIOS DETECTADOS NO CASO: ${JSON.stringify(dossier.vicios)}

Avalie a peça com base no dossiê fornecido.
`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolved.model.includes("gpt") ? resolved.model : "gpt-4o",
        temperature: resolved.temperature, // Baixa temperatura para precisão em revisão
        max_tokens: resolved.max_tokens,
        messages: [
          { role: "system", content: `${resolved.system_prompt}\n${resolved.extra_instructions || ""}` },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`Erro na IA Gateway: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    return new Response(
      JSON.stringify({
        ...result,
        _audit: {
          config_id: resolved.resolution.config_id,
          version: resolved.resolution.version,
          source: resolved.resolution.source_level,
          fallback: resolved.resolution.fallback_used
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[REVIEW-PIECE] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
