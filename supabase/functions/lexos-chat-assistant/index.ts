import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AssistantSuggestion {
  label: string;
  action: string;
  description: string;
}

function buildSystemPrompt(
  context: Record<string, unknown>,
  mode: "chat" | "consult" | "analysis",
  module: "medical" | "legal" | "global",
  basePrompt?: string,
  internalDocs?: string,
  activeSuggestions?: AssistantSuggestion[],
  memory?: Record<string, string>,
  extraInstructions?: string
): string {
  let systemMessage = basePrompt || `Você é a ATHENA, assistente inteligente do sistema Flaito.
Você atua na área ${module === "medical" ? "médica (saúde)" : "jurídica"}.
Tente ser útil, técnica e educada.`;

  if (mode === "consult") {
    systemMessage += `\n\n=== MODO CONSULTA ===
Foco em responder dúvidas baseadas em documentos internos fornecidos abaixo.`;
  }

  // Add memory context
  if (memory && Object.keys(memory).length > 0) {
    systemMessage += `\n\n=== MEMÓRIA DE CURTO PRAZO ===\n${JSON.stringify(memory)}`;
  }

  // Add suggestions if any
  if (activeSuggestions && activeSuggestions.length > 0) {
    systemMessage += `\n\n=== SUGESTÕES DE AÇÃO ===\nVocê pode sugerir as seguintes ações ao usuário se fizerem sentido:\n${activeSuggestions
      .map((s) => `- ${s.label}: ${s.description}`)
      .join("\n")}`;
  }

  // Add context
  systemMessage += `\n\n=== CONTEXTO ATUAL ===\n${JSON.stringify(context)}`;

  // Add internal docs (RAG)
  if (internalDocs) {
    systemMessage += `\n\n=== CONHECIMENTO INTERNO (RAG) ===\n${internalDocs}

⚠️ IMPORTANTE: Use o conhecimento acima PRIORITARIAMENTE para responder. Se a informação não estiver lá, você pode usar seu conhecimento geral, mas avise o usuário.`;
  } else {
    systemMessage += `\n\n⚠️ ALERTA: Nenhum documento interno localizado para esta consulta. Respondendo com base na doutrina geral.`;
  }

  // ── Extra Instructions (Office Specific) ──────────
  if (extraInstructions) {
    systemMessage += `\n\n==================================================\n### INSTRUÇÕES ADICIONAIS DO ESCRITÓRIO ###\n==================================================\n${extraInstructions}\n==================================================`;
  }

  return systemMessage;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { mode, module, message, context: requestContext, history = [] } = await req.json();

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
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Agent Config ─────────────────────────────────
    const { getAgentConfig } = await import("../_shared/agent-resolver.ts");
    
    // Resolve office_id from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('office_id')
      .eq('id', user.id)
      .single();
    
    const currentOfficeId = profile?.office_id || null;
    const agentSlug = module === "medical" ? "athena-medical-assistant" : "lexos-chat-assistant";

    const config = await getAgentConfig(supabase, agentSlug, {
      office_id: currentOfficeId
    });

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Configuração do agente não localizada." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!config.is_active || config.resolution.is_blocked) {
      return new Response(
        JSON.stringify({ error: "Este agente de IA está desativado no momento." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Context Building ─────────────────────────────
    let internalDocs = "";
    // Se for modo consulta, buscar docs no vector search (lexos_knowledge)
    if (mode === "consult" || (message && message.length > 10)) {
      const { data: docs } = await supabase.rpc("match_knowledge", {
        query_text: message,
        match_count: 5,
        office_filter: currentOfficeId
      });
      if (docs && docs.length > 0) {
        internalDocs = docs.map((d: any) => `[Doc: ${d.title}]\n${d.content}`).join("\n\n");
      }
    }

    const systemPrompt = buildSystemPrompt(
      requestContext || {},
      mode,
      module,
      config.system_prompt,
      internalDocs,
      [], // Suggestions
      {}, // Memory
      config.extra_instructions
    );

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10),
      { role: "user", content: message }
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model || "google/gemini-2.0-flash-exp",
        temperature: config.temperature ?? 0.7,
        max_tokens: config.max_tokens ?? 4096,
        messages: apiMessages,
        stream: false,
      }),
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
    const assistantMessage = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({
      content: assistantMessage,
      metadata: { mode, module, model: config.model },
      _audit: {
        config_id: config.resolution.config_id,
        version: config.resolution.version,
        source: config.resolution.source_level,
        fallback_used: config.resolution.fallback_used,
        agent_slug: agentSlug
      }
    }), {
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
