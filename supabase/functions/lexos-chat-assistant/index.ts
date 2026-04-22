import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resolveRuntimeParams, type ReasoningMode } from "../_shared/reasoning-profiles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SourceChunk {
  id: string;
  chunk_text: string;
  similarity: number;
  source_type: string;
  metadata: Record<string, unknown>;
}

interface SourceUsed {
  type: string;
  chunk_ids: string[];
  similarity_avg: number;
  titles: string[];
}

// ─────────────────────────────────────────────────────────────
// System prompt builder with source-separated RAG
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  context: Record<string, unknown>,
  mode: string,
  module: string,
  basePrompt: string | undefined,
  systemContextDocs: string,
  privateKnowledgeDocs: string,
  webKnowledge: string,
  extraInstructions: string | undefined,
  clientStudyContext?: Record<string, string>
): string {
  let systemMessage = basePrompt || `Você é a ATHENA, assistente inteligente do sistema Flaito.
Você atua na área ${module === "medical" ? "médica (saúde)" : "jurídica"}.
Tente ser útil, técnica e educada.`;

  if (mode === "consult") {
    systemMessage += `\n\n=== MODO CONSULTA ===
Foco em responder dúvidas baseadas em documentos internos fornecidos abaixo.`;
  }

  systemMessage += `\n\n=== CONTEXTO DO SISTEMA ===\n${JSON.stringify(context)}`;

  // Client study context — structured strategy/context from the client's study profile
  if (clientStudyContext && Object.keys(clientStudyContext).length > 0) {
    systemMessage += `\n\n=== CONTEXTO DE ESTUDO DO CLIENTE ===`;
    systemMessage += `\nVocê está operando em MODO CLIENTE. Use as informações abaixo como contexto prioritário para suas respostas.`;
    systemMessage += `\nAdapte suas recomendações ao contexto específico deste cliente.\n`;
    for (const [label, value] of Object.entries(clientStudyContext)) {
      systemMessage += `\n**${label}:** ${value}`;
    }
    systemMessage += `\n\n⚠️ IMPORTANTE: Priorize o contexto de estudo acima ao responder. Não repita o contexto literalmente — use-o para fundamentar e direcionar suas respostas.`;
  }

  // Source-separated RAG sections
  if (systemContextDocs) {
    systemMessage += `\n\n=== CONHECIMENTO DO SISTEMA (casos, documentos, jurisprudência) ===\n${systemContextDocs}`;
  }

  if (privateKnowledgeDocs) {
    systemMessage += `\n\n=== CONHECIMENTO PRIVADO (biblioteca do escritório) ===\n${privateKnowledgeDocs}`;
  }

  if (webKnowledge) {
    systemMessage += `\n\n=== CONHECIMENTO DA WEB (busca em tempo real) ===\n${webKnowledge}`;
  }

  if (systemContextDocs || privateKnowledgeDocs || webKnowledge) {
    systemMessage += `\n\n⚠️ IMPORTANTE: Use o conhecimento acima PRIORITARIAMENTE. Sempre indique de qual fonte veio a informação (Sistema, Biblioteca Privada, ou Web). Se a informação não estiver em nenhuma fonte, você pode usar conhecimento geral, mas avise o usuário.`;
  } else {
    systemMessage += `\n\n⚠️ ALERTA: Nenhum documento localizado para esta consulta. Respondendo com base na doutrina geral.`;
  }

  if (extraInstructions) {
    systemMessage += `\n\n==================================================\n### INSTRUÇÕES ADICIONAIS DO ESCRITÓRIO ###\n==================================================\n${extraInstructions}\n==================================================`;
  }

  return systemMessage;
}

// ─────────────────────────────────────────────────────────────
// Vector search with source filtering
// ─────────────────────────────────────────────────────────────

async function searchKnowledge(
  serviceClient: any,
  message: string,
  officeId: string | null,
  sourceTypes: string[],
  matchCount: number,
  apiKey: string,
  filterVertical?: string | null,
  filterEntityId?: string | null
): Promise<{ chunks: SourceChunk[]; sourcesUsed: SourceUsed[] }> {
  if (sourceTypes.length === 0 || !message || message.length < 10) {
    return { chunks: [], sourcesUsed: [] };
  }

  // Generate embedding for user message
  const embResponse = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: message,
    }),
  });

  if (!embResponse.ok) {
    console.error("[lexos-chat] Embedding error:", await embResponse.text());
    return { chunks: [], sourcesUsed: [] };
  }

  const embData = await embResponse.json();
  const queryEmbedding = embData.data?.[0]?.embedding;
  if (!queryEmbedding) return { chunks: [], sourcesUsed: [] };

  // Call source-aware vector search
  const { data: chunks, error } = await serviceClient.rpc("match_knowledge_by_source", {
    query_embedding: queryEmbedding,
    match_threshold: 0.45,
    match_count: matchCount,
    filter_office_id: officeId,
    source_types: sourceTypes,
    filter_vertical: filterVertical,
    filter_entity_id: filterEntityId,
  });

  if (error) {
    console.error("[lexos-chat] Vector search error:", error.message);
    // Fallback to legacy text-based search
    const { data: fallbackDocs } = await serviceClient.rpc("match_knowledge", {
      query_text: message,
      match_count: matchCount,
      office_filter: officeId,
    });
    if (fallbackDocs && fallbackDocs.length > 0) {
      return {
        chunks: fallbackDocs.map((d: any) => ({
          id: d.id || "unknown",
          chunk_text: `[${d.title}]\n${d.content}`,
          similarity: 0.5,
          source_type: "system_context",
          metadata: { title: d.title },
        })),
        sourcesUsed: [{ type: "system_context", chunk_ids: [], similarity_avg: 0.5, titles: fallbackDocs.map((d: any) => d.title) }],
      };
    }
    return { chunks: [], sourcesUsed: [] };
  }

  // Group sources for provenance
  const sourceMap = new Map<string, { chunk_ids: string[]; similarities: number[]; titles: Set<string> }>();

  for (const chunk of (chunks || [])) {
    const st = chunk.source_type || "system_context";
    if (!sourceMap.has(st)) {
      sourceMap.set(st, { chunk_ids: [], similarities: [], titles: new Set() });
    }
    const entry = sourceMap.get(st)!;
    entry.chunk_ids.push(chunk.id);
    entry.similarities.push(chunk.similarity);
    const title = chunk.metadata?.title || "";
    if (title) entry.titles.add(title);
  }

  const sourcesUsed: SourceUsed[] = Array.from(sourceMap.entries()).map(([type, data]) => ({
    type,
    chunk_ids: data.chunk_ids,
    similarity_avg: data.similarities.reduce((a, b) => a + b, 0) / data.similarities.length,
    titles: Array.from(data.titles),
  }));

  return { chunks: chunks || [], sourcesUsed };
}

// ─────────────────────────────────────────────────────────────
// Rerank chunks by relevance (for deep/maximum modes)
// ─────────────────────────────────────────────────────────────

function rerankChunks(chunks: SourceChunk[], topN: number): SourceChunk[] {
  // Simple reranking: sort by similarity, deduplicate by content prefix
  const seen = new Set<string>();
  const unique: SourceChunk[] = [];

  for (const chunk of chunks.sort((a, b) => b.similarity - a.similarity)) {
    const prefix = chunk.chunk_text.substring(0, 100);
    if (!seen.has(prefix)) {
      seen.add(prefix);
      unique.push(chunk);
    }
  }

  return unique.slice(0, topN);
}

// ─────────────────────────────────────────────────────────────
// Tool Definitions (Escavador & System)
// ─────────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_escavador_for_client",
      description: "Busca processos judiciais no Escavador usando dados do cliente (Nome/CPF). Use quando precisar de dados processuais externos atualizados.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "ID do cliente no CRM" },
          query: { type: "string", description: "Termo de busca (Nome ou CPF)" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_escavador_suggestions",
      description: "Recupera sugestões de processos de alta confiança já identificados para o cliente.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" }
        },
        required: ["client_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "link_escavador_process",
      description: "Vincula formalmente um processo do Escavador ao prontuário do cliente no CRM. Ação de escrita.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          cnj: { type: "string", description: "Número CNJ do processo" }
        },
        required: ["client_id", "cnj"]
      }
    }
  }
];

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestStart = Date.now();

  try {
    const {
      mode = "chat",
      module,
      message,
      context: requestContext,
      history = [],
      thread_id,
      test_mode,
      agent_slug: requestSlug,
      client_study_context,
      allowed_tools = [],
      client_id,
      patient_id,
      case_id,
    } = await req.json();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Resolve agent config ─────────────────────────
    const { getAgentConfig } = await import("../_shared/agent-resolver.ts");

    const { data: profile } = await supabase
      .from("profiles")
      .select("office_id")
      .eq("id", user.id)
      .single();

    const currentOfficeId = profile?.office_id || null;
    const agentSlug = requestSlug || (module === "medical" ? "athena-medical-assistant" : "lexos-chat-assistant");

    const config = await getAgentConfig(supabase, agentSlug, {
      office_id: currentOfficeId,
    });

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Configuração do agente não localizada." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🔥 Override global config with vertical-specific settings if present
    const verticalSettingsKey = module === 'legal' ? 'legal_settings' : 'medical_settings';
    if (config.metadata && config.metadata[verticalSettingsKey]) {
      Object.assign(config, config.metadata[verticalSettingsKey]);
      console.log(`[lexos-chat] Applied vertical overrides from ${verticalSettingsKey}`);
    }

    if (!config.is_active || config.resolution.is_blocked) {
      return new Response(
        JSON.stringify({ error: "Este agente de IA está desativado no momento." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolve reasoning profile ────────────────────
    const reasoningMode: ReasoningMode = config.reasoning_mode || "standard";
    const runtime = resolveRuntimeParams(reasoningMode, {
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
    });

    console.log(`[lexos-chat] Agent: ${agentSlug} | Mode: ${reasoningMode} | Model: ${runtime.model} | Office: ${currentOfficeId}`);

    // ── Knowledge retrieval with source separation ───
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Configuração de IA incompleta (OPENAI_API_KEY ausente)." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceTypes: string[] = [];
    if (config.use_system_context) sourceTypes.push("system_context");
    if (config.use_private_knowledge) sourceTypes.push("private_knowledge");

    const filterEntityId = client_id || patient_id || case_id || null;

    const { chunks, sourcesUsed } = await searchKnowledge(
      serviceClient,
      message,
      currentOfficeId,
      sourceTypes,
      runtime.retrieval_count,
      OPENAI_API_KEY,
      module,
      filterEntityId
    );

    // Optionally rerank for deep/maximum modes
    const finalChunks = runtime.rerank ? rerankChunks(chunks, runtime.retrieval_count) : chunks;

    // Separate chunks by source type for the prompt
    const systemContextText = finalChunks
      .filter(c => c.source_type === "system_context")
      .map(c => c.chunk_text)
      .join("\n\n---\n\n");

    const privateKnowledgeText = finalChunks
      .filter(c => c.source_type === "private_knowledge")
      .map(c => c.chunk_text)
      .join("\n\n---\n\n");

    // Web knowledge (placeholder — real implementation requires search API)
    let webKnowledge = "";
    if (config.use_web_knowledge) {
      // TODO: Integrate real web search API (Brave, Serper, etc.)
      // For now, flag that web knowledge was requested but not available
      console.log("[lexos-chat] Web knowledge requested but no search API configured yet");
    }

    // ── Build system prompt ──────────────────────────
    const systemPrompt = buildSystemPrompt(
      requestContext || {},
      mode,
      module,
      config.system_prompt,
      systemContextText,
      privateKnowledgeText,
      webKnowledge,
      config.extra_instructions,
      client_study_context
    );

    if (client_study_context && Object.keys(client_study_context).length > 0) {
      console.log(`[lexos-chat] Client study context injected: ${Object.keys(client_study_context).length} fields`);
    }

    // ── Call LLM ─────────────────────────────────────
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10),
      { role: "user", content: message },
    ];

    const body: Record<string, any> = {
      model: runtime.model || "gpt-4o",
      temperature: runtime.temperature,
      max_tokens: runtime.max_tokens,
      messages: apiMessages,
      stream: false,
    };

    // Inject TOOLS if module is legal and enabled
    if (module === "legal") {
      body.tools = TOOLS;
      body.tool_choice = "auto";
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      console.error("AI Error:", err);
      return new Response(JSON.stringify({ error: "AI service failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices?.[0];
    const assistantMessage = choice?.message?.content || "";
    const toolCalls = choice?.message?.tool_calls || [];
    const tokensUsed = aiData.usage || {};

    // ── Permission Check ─────────────────────────────
    let requiresPermission = false;
    let effectiveToolCalls = toolCalls;

    if (toolCalls.length > 0) {
      // Log tool call attempt
      for (const tc of toolCalls) {
        await serviceClient.from("assistant_action_log").insert({
          office_id: currentOfficeId,
          user_id: user.id,
          action_type: "tool_call",
          tool_name: tc.function.name,
          status: "detected",
          metadata: { 
            arguments: tc.function.arguments,
            thread_id,
            client_id
          }
        });
      }

      // Get permission mode from assistant_memory
      const { data: permMemory } = await supabase
        .from("assistant_memory")
        .select("value")
        .eq("office_id", currentOfficeId)
        .eq("user_id", user.id)
        .eq("key", "escavador_permission_mode")
        .maybeSingle();

      const permMode = permMemory?.value || "ask_always";

      // Check if ALL tool calls are already allowed in this session
      const pendingTools = toolCalls.filter((tc: any) => !allowed_tools.includes(tc.function.name));
      
      if (pendingTools.length > 0) {
        if (permMode === "ask_always") {
          requiresPermission = true;
        } else if (permMode === "allow_low_risk") {
          const hasHighRisk = pendingTools.some((tc: any) => tc.function.name === "link_escavador_process");
          if (hasHighRisk) requiresPermission = true;
        }
      }
    }

    // ── Build response metadata ──────────────────────
    const auditMeta = {
      config_id: config.resolution.config_id,
      version: config.resolution.version,
      source: config.resolution.source_level,
      fallback_used: config.resolution.fallback_used,
      agent_slug: agentSlug,
    };

    const responseMeta = {
      mode,
      module,
      model_used: runtime.model,
      reasoning_profile: reasoningMode,
      sources_used: sourcesUsed,
      tokens: tokensUsed,
      latency_ms: Date.now() - requestStart,
    };

    // ── Persist messages server-side ─────────────────
    if (thread_id) {
      await serviceClient.from("chat_messages").insert([
        {
          thread_id,
          role: "user",
          content: message,
          metadata: { mode, module },
        },
        {
          thread_id,
          role: "assistant",
          content: assistantMessage,
          metadata: {
            ...responseMeta,
            _audit: auditMeta,
          },
        },
      ]);
    }

    // ── Build response ───────────────────────────────
    const responseBody: Record<string, unknown> = {
      content: assistantMessage,
      message: assistantMessage,
      metadata: responseMeta,
      sources_used: sourcesUsed,
      _audit: auditMeta,
      tool_calls: effectiveToolCalls,
      requires_permission: requiresPermission,
    };

    // In test mode, include debug data for preview parity validation
    if (test_mode) {
      responseBody._debug = {
        runtime,
        config_snapshot: {
          slug: config.slug,
          reasoning_mode: reasoningMode,
          use_system_context: config.use_system_context,
          use_private_knowledge: config.use_private_knowledge,
          use_web_knowledge: config.use_web_knowledge,
          model: runtime.model,
          temperature: runtime.temperature,
          max_tokens: runtime.max_tokens,
          retrieval_count: runtime.retrieval_count,
          rerank: runtime.rerank,
        },
        chunks_retrieved: finalChunks.length,
        source_types_searched: sourceTypes,
        tokens: tokensUsed,
        latency_ms: Date.now() - requestStart,
      };
    }

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("General Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
