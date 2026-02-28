import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface NijaFullAnalysisMeta {
  ramo: string;
  ramoConfiavel: boolean;
  faseProcessual: string;
  poloAtuacao: "AUTOR" | "REU" | "TERCEIRO" | "INDEFINIDO";
  grauRiscoGlobal: string;
  resumoTatico: string;
}

interface NijaFullAnalysisPrescricao {
  haPrescricao: boolean;
  tipo: string;
  fundamentacao: string;
  risco: string;
}

interface NijaFullAnalysisVicio {
  codigo: string;
  label: string;
  natureza: string;
  gravidade: "BAIXA" | "MEDIA" | "ALTA";
  atoRelacionado?: string;
  trecho?: string;
  fundamentosLegais?: string[];
  observacoes?: string;
}

interface NijaFullAnalysisSugestaoPeca {
  tipo: string;
  tituloSugestao: string;
  focoPrincipal: string;
}

interface NijaFullAnalysisResult {
  meta: NijaFullAnalysisMeta;
  partes: any;
  processo: any;
  linhaDoTempo: any[];
  prescricao: NijaFullAnalysisPrescricao;
  vicios: NijaFullAnalysisVicio[];
  estrategias: any;
  sugestaoPeca: NijaFullAnalysisSugestaoPeca | null;
}

interface AutoPetitionRequest {
  caseId: string;
  observacoes?: string | null;
}

serve(async (req: Request): Promise<Response> => {
  // Preflight CORS - Safari fix: always return Content-Type: application/json
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    const payload = (await req.json()) as AutoPetitionRequest;

    if (!payload?.caseId) {
      return new Response(
        JSON.stringify({
          error: "Campo 'caseId' é obrigatório.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[NIJA_AUTO] Variáveis SUPABASE_URL / SERVICE_ROLE ausentes.");
      return new Response(
        JSON.stringify({ error: "Configuração do Supabase ausente no ambiente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1) Buscar dados básicos do caso + cliente
    const { data: caseRow, error: caseError } = await supabase
      .from("cases")
      .select(
        `
          id,
          office_id,
          title,
          cnj_number,
          area,
          stage,
          nija_full_analysis,
          nija_full_last_run_at,
          side,
          client:client_id (
            id,
            full_name
          )
        `,
      )
      .eq("id", payload.caseId)
      .single();

    if (caseError || !caseRow) {
      console.error("[NIJA_AUTO] Erro ao buscar caso:", caseError);
      return new Response(
        JSON.stringify({ error: "Caso não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Buscar textos extraídos dos documentos do caso
    const { data: documents, error: docsError } = await supabase
      .from("documents")
      .select("extracted_text, deleted_at, case_id")
      .eq("case_id", payload.caseId)
      .is("deleted_at", null)
      .not("extracted_text", "is", null);

    if (docsError) {
      console.error("[NIJA_AUTO] Erro ao buscar documentos:", docsError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar documentos do caso." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawText = ((documents as { extracted_text: string | null }[] | null) ?? [])
      .map((d) => d.extracted_text || "")
      .filter((t) => t.trim().length > 0)
      .join("\n\n---\n\n");

    if (!rawText || !rawText.trim()) {
      return new Response(
        JSON.stringify({
          error:
            "Nenhum texto extraído encontrado para o caso. Faça upload de documentos com OCR antes de rodar o NIJA.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // NIJA Fase 1: Guardrail - verificar tamanho mínimo do texto
    const MIN_CHARS_REQUIRED = 1500;
    if (rawText.trim().length < MIN_CHARS_REQUIRED) {
      console.error(`[NIJA_AUTO] Texto muito curto: ${rawText.length} chars`);
      return new Response(
        JSON.stringify({
          error: "LEITURA_INSUFICIENTE",
          message: `Texto muito curto (${rawText.length} caracteres). Mínimo necessário: ${MIN_CHARS_REQUIRED} caracteres. Verifique se os documentos foram extraídos corretamente.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Rodar / reutilizar NIJA_FULL_ANALYSIS
    let analysis: NijaFullAnalysisResult | null =
      (caseRow.nija_full_analysis as NijaFullAnalysisResult | null) ?? null;

    if (!analysis) {
      console.log("[NIJA_AUTO] Rodando nija-full-analysis para o caso:", caseRow.id);

      const poloHint =
        caseRow.side === "ATAQUE"
          ? "AUTOR"
          : caseRow.side === "DEFESA"
          ? "REU"
          : "INDEFINIDO";

      const { data: fullData, error: fullError } = await supabase.functions.invoke(
        "nija-full-analysis",
        {
          body: {
            rawText,
            ramoHint: caseRow.area ?? null,
            faseHint: caseRow.stage ?? null,
            poloHint,
            caseMeta: {
              titulo: caseRow.title ?? null,
              numero: caseRow.cnj_number ?? null,
            },
            clientMeta: {
              nome: (caseRow.client as any)?.full_name ?? null,
              papel: poloHint,
            },
            opponentMeta: {},
            observacoes: payload.observacoes ?? null,
          },
        },
      );

      if (fullError) {
        console.error("[NIJA_AUTO] Erro ao chamar nija-full-analysis:", fullError);
        return new Response(
          JSON.stringify({ error: "Erro ao executar análise integrada NIJA." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      analysis = fullData as NijaFullAnalysisResult;

      const { error: updateError } = await supabase
        .from("cases")
        .update({
          nija_full_analysis: analysis,
          nija_full_last_run_at: new Date().toISOString(),
        })
        .eq("id", caseRow.id);

      if (updateError) {
        console.error("[NIJA_AUTO] Falha ao salvar análise no caso:", updateError);
      }
    } else {
      console.log("[NIJA_AUTO] Reutilizando análise NIJA já existente no caso.");
    }

    // 4) Gerar a petição com base na análise + texto bruto
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[NIJA_AUTO] LOVABLE_API_KEY não configurada.");
      return new Response(
        JSON.stringify({ error: "Serviço de IA não configurado (LOVABLE_API_KEY ausente)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `
Você é o NIJA_GERADOR_DE_PECA do LEXOS.

Use EXCLUSIVAMENTE:
- A ANÁLISE ESTRUTURADA (JSON) já pronta do NIJA_FULL_ANALYSIS
- O TEXTO BRUTO DO PROCESSO (rawText) como base factual

OBJETIVO:
- Redigir uma PEÇA PROCESSUAL COMPLETA, limpa, profissional e pronta para revisão humana,
  compatível com:
  • ramo do direito
  • fase processual
  • polo de atuação do cliente
  • vícios detectados
  • prescrição (se houver)
  • sugestão de peça indicada em sugestaoPeca

REGRAS ABSOLUTAS:
1. NUNCA invente número de processo, nomes de julgadores, acórdãos, súmulas ou artigos de lei.
2. Se precisar citar jurisprudência, use apenas marcadores do tipo:
   [INSERIR JURISPRUDÊNCIA SOBRE CERCEAMENTO DE DEFESA – CONFERIR EM FONTE OFICIAL]
3. Adapte a peça ao polo do cliente (Autor, Réu, Executado etc.).
4. Se a sugestaoPeca indicar um tipo de peça incompatível com a fase, ajuste para a peça mais adequada.
5. Redija em português jurídico brasileiro, com estrutura tradicional (endereçamento, qualificação sintética,
   síntese fática, preliminares, mérito, pedidos e fechamento).
6. Se algum dado não constar nem do JSON nem do texto, use marcador:
   [DADO A COMPLETAR PELO ADVOGADO].

ENTRADA:
- Um JSON "analysis" (resultado do NIJA_FULL_ANALYSIS)
- Uma descrição sucinta do caso construída a partir de analysis.meta.resumoTatico e da linha do tempo.
- rawText (somente para reforço contextual, sem precisar citar literalmente).

SAÍDA:
- APENAS o texto integral da peça, sem markdown, sem JSON.
`;

    const userPrompt = `
A seguir estão os dados para elaboração da peça:

==================== ANÁLISE NIJA (JSON) ====================
${JSON.stringify(analysis, null, 2)}

==================== RESUMO TÁTICO ====================
${analysis.meta?.resumoTatico ?? ""}

==================== TEXTO BRUTO DO PROCESSO (RAW TEXT) ====================
${rawText.slice(0, 15000)}
(OBS: texto possivelmente truncado apenas para manter limite de tokens.)
`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[NIJA_AUTO] Erro ao chamar AI gateway:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar a petição com o NIJA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResponse.json();
    const petitionText: string =
      aiData?.choices?.[0]?.message?.content?.trim() ?? "";

    if (!petitionText) {
      console.error("[NIJA_AUTO] Resposta vazia ao gerar petição.");
      return new Response(
        JSON.stringify({ error: "Serviço de IA retornou texto vazio para a petição." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        caseId: caseRow.id,
        analysis,
        petitionText,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[NIJA_AUTO] Erro geral:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido na NIJA_AUTO_PETITION.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
