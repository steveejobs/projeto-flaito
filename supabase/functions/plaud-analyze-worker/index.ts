import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 5;
const MODEL = "gpt-4o-mini";

// NIJA prompt for transcript analysis
const NIJA_TRANSCRIPT_PROMPT = `Você é NIJA, assistente jurídico do LEXOS especializado em análise de transcrições.

Analise a transcrição abaixo e extraia informações estruturadas. Retorne um JSON válido com a seguinte estrutura:

{
  "resumoExecutivo": "string (3-5 frases resumindo o conteúdo principal)",
  "pontosChave": ["array de strings com os pontos mais importantes identificados"],
  "acoes": ["array de action items/tarefas identificadas"],
  "partesEnvolvidas": ["nomes de pessoas, empresas ou partes mencionadas"],
  "datasEPrazos": [{"data": "string", "contexto": "string"}],
  "relevanciaJuridica": {
    "temRelevancia": boolean,
    "elementos": ["menções a processos, prazos legais, documentos jurídicos, etc."],
    "nivelUrgencia": "baixo | medio | alto"
  },
  "sentimento": "positivo | neutro | negativo | misto",
  "topicos": ["categorias/tópicos principais abordados"],
  "citacoesImportantes": ["trechos literais importantes da transcrição, max 3"]
}

Seja objetivo e foque no que é relevante para um escritório de advocacia.
Se algum campo não puder ser determinado, use null ou array vazio conforme apropriado.`;

// OMNI-SÊNIOR: Prompt para decisão estratégica jurídica
const OMNI_SENIOR_PROMPT = `Você é OMNI-SÊNIOR, um consultor jurídico sênior especializado em triagem estratégica de informações para escritórios de advocacia.

Sua função é analisar a síntese de uma transcrição e determinar a DECISÃO ESTRATÉGICA recomendada:

## REGRAS OBRIGATÓRIAS:
1. Você NÃO executa ações. Apenas SUGERE a decisão para o advogado humano tomar.
2. Quando houver BAIXA CONFIANÇA sobre a natureza jurídica do conteúdo, PREFIRA "SILENCIAR".
3. NÃO INVENTE leis, súmulas ou jurisprudência. Se não tiver ALTA CONFIANÇA, deixe fundamento_legal como null.
4. CONSISTÊNCIA OBRIGATÓRIA:
   - Se decisao_estrategica = "AGIR": peca_sugerida DEVE ter valor (não pode ser null/vazio) e justificativa_silencio DEVE ser null
   - Se decisao_estrategica = "SILENCIAR": justificativa_silencio DEVE ter valor e peca_sugerida DEVE ser null
   - Se decisao_estrategica = "REGISTRAR": ambos podem ser null
5. checklist SEMPRE deve ser um array (pode ser vazio [])

## DECISÕES POSSÍVEIS:
- "AGIR": Há um ato processual, prazo ou decisão que exige resposta/providência do advogado
- "REGISTRAR": Informação relevante para acompanhamento, mas sem urgência de ação imediata
- "SILENCIAR": Conteúdo sem relevância jurídica imediata ou incerto demais para classificar

## NÍVEIS DE RISCO DE PRECLUSÃO:
- "NENHUM": Sem prazo ou consequência processual
- "BAIXO": Prazo distante ou consequência menor
- "MEDIO": Prazo moderado ou consequência relevante
- "ALTO": Prazo curto ou consequência grave
- "CRITICO": Prazo iminente ou risco de perda de direito

## RETORNE JSON ESTRITO no formato:
{
  "decisao_estrategica": "AGIR" | "REGISTRAR" | "SILENCIAR",
  "status_juridico": "ANALISADO",
  "risco_preclusao": "NENHUM" | "BAIXO" | "MEDIO" | "ALTO" | "CRITICO",
  "tipo_ato": "string descrevendo o tipo de ato/evento identificado ou null",
  "fase_processual": "conhecimento" | "recursal" | "execucao" | "cumprimento" | null,
  "fato_central": "string com o fato principal identificado",
  "consequencia_juridica": "string descrevendo a consequência se não houver ação ou null",
  "peca_sugerida": "string com a peça processual sugerida (obrigatório se AGIR) ou null",
  "justificativa_silencio": "string justificando o silêncio (obrigatório se SILENCIAR) ou null",
  "fundamento_legal": "string com base legal aplicável (só se tiver alta confiança) ou null",
  "checklist": ["array de itens de verificação/próximos passos sugeridos"]
}`;

serve(async (req) => {
  console.log("[plaud-analyze-worker] Request received:", req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST (triggered manually or by cron)
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      console.error("[plaud-analyze-worker] OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ ok: false, error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1) Fetch queued jobs
    const { data: jobs, error: fetchError } = await supabase
      .from("plaud_analysis_jobs")
      .select("id, plaud_asset_id, office_id, case_id")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("[plaud-analyze-worker] Error fetching jobs:", fetchError);
      return new Response(
        JSON.stringify({ ok: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!jobs || jobs.length === 0) {
      console.log("[plaud-analyze-worker] No queued jobs found");
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: "No jobs to process" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[plaud-analyze-worker] Found", jobs.length, "jobs to process");

    const results: { jobId: string; success: boolean; error?: string }[] = [];

    for (const job of jobs) {
      console.log("[plaud-analyze-worker] Processing job:", job.id);

      try {
        // Mark as running
        await supabase
          .from("plaud_analysis_jobs")
          .update({ 
            status: "running", 
            started_at: new Date().toISOString() 
          })
          .eq("id", job.id);

        // Fetch the plaud_asset
        const { data: asset, error: assetError } = await supabase
          .from("plaud_assets")
          .select("id, title, transcript, summary, office_id")
          .eq("id", job.plaud_asset_id)
          .single();

        if (assetError || !asset) {
          throw new Error(`Asset not found: ${assetError?.message || "unknown"}`);
        }

        if (!asset.transcript || asset.transcript.trim().length < 50) {
          throw new Error("Transcript too short for analysis");
        }

        // Build the prompt content
        const transcriptContent = asset.transcript.slice(0, 15000); // Limit to ~15k chars
        const summaryContent = asset.summary ? `\n\nRESUMO PRÉVIO:\n${asset.summary}` : "";

        const userMessage = `TÍTULO: ${asset.title}\n\nTRANSCRIÇÃO:\n${transcriptContent}${summaryContent}`;

        // Call OpenAI
        console.log("[plaud-analyze-worker] Calling OpenAI for job:", job.id);
        
        const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: "system", content: NIJA_TRANSCRIPT_PROMPT },
              { role: "user", content: userMessage }
            ],
            temperature: 0.3,
            max_tokens: 2000,
            response_format: { type: "json_object" }
          }),
        });

        if (!openAiResponse.ok) {
          const errorText = await openAiResponse.text();
          throw new Error(`OpenAI API error: ${openAiResponse.status} - ${errorText}`);
        }

        const openAiData = await openAiResponse.json();
        const content = openAiData.choices?.[0]?.message?.content;
        const tokensUsed = openAiData.usage?.total_tokens || 0;

        if (!content) {
          throw new Error("No content in OpenAI response");
        }

        // Parse the JSON response
        let analysis;
        try {
          analysis = JSON.parse(content);
        } catch {
          console.warn("[plaud-analyze-worker] Failed to parse JSON, storing raw content");
          analysis = { raw: content, parseError: true };
        }

        console.log("[plaud-analyze-worker] Analysis complete for job:", job.id, "Tokens:", tokensUsed);

        // Save analysis result
        const { error: insertError } = await supabase
          .from("plaud_asset_analysis")
          .upsert({
            plaud_asset_id: job.plaud_asset_id,
            analysis: analysis,
            model_used: MODEL,
            tokens_used: tokensUsed,
            created_at: new Date().toISOString(),
          }, { onConflict: "plaud_asset_id" });

        if (insertError) {
          throw new Error(`Failed to save analysis: ${insertError.message}`);
        }

        // =====================================================
        // OMNI-SÊNIOR: Gerar análise estratégica
        // =====================================================
        try {
          console.log("[plaud-analyze-worker] Starting OMNI-SÊNIOR analysis for job:", job.id);
          
          // Garantir office_id diretamente do asset (blindagem multi-tenant)
          const assetOfficeId = asset.office_id;
          if (!assetOfficeId) {
            console.warn("[plaud-analyze-worker] OMNI-SÊNIOR: Asset has no office_id, skipping");
          } else {
            // Montar prompt com a análise já gerada
            const seniorUserMessage = `Analise a seguinte síntese de transcrição e determine a decisão estratégica:

TÍTULO: ${asset.title}

ANÁLISE NIJA:
${JSON.stringify(analysis, null, 2)}

TRANSCRIÇÃO (trecho):
${transcriptContent.slice(0, 5000)}`;

            // Chamar OpenAI para OMNI-SÊNIOR
            const seniorResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${openAiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: MODEL,
                messages: [
                  { role: "system", content: OMNI_SENIOR_PROMPT },
                  { role: "user", content: seniorUserMessage }
                ],
                temperature: 0.2,
                max_tokens: 1200,
                response_format: { type: "json_object" }
              }),
            });

            if (!seniorResponse.ok) {
              const errorText = await seniorResponse.text();
              console.warn("[plaud-analyze-worker] OMNI-SÊNIOR API error:", seniorResponse.status, errorText);
            } else {
              const seniorData = await seniorResponse.json();
              const seniorContent = seniorData.choices?.[0]?.message?.content;
              const seniorTokens = seniorData.usage?.total_tokens || 0;

              if (seniorContent) {
                let seniorAnalysis;
                try {
                  seniorAnalysis = JSON.parse(seniorContent);
                } catch {
                  console.warn("[plaud-analyze-worker] OMNI-SÊNIOR: Failed to parse JSON");
                  seniorAnalysis = null;
                }

                if (seniorAnalysis && seniorAnalysis.decisao_estrategica) {
                  // Normalizar para não violar constraints do banco
                  const decisao = seniorAnalysis.decisao_estrategica;
                  
                  // Garantir consistência AGIR
                  if (decisao === "AGIR") {
                    if (!seniorAnalysis.peca_sugerida || seniorAnalysis.peca_sugerida.trim() === "") {
                      seniorAnalysis.peca_sugerida = "Peça a definir pelo advogado";
                    }
                    seniorAnalysis.justificativa_silencio = null;
                  }
                  
                  // Garantir consistência SILENCIAR
                  if (decisao === "SILENCIAR") {
                    if (!seniorAnalysis.justificativa_silencio || seniorAnalysis.justificativa_silencio.trim() === "") {
                      seniorAnalysis.justificativa_silencio = "Não há providência jurídica necessária neste momento, por ausência de comando decisório ou prazo identificado";
                    }
                    seniorAnalysis.peca_sugerida = null;
                  }
                  
                  // Garantir checklist como array
                  if (!Array.isArray(seniorAnalysis.checklist)) {
                    seniorAnalysis.checklist = [];
                  }

                  // Upsert em plaud_senior_analysis (idempotente)
                  const { error: seniorInsertError } = await supabase
                    .from("plaud_senior_analysis")
                    .upsert({
                      plaud_asset_id: job.plaud_asset_id,
                      office_id: assetOfficeId,
                      decisao_estrategica: seniorAnalysis.decisao_estrategica,
                      status_juridico: seniorAnalysis.status_juridico || "ANALISADO",
                      risco_preclusao: seniorAnalysis.risco_preclusao || "NENHUM",
                      tipo_ato: seniorAnalysis.tipo_ato || null,
                      fase_processual: seniorAnalysis.fase_processual || null,
                      fato_central: seniorAnalysis.fato_central || null,
                      consequencia_juridica: seniorAnalysis.consequencia_juridica || null,
                      peca_sugerida: seniorAnalysis.peca_sugerida,
                      justificativa_silencio: seniorAnalysis.justificativa_silencio,
                      fundamento_legal: seniorAnalysis.fundamento_legal || null,
                      checklist: seniorAnalysis.checklist,
                      model_version: "omni-senior-v1",
                      tokens_used: seniorTokens,
                    }, { onConflict: "plaud_asset_id" });

                  if (seniorInsertError) {
                    console.warn("[plaud-analyze-worker] OMNI-SÊNIOR: Failed to save:", seniorInsertError.message);
                  } else {
                    console.log("[plaud-analyze-worker] OMNI-SÊNIOR: Saved successfully for job:", job.id, "Decisão:", decisao);
                  }
                }
              }
            }
          }
        } catch (seniorError: any) {
          // NUNCA falhar o job principal por erro no OMNI-SÊNIOR
          console.warn("[plaud-analyze-worker] OMNI-SÊNIOR error (non-fatal):", seniorError.message);
        }
        // =====================================================
        // FIM OMNI-SÊNIOR
        // =====================================================

        // Mark job as done
        await supabase
          .from("plaud_analysis_jobs")
          .update({ 
            status: "done", 
            finished_at: new Date().toISOString() 
          })
          .eq("id", job.id);

        results.push({ jobId: job.id, success: true });

      } catch (jobError: any) {
        console.error("[plaud-analyze-worker] Job failed:", job.id, jobError.message);
        
        // Mark job as failed
        await supabase
          .from("plaud_analysis_jobs")
          .update({ 
            status: "failed", 
            error: jobError.message,
            finished_at: new Date().toISOString() 
          })
          .eq("id", job.id);

        results.push({ jobId: job.id, success: false, error: jobError.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log("[plaud-analyze-worker] Batch complete:", { successCount, failCount });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        processed: jobs.length,
        success: successCount,
        failed: failCount,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[plaud-analyze-worker] Unexpected error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
