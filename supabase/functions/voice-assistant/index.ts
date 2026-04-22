import { authenticateAndAuthorize } from "../_shared/auth.ts";
import { resolveTTSConfig, synthesizeSpeech } from "../_shared/tts-provider.ts";
import { transcribeAudio, STTResult } from "../_shared/whisper-provider.ts";
import { getAgentConfig } from "../_shared/agent-resolver.ts";

// ============================================================
// AI Provider Layer
// ============================================================

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface AIResponse {
  ok: boolean;
  data?: any;
  error?: string;
  status?: number;
}

async function callAI(
  messages: any[],
  config: { provider: string; model: string; temperature: number },
  tools?: any[],
  toolChoice?: string
): Promise<AIResponse> {
  const apiKey = config.provider === 'openai' ? OPENAI_API_KEY : Deno.env.get(`${config.provider.toUpperCase()}_API_KEY`);
  
  if (!apiKey) {
    return { ok: false, error: `Missing API Key for ${config.provider}`, status: 500 };
  }

  // Support for OpenAI-compatible and other providers via centralized gateway or direct
  const url = config.provider === 'openai' 
    ? "https://api.openai.com/v1/chat/completions"
    : `https://api.gateway.lovable.dev/v1/chat/completions`; // Fallback for other providers

  const body: Record<string, unknown> = {
    model: config.model.includes('/') ? config.model : `openai/${config.model}`,
    messages,
    temperature: config.temperature,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = toolChoice || "auto";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return { ok: false, error: `${config.provider} API error: ${response.status}`, status: response.status };
  }

  const data = await response.json();
  return { ok: true, data };
}

// ============================================================
// CORS
// ============================================================

const ALLOWED_ORIGINS = Deno.env.get("CORS_ALLOWED_ORIGINS")?.split(",") || ["*"];

const getCorsHeaders = (origin: string | null) => {
    const isAllowed = origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*"));
    return {
        "Access-Control-Allow-Origin": isAllowed ? origin! : (ALLOWED_ORIGINS[0] || ""),
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
};

// ============================================================
// Tool Definitions (Synced with Athena)
// ============================================================

const TOOLS: any[] = [
    { type: "function", function: { name: "search_escavador_for_client", description: "Busca processos judiciais no Escavador usando dados do cliente (Nome/CPF). Use quando precisar de dados processuais externos atualizados.", parameters: { type: "object", properties: { client_id: { type: "string", description: "ID do cliente no CRM" }, query: { type: "string", description: "Termo de busca (Nome ou CPF)" } }, required: ["query"] } } },
    { type: "function", function: { name: "get_escavador_suggestions", description: "Recupera sugestões de processos de alta confiança já identificados para o cliente.", parameters: { type: "object", properties: { client_id: { type: "string" } }, required: ["client_id"] } } },
    { type: "function", function: { name: "link_escavador_process", description: "Vincula formalmente um processo do Escavador ao prontuário do cliente no CRM. Ação de escrita.", parameters: { type: "object", properties: { client_id: { type: "string" }, cnj: { type: "string", description: "Número CNJ do processo" } }, required: ["client_id", "cnj"] } } },
    { type: "function", function: { name: "getAppointments", description: "Busca agendamentos na agenda médica.", parameters: { type: "object", properties: { date: { type: "string" } } } } },
    { type: "function", function: { name: "getCases", description: "Busca processos jurídicos ativos.", parameters: { type: "object", properties: { client_id: { type: "string" } } } } },
    { type: "function", function: { name: "getClient", description: "Busca dados detalhados de um cliente ou paciente.", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } } }
];

const CONSULTATION_TOOLS = ["getAppointments", "getCases", "getClient", "search_escavador_for_client", "get_escavador_suggestions"];
const STRONG_CRITICAL_TOOLS = ["link_escavador_process", "sendMessage", "createAppointment", "generateDocument", "sign_document"];

type ToolCategory = "consultation" | "strong";

function getToolCategory(name: string): ToolCategory {
  if (CONSULTATION_TOOLS.includes(name)) return "consultation";
  return "strong";
}

// ============================================================
// Main Handler
// ============================================================

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestStartTime = Date.now();

  try {
    const auth = await authenticateAndAuthorize(req);
    if (!auth.ok) {
      return new Response(JSON.stringify(auth), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { user, membership, adminClient } = auth;
    const payload = await req.json();
    const officeId = membership.office_id;
    const sessionId = payload.sessionId || crypto.randomUUID();
    const client_id = payload.client_id || null;
    const client_study_context = payload.client_study_context || null;

    // Resolve Unified Agent Config
    const config = await getAgentConfig(adminClient, 'voice-assistant', { office_id: officeId });
    if (!config || !config.is_active) {
      return new Response(JSON.stringify({ action: "speak", response: "O agente de voz está desativado." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Rate Limiting
    const rl = await checkVoiceRateLimit(adminClient, user.uid);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ action: "speak", response: "Você está rápido demais. Aguarde um momento." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let transcript = "";
    let sttResult: STTResult | null = null;

    if (payload.audioBase64) {
      sttResult = await transcribeAudio(payload.audioBase64, payload.mimeType || 'audio/webm', { language: "pt" });
      transcript = sttResult.text.trim();
    } else {
      transcript = (payload.command || "").trim();
    }

    if (!transcript) {
        return new Response(JSON.stringify({ action: "speak", response: "Não ouvi nada." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    let reply = "";
    let actionResult: any = { action: "speak" };
    let toolNameDetected = 'chat';

    // Handshake Confirmation Check
    const isPositive = /^(sim|claro|com certeza|confirma|pode|va em frente|positivo|ok|isso mesmo)/i.test(transcript);

    if (payload.confirmActionId && isPositive) {
        const { data: pendingAction } = await adminClient
            .from("voice_pending_actions")
            .select("*")
            .eq("id", payload.confirmActionId)
            .eq("status", "pending")
            .single();

        if (pendingAction && new Date(pendingAction.expires_at) > new Date()) {
            await adminClient
                .from("voice_pending_actions")
                .update({ status: 'executed' })
                .eq("id", pendingAction.id);

            // Execute the tool logic
            if (pendingAction.intent === 'link_escavador_process') {
                await adminClient.functions.invoke("escavador-api", {
                    body: { action: "link_process_to_client", payload: pendingAction.args }
                });
            }

            reply = `Confirmado. Realizei o vínculo do processo conforme solicitado.`;
            actionResult = { action: "success", response: reply };
            toolNameDetected = pendingAction.intent;
        } else {
            reply = "Desculpe, esse comando expirou.";
            actionResult = { action: "speak", response: reply };
        }
    } else {
        // Build System Prompt (Unified with Athena)
        let systemPrompt = config.system_prompt || `Você é a ATHENA, assistente de voz inteligente.`;
        systemPrompt += `\nFale de forma natural e humana. Evite termos técnicos desnecessários ao falar.`;

        if (client_study_context) {
          systemPrompt += `\n\n=== CONTEXTO DE ESTUDO DO CLIENTE ===`;
          for (const [k, v] of Object.entries(client_study_context)) {
            systemPrompt += `\n${k}: ${v}`;
          }
        }

        const aiRes = await callAI([
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript }
        ], config, TOOLS);

        if (!aiRes.ok) throw new Error(`AI error: ${aiRes.error}`);

        const choice = aiRes.data.choices[0];
        reply = choice.message.content || "";
        actionResult = { action: "speak", response: reply };

        if (choice.message.tool_calls?.[0]) {
          const toolCall = choice.message.tool_calls[0];
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          const toolCategory = getToolCategory(toolName);
          toolNameDetected = toolName;

          if (toolCategory === 'strong') {
            const { data: pendingAction } = await adminClient
                .from("voice_pending_actions")
                .insert({
                    user_id: user.uid,
                    session_id: sessionId,
                    intent: toolName,
                    args: toolArgs,
                    expires_at: new Date(Date.now() + 30000).toISOString(),
                    status: 'pending'
                })
                .select()
                .single();

            const toolLabel = toolName === 'link_escavador_process' ? 'vincular este processo' : toolName;
            reply = `Entendido. Você confirma que deseja ${toolLabel}?`;
            actionResult = { 
                action: "require_confirmation", 
                response: reply,
                pendingActionId: pendingAction.id,
                intent: toolName
            };
          } else {
            // Consultation tools execute immediately and summarize via text
            // In a real voice flow, we would call the tool here and then call LLM again to speak the result
            reply = `Localizando informações sobre ${toolName}...`;
          }
        }
    }

    const ttsConfig = resolveTTSConfig({
      voiceId: config.guardrails?.voice_id || '21m00Tcm4TlvDq8ikWAM',
      stability: (config.guardrails?.voice_stability as number) || 0.5,
      similarity_boost: 0.75
    });
    const ttsResult = await synthesizeSpeech(reply, ttsConfig);

    await logVoiceAudit(adminClient, {
      user_id: user.uid,
      session_id: sessionId,
      transcript,
      intent: toolNameDetected,
      mode_requested: 'unified',
      mode_effective: 'unified',
      stt_confidence: sttResult?.confidence || 1.0,
      pending_action_id: actionResult.pendingActionId,
      action_status: actionResult.action === 'require_confirmation' ? 'pending' : (actionResult.action === 'success' ? 'executed' : 'success')
    });

    return new Response(JSON.stringify({
      ...actionResult,
      reply,
      tts: {
        provider: ttsResult.provider,
        audioBase64: ttsResult.audioBase64,
      },
      _metrics: { totalMs: Date.now() - requestStartTime }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[VOICE] Global Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno no processamento de voz." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});