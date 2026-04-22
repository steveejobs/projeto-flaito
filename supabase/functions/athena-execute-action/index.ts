// supabase/functions/athena-execute-action/index.ts
// Executa ações confirmadas pelo usuário com rastreabilidade total
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getAuthBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  return auth.replace(/^Bearer\s+/i, "").trim();
}

// Ações que NUNCA podem ser executadas automaticamente (sempre requerem confirmação)
const BLOCKED_AUTO_ACTIONS = ["delete_case", "delete_patient", "sign_document", "archive_case"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(
        JSON.stringify({ error: "Configuração do banco não encontrada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwt = getAuthBearer(req);
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "Autenticação necessária." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cliente com JWT do usuário (respeita RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    // Cliente com service role (para invocar outras funções)
    const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : supabase;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action_type, action_payload = {}, suggestion_id, confirmed = false } = body;

    if (!action_type) {
      return new Response(
        JSON.stringify({ error: "Campo 'action_type' é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Segurança: ações bloqueadas nunca são automatizadas
    if (BLOCKED_AUTO_ACTIONS.includes(action_type)) {
      return new Response(
        JSON.stringify({ error: `A ação '${action_type}' não pode ser executada automaticamente por segurança.` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!confirmed) {
      return new Response(
        JSON.stringify({ error: "Confirmação explícita necessária para executar esta ação.", requires_confirmation: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("office_id")
      .eq("id", user.id)
      .maybeSingle();

    const officeId = profile?.office_id;

    // Log da ação (antes de executar, para rastreabilidade)
    const { data: actionLog } = await supabase
      .from("assistant_action_log")
      .insert({
        office_id: officeId,
        user_id: user.id,
        action_type,
        action_payload,
        suggestion_id: suggestion_id || null,
        status: "started",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    const logId = actionLog?.id;
    let result: Record<string, unknown> = {};
    let status = "success";
    let errorMessage: string | null = null;

    // ═══════════════════════════════════════════════════
    // EXECUTORES DE AÇÃO
    // ═══════════════════════════════════════════════════
    try {
      switch (action_type) {

        // Envia lembretes de consulta via notifications-worker
        case "send_appointment_reminders": {
          const { appointment_ids } = action_payload as { appointment_ids: string[] };
          if (!appointment_ids?.length) throw new Error("Nenhuma consulta informada.");

          const response = await supabaseAdmin.functions.invoke("notifications-worker", {
            body: {
              trigger: "manual_reminder",
              appointment_ids,
              office_id: officeId,
            },
          });

          result = { triggered: appointment_ids.length, response: response.data };
          break;
        }

        // Envia follow-up para pacientes sem retorno
        case "send_followup": {
          const { patient_ids } = action_payload as { patient_ids: string[] };
          if (!patient_ids?.length) throw new Error("Nenhum paciente informado.");

          // Busca dados dos pacientes e enfileira notificações
          const { data: patients } = await supabase
            .from("pacientes")
            .select("id, nome, telefone")
            .in("id", patient_ids)
            .eq("office_id", officeId);

          let sent = 0;
          for (const patient of (patients || [])) {
            if (!patient.telefone) continue;
            await supabase.from("notifications_log").insert({
              office_id: officeId,
              recipient: patient.telefone,
              message_type: "followup",
              template_data: { patient_name: patient.nome },
              status: "queued",
              entity_type: "pacientes",
              entity_id: patient.id,
            });
            sent++;
          }

          result = { patients_queued: sent };
          break;
        }

        // Reprocessa notificações com falha
        case "reprocess_failed_notifications": {
          const { notification_ids } = action_payload as { notification_ids: string[] };
          if (!notification_ids?.length) throw new Error("Nenhuma notificação informada.");

          await supabase
            .from("notifications_log")
            .update({ status: "queued", error_message: null, retry_count: 0 })
            .in("id", notification_ids)
            .eq("office_id", officeId);

          // Dispara o worker para reprocessar
          await supabaseAdmin.functions.invoke("notifications-worker", {
            body: { trigger: "reprocess", office_id: officeId },
          });

          result = { requeued: notification_ids.length };
          break;
        }

        // Navegar para revisão de caso (ação de navegação — retorna URL)
        case "review_case": {
          const { case_ids } = action_payload as { case_ids: string[] };
          const first = case_ids?.[0];
          result = {
            navigate_to: first ? `/casos/${first}` : "/casos",
            message: `Abrindo o caso para revisão.`,
          };
          break;
        }

        // Busca no Escavador para cliente
        case "search_escavador_for_client": {
          const { client_id, query } = action_payload as { client_id: string, query: string };
          if (!client_id) throw new Error("ID do cliente é obrigatório.");

          // Aqui apenas retornamos para o frontend navegar ou abrir o chat com a pergunta pronta
          result = {
            navigate_to: `/clientes/${client_id}`,
            open_chat_with: `Busque processos no Escavador para o termo: ${query}`,
            message: `Iniciando busca no Escavador para o cliente selecionado.`,
          };
          break;
        }

        // Revisão de laudos (ação de navegação)
        case "review_reports": {
          result = { navigate_to: "/medico/relatorios", message: "Abrindo laudos para revisão." };
          break;
        }

        // Solicitar assinatura (ação de navegação)
        case "request_signature": {
          const { document_ids } = action_payload as { document_ids: string[] };
          result = {
            navigate_to: document_ids?.[0] ? `/documentos/${document_ids[0]}` : "/documentos",
            message: "Abrindo documento para assinatura.",
          };
          break;
        }

        default:
          throw new Error(`Tipo de ação desconhecido: '${action_type}'`);
      }

    } catch (execError: any) {
      status = "failed";
      errorMessage = execError?.message || "Erro desconhecido na execução";
      console.error(`[ATHENA-EXECUTE] Action '${action_type}' failed:`, execError);
    }

    // Atualiza log com resultado
    if (logId) {
      await supabase
        .from("assistant_action_log")
        .update({
          status,
          result,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    // Marca sugestão como executada se veio de uma sugestão
    if (suggestion_id && status === "success") {
      await supabase
        .from("assistant_suggestions")
        .update({ is_executed: true, executed_at: new Date().toISOString() })
        .eq("id", suggestion_id)
        .eq("user_id", user.id);
    }

    if (status === "failed") {
      return new Response(
        JSON.stringify({ error: errorMessage, status }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, status, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ATHENA-EXECUTE] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
