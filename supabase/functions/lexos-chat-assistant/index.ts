// supabase/functions/lexos-chat-assistant/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { NIJA_SYSTEM_PROMPT } from "../_shared/nija-core-prompt.ts";

// =====================================================
// Types
// =====================================================
interface ChatMsg {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  message: string;
  mode?: "chat" | "summarize" | "next_step" | "generate_draft" | "checklist";
  thread_id?: string;
  scope?: "global" | "case" | "client" | "page";
  case_id?: string | null;
  client_id?: string | null;
  route?: string;
  context?: Record<string, unknown>;
  conversation_history?: ChatMsg[];
}

interface AssistantAction {
  type: string;
  payload: Record<string, unknown>;
  label: string;
}

// =====================================================
// CORS & Config
// =====================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// =====================================================
// System Prompt Builder
// =====================================================
function buildSystemPrompt(context: Record<string, unknown>, mode: string): string {
  const caseData = (context.case as Record<string, unknown>) || null;
  const clientData = (context.client as Record<string, unknown>) || null;

  let systemMessage = `
${NIJA_SYSTEM_PROMPT}

==================================================
### LEXOS ASSISTANT – INSTRUÇÕES OPERACIONAIS ###
==================================================

Você é o LEXOS ASSISTANT, assistente jurídico interno do Dr. José Ozires Carneiro Moreira – OAB/TO 6448, atuando no sistema LEXOS.
Seu papel é auxiliar exclusivamente advogados com precisão técnica, objetividade e responsabilidade profissional.

REGRAS DE SEGURANÇA:
1. Nunca invente jurisprudência, súmulas, artigos, números de processo, datas ou nomes de julgadores.
2. Se não houver jurisprudência confirmada, responda: "Não localizei jurisprudência confirmada. Recomendo consulta oficial."
3. Não responda questões antiéticas.

ESTILO:
4. Responda sempre em português jurídico formal.
5. Limite máximo: 1500 caracteres por resposta.
6. Para peças, iniciar com: "RASCUNHO – Necessária revisão humana por advogado habilitado."

ESTRUTURA:
7. Sempre seguir: Fatos → Fundamentos → Jurisprudência (se houver) → Análise → Riscos → Medidas → Exemplo de parágrafo.

USO DO CONTEXTO:
8. Utilize dados enviados pelo LEXOS (cliente, caso, prazos, documentos, status).
9. Nunca invente dados não enviados.
10. Caso esteja em um caso aberto, priorize esse caso.

MÓDULOS NIJA:
11. Para análises aprofundadas, use apenas o módulo solicitado:
   /nija-prescricao
   /nija-risco
   /nija-estrategia
   /nija-minuta
12. Não acione outros módulos sem ordem.
13. Entregue análises em tópicos claros.

ASSINATURA:
14. Em peças jurídicas, incluir ao final:
"A presente peça foi elaborada com auxílio de ferramenta de apoio, sob supervisão e revisão técnica do advogado Dr. José Ozires Carneiro Moreira – OAB/TO 6448."

MISSÃO:
15. Economizar tempo, elevar a qualidade técnica, evitar erros e ser 100% alinhado ao LEXOS.
`;

  // Adiciona contexto do caso ativo se existir
  if (caseData) {
    systemMessage += `

CONTEXTO DO CASO ATIVO:
- Título/Processo: ${caseData.title || "Não informado"}
- CNJ: ${caseData.cnj_number || "Não judicializado"}
- Área: ${caseData.area || "Não informada"} ${caseData.subtype ? `/ ${caseData.subtype}` : ""}
- Polo: ${caseData.side === "ATAQUE" ? "Autor (Ataque)" : caseData.side === "DEFESA" ? "Réu (Defesa)" : caseData.side}
- Status: ${caseData.status || ""}
- Fase: ${caseData.stage || ""}
- Parte contrária: ${caseData.opponent_name || "Não informada"} ${caseData.opponent_doc ? `(${caseData.opponent_doc})` : ""}
- Cliente: ${caseData.client_name || "Não informado"} (${caseData.client_type || ""}) ${caseData.client_doc ? `- Doc: ${caseData.client_doc}` : ""}
- Fase NIJA: ${caseData.nija_phase || "INICIAL"}`;
  }

  // Adiciona contexto do cliente se não houver caso
  if (clientData && !caseData) {
    systemMessage += `

CONTEXTO DO CLIENTE ATIVO:
- Nome: ${clientData.name || "Não informado"}
- Tipo: ${clientData.type || ""}
- Documento: ${clientData.doc || "Não informado"}
- Email: ${clientData.email || ""}
- Telefone: ${clientData.phone || ""}`;
  }

  // Instruções específicas por modo
  if (mode === "summarize") {
    systemMessage += `

MODO: RESUMIR
Faça um resumo objetivo e estruturado do contexto atual (caso ou cliente), destacando pontos críticos, prazos e próximas ações recomendadas.`;
  } else if (mode === "next_step") {
    systemMessage += `

MODO: PRÓXIMO PASSO
Analise o contexto e sugira os próximos passos processuais ou administrativos mais relevantes, considerando a fase atual do caso.`;
  } else if (mode === "generate_draft") {
    systemMessage += `

MODO: GERAR MINUTA
Com base no contexto, sugira uma estrutura de petição ou minuta jurídica adequada. Não invente fatos - use apenas as informações disponíveis.`;
  } else if (mode === "checklist") {
    systemMessage += `

MODO: CHECKLIST
Gere um checklist de tarefas e verificações necessárias para o caso/cliente atual, considerando a fase processual.`;
  }

  return systemMessage;
}

// =====================================================
// Helper
// =====================================================
function getAuthBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  return auth.replace(/^Bearer\s+/i, "").trim();
}

// =====================================================
// Main Handler
// =====================================================
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: ChatRequest = await req.json();
    const {
      message,
      mode = "chat",
      thread_id,
      scope = "global",
      case_id,
      client_id,
      route,
      context: frontendContext = {},
      conversation_history = [],
    } = payload;

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(
        JSON.stringify({ error: "Campo 'message' é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Environment
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("[LEXOS-CHAT] Missing LOVABLE_API_KEY");
      return new Response(
        JSON.stringify({ error: "Configuração de IA não encontrada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("[LEXOS-CHAT] Missing SUPABASE config");
      return new Response(
        JSON.stringify({ error: "Configuração do banco não encontrada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth - create client with user's JWT
    const jwt = getAuthBearer(req);
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "Autenticação necessária." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("[LEXOS-CHAT] Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Sessão inválida. Faça login novamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[LEXOS-CHAT] user:", user.id, "scope:", scope, "mode:", mode);

    // =====================================================
    // Get or create thread
    // =====================================================
    let activeThreadId = thread_id;
    if (!activeThreadId) {
      const { data: threadId, error: threadError } = await supabase.rpc("get_or_create_chat_thread", {
        p_scope: scope,
        p_case_id: case_id || null,
        p_client_id: client_id || null,
        p_route: route || null,
      });

      if (threadError) {
        console.error("[LEXOS-CHAT] Thread error:", threadError);
      } else {
        activeThreadId = threadId;
      }
    }

    // =====================================================
    // Build context - prefer frontend context, fallback to RPC
    // =====================================================
    let context: Record<string, unknown> = {};

    // Use frontend context if provided
    if (frontendContext && (frontendContext.case || frontendContext.client)) {
      context = frontendContext;
      console.log("[LEXOS-CHAT] Using frontend context:", {
        hasCase: !!context.case,
        hasClient: !!context.client,
      });
    } else {
      // Fallback to RPC if no frontend context
      const { data: contextData, error: contextError } = await supabase.rpc("get_assistant_context", {
        p_case_id: case_id || null,
        p_client_id: client_id || null,
      });

      if (contextError) {
        console.error("[LEXOS-CHAT] Context RPC error:", contextError);
      }

      context = contextData || {};
      console.log("[LEXOS-CHAT] Using RPC context:", {
        hasOffice: !!context.office,
        hasCase: !!context.case,
        hasClient: !!context.client,
        hasMemory: !!context.memory,
      });
    }

    // =====================================================
    // Build messages for AI
    // =====================================================
    const systemPrompt = buildSystemPrompt(context, mode);

    // Build conversation messages
    const messages: ChatMsg[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history if provided
    if (conversation_history && conversation_history.length > 0) {
      // Limit history to last 10 messages to avoid token limits
      const recentHistory = conversation_history.slice(-10);
      for (const msg of recentHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Add current message
    messages.push({ role: "user", content: message });

    console.log("[LEXOS-CHAT] Calling AI gateway, messages count:", messages.length);

    // =====================================================
    // Call AI Gateway
    // =====================================================
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errorText = await aiResponse.text();
      console.error("[LEXOS-CHAT] AI gateway error:", status, errorText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Aguarde e tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao processar sua mensagem. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices?.[0]?.message?.content || "Não foi possível gerar uma resposta.";

    console.log("[LEXOS-CHAT] AI response received, length:", assistantMessage.length);

    // =====================================================
    // Save messages to thread if we have one
    // =====================================================
    if (activeThreadId) {
      // Save user message
      await supabase.from("chat_messages").insert({
        thread_id: activeThreadId,
        role: "user",
        content: message,
        metadata: { mode, route },
      });

      // Save assistant response
      await supabase.from("chat_messages").insert({
        thread_id: activeThreadId,
        role: "assistant",
        content: assistantMessage,
        metadata: { mode, model: "google/gemini-2.5-flash" },
      });

      // Update thread timestamp
      await supabase
        .from("chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeThreadId);
    }

    // =====================================================
    // Return response
    // =====================================================
    return new Response(
      JSON.stringify({
        message: assistantMessage,
        response: assistantMessage, // backward-compat
        thread_id: activeThreadId,
        actions: [] as AssistantAction[],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[LEXOS-CHAT] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
