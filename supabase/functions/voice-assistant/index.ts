import { authenticateAndAuthorize } from "../_shared/auth.ts";
import { resolveTTSConfig, synthesizeSpeech } from "../_shared/tts-provider.ts";
import { transcribeAudio, STTResult } from "../_shared/whisper-provider.ts";

// ============================================================
// OpenAI Provider Layer
// ============================================================

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"] as const;
const DEFAULT_MODEL = "gpt-4o-mini";

interface OpenAIResponse {
  ok: boolean;
  data?: any;
  error?: string;
  status?: number;
}

async function callOpenAI(
  messages: any[],
  model: string = DEFAULT_MODEL,
  tools?: any[],
  toolChoice?: string,
  temperature: number = 0.1
): Promise<OpenAIResponse> {
  if (!OPENAI_API_KEY) {
    return { ok: false, error: "Missing OPENAI_API_KEY", status: 500 };
  }

  const normalizedModel = model.replace("openai/", "").replace("google/", "");
  const finalModel = OPENAI_MODELS.includes(normalizedModel as any) ? normalizedModel : DEFAULT_MODEL;

  const body: Record<string, unknown> = {
    model: finalModel,
    messages,
    temperature,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = toolChoice || "auto";
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return { ok: false, error: `OpenAI API error: ${response.status}`, status: response.status };
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
// Tool Definitions & Categorization
// ============================================================

    { type: "function", function: { name: "sign_document", description: "Assina digitalmente um documento. Ação CRÍTICA.", parameters: { type: "object", properties: { document_id: { type: "string" } }, required: ["document_id"] } } },
    { type: "function", function: { name: "searchEscavador", description: "Busca processos no Escavador por nome de cliente ou CNJ.", parameters: { type: "object", properties: { query: { type: "string" }, client_id: { type: "string" } }, required: ["query"] } } },
    { type: "function", function: { name: "linkEscavadorProcess", description: "Vincula um processo encontrado ao cadastro do cliente no CRM.", parameters: { type: "object", properties: { cnj: { type: "string" }, client_id: { type: "string" } }, required: ["cnj", "client_id"] } } },
    { type: "function", function: { name: "getEscavadorSuggestions", description: "Busca sugestões de processos de alta confiança para um cliente específico.", parameters: { type: "object", properties: { client_id: { type: "string" } }, required: ["client_id"] } } },
    { type: "function", function: { name: "summarizeProcess", description: "Gera um resumo inteligente do processo jurídico.", parameters: { type: "object", properties: { cnj: { type: "string" } }, required: ["cnj"] } } }
];

const CONSULTATION_TOOLS = ["getAppointments", "getCases", "getClient", "searchEscavador", "getEscavadorSuggestions", "summarizeProcess"];
const LIGHT_CRITICAL_TOOLS = ["create_draft"];
const STRONG_CRITICAL_TOOLS = ["sendMessage", "createAppointment", "generateDocument", "sign_document", "linkEscavadorProcess"];

type ToolCategory = "consultation" | "light" | "strong";

function getToolCategory(name: string): ToolCategory {
  if (CONSULTATION_TOOLS.includes(name)) return "consultation";
  if (LIGHT_CRITICAL_TOOLS.includes(name)) return "light";
  return "strong";
}

function canExecuteInMode(mode: string, toolCategory: ToolCategory): boolean {
  if (mode === 'automatic' || mode === 'critical') return true;
  if (mode === 'assisted') return toolCategory !== 'strong';
  if (mode === 'consultation') return toolCategory === 'consultation';
  return false;
}

// ============================================================
// Stage 12: DB-backed Rate Limiting & Kill-Switch Helpers
// (replaces in-memory token bucket which doesn't scale)
// ============================================================

async function checkVoiceRateLimit(adminClient: any, userId: string): Promise<{ allowed: boolean }> {
  try {
    const { data, error } = await adminClient.rpc("check_and_increment_rate_limit", {
      p_scope_type:       "user",
      p_scope_id:         userId,
      p_action:           "voice_actions",
      p_limit_per_window: 20,   // 20 voice actions per minute
      p_window_minutes:   1,
    });
    if (error) {
      console.warn(`[VoiceRateLimit] RATE_LIMIT_SYSTEM_DEGRADED: ${error.message}`);
      return { allowed: true };  // fail-open
    }
    return { allowed: (data as Record<string, unknown>).allowed as boolean };
  } catch (err) {
    console.warn(`[VoiceRateLimit] RATE_LIMIT_SYSTEM_DEGRADED: ${(err as Error).message}`);
    return { allowed: true };  // fail-open
  }
}

async function isVoiceKillSwitchActive(adminClient: any, officeId: string): Promise<boolean> {
  try {
    // Check both global and office-scoped voice_actions switch
    const { data } = await adminClient.rpc("is_kill_switch_active", {
      p_switch_type: "voice_actions",
      p_scope_id:    officeId,
    });
    return data as boolean ?? false;
  } catch {
    return false;  // fail-open
  }
}

async function logVoiceAudit(supabase: any, params: any) {
  try {
    await supabase.from("voice_agent_audit_logs").insert({
      user_id: params.user_id,
      session_id: params.session_id,
      transcript: params.transcript,
      intent: params.intent,
      mode_requested: params.mode_requested,
      mode_effective: params.mode_effective,
      tool_called: params.tool_called,
      resource_type: params.resource_type,
      resource_id: params.resource_id,
      confirmation_required: !!params.pending_action_id,
      stt_confidence: params.stt_confidence,
      pending_action_id: params.pending_action_id,
      action_status: params.action_status,
      error_message: params.error_message
    });
  } catch (e) {
    console.error("[audit][voice] Failed to write log:", e);
  }
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

    // Stage 12: DB-backed rate limit (replaces in-memory token bucket)
    const rl = await checkVoiceRateLimit(adminClient, user.uid);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ action: "speak", response: "Você está rápido demais. Aguarde um momento." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Stage 12: Kill-switch check for voice_actions
    const voiceKilled = await isVoiceKillSwitchActive(adminClient, officeId);
    if (voiceKilled) {
      return new Response(JSON.stringify({ action: "speak", response: "O agente de voz está temporariamente desativado." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
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

    const { data: voiceSettings } = await adminClient
      .from("user_voice_settings")
      .select("*")
      .eq("user_id", user.uid)
      .maybeSingle();

    let effectiveMode = voiceSettings?.default_voice_mode || 'automatic';
    const confidence = sttResult?.confidence || 1.0;

    // Safety Gating
    if (confidence < 0.7 && effectiveMode !== 'consultation') {
        effectiveMode = 'assisted';
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
            
            if (pendingAction.intent === 'linkEscavadorProcess') {
                // Specialized Link logic
                await adminClient.functions.invoke("escavador-api", {
                    body: { action: "link_process_to_client", payload: pendingAction.args }
                });
            }

            reply = `Confirmado. Executando ${pendingAction.intent} agora.`;
            actionResult = { action: "success", response: reply };
            toolNameDetected = pendingAction.intent;
        } else {
            reply = "Desculpe, esse comando expirou.";
            actionResult = { action: "speak", response: reply };
        }
    } else {
        const systemPrompt = `Você é o Assistente Inteligente da Flaito (não use um nome específico agora). Fale em Português do Brasil.
    Modo: ${effectiveMode}. Confiança: ${confidence}.
    REGRA PROATIVA: Se houver processos sugeridos pelo Escavador com confiança acima de 85% para o cliente em questão, sugira ativamente o vínculo ao usuário.`;

        const aiRes = await callOpenAI([
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript }
        ], DEFAULT_MODEL, TOOLS);

        if (!aiRes.ok) throw new Error("AI connection failed");

        const choice = aiRes.data.choices[0];
        reply = choice.message.content || "";
        actionResult = { action: "speak", response: reply };

        if (choice.message.tool_calls?.[0]) {
          const toolCall = choice.message.tool_calls[0];
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          const toolCategory = getToolCategory(toolName);
          toolNameDetected = toolName;

          if (!canExecuteInMode(effectiveMode, toolCategory)) {
            reply = `Ação "${toolName}" não é permitida no modo ${effectiveMode}.`;
            actionResult = { action: "speak", response: reply };
          } else if (toolCategory !== 'consultation') {
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

            reply = `Entendido. Você confirma a execução de ${toolName}?`;
            actionResult = { 
                action: "require_confirmation", 
                response: reply,
                pendingActionId: pendingAction.id,
                intent: toolName
            };
          } else {
            reply = `Localizando informações para ${toolName}...`;
          }
        }
    }

    const ttsConfig = resolveTTSConfig({
      voiceId: voiceSettings?.voice_id || '21m00Tcm4TlvDq8ikWAM',
      stability: voiceSettings?.tts_stability || 0.5,
      similarity_boost: voiceSettings?.tts_similarity_boost || 0.75
    });
    const ttsResult = await synthesizeSpeech(reply, ttsConfig);

    await logVoiceAudit(adminClient, {
      user_id: user.uid,
      session_id: sessionId,
      transcript,
      intent: toolNameDetected,
      mode_requested: voiceSettings?.default_voice_mode,
      mode_effective: effectiveMode,
      stt_confidence: confidence,
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