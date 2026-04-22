// supabase/functions/athena-proactive-scan/index.ts
// Athena Proactive Engine — varre pendências e grava sugestões
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SuggestionCategory = "agenda" | "legal" | "medical" | "document" | "alert" | "followup";
type SuggestionPriority = "high" | "medium" | "low";

interface SuggestionInsert {
  office_id: string;
  user_id: string;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  title: string;
  description: string;
  action_type: string | null;
  action_payload: Record<string, unknown>;
  entity_type: string | null;
  entity_id: string | null;
  expires_at: string;
}

function getAuthBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  return auth.replace(/^Bearer\s+/i, "").trim();
}

function expiresIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Busca office_id do usuário
    const { data: profile } = await supabase
      .from("profiles")
      .select("office_id")
      .eq("id", user.id)
      .maybeSingle();

    const officeId = profile?.office_id;
    if (!officeId) {
      return new Response(
        JSON.stringify({ suggestions: [], message: "Sem office vinculado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const suggestions: SuggestionInsert[] = [];
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const threeDaysStr = new Date(now.getTime() + 3 * 86400000).toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

    // ═══════════════════════════════════════════════════
    // 1. AGENDA MÉDICA — consultas de amanhã sem lembrete
    // ═══════════════════════════════════════════════════
    try {
      const { data: apptsTomorrow } = await supabase
        .from("agenda_medica")
        .select("id, paciente_id, horario, pacientes(nome)")
        .eq("office_id", officeId)
        .gte("horario", `${tomorrowStr}T00:00:00`)
        .lte("horario", `${tomorrowStr}T23:59:59`)
        .neq("status", "cancelado");

      if (apptsTomorrow && apptsTomorrow.length > 0) {
        suggestions.push({
          office_id: officeId,
          user_id: user.id,
          category: "agenda",
          priority: "medium",
          title: `${apptsTomorrow.length} consulta${apptsTomorrow.length > 1 ? "s" : ""} amanhã`,
          description: `Você tem ${apptsTomorrow.length} consulta${apptsTomorrow.length > 1 ? "s" : ""} agendada${apptsTomorrow.length > 1 ? "s" : ""} para amanhã. Deseja enviar lembretes aos pacientes?`,
          action_type: "send_appointment_reminders",
          action_payload: { appointment_ids: apptsTomorrow.map((a: any) => a.id), date: tomorrowStr },
          entity_type: "agenda_medica",
          entity_id: null,
          expires_at: expiresIn(2),
        });
      }
    } catch (e) {
      console.error("[ATHENA-SCAN] Agenda error:", e);
    }

    // ═══════════════════════════════════════════════════
    // 2. PACIENTES — sem consulta há +30 dias
    // ═══════════════════════════════════════════════════
    try {
      const { data: pacientesAtivos } = await supabase
        .from("pacientes")
        .select("id, nome")
        .eq("office_id", officeId)
        .limit(200);

      if (pacientesAtivos && pacientesAtivos.length > 0) {
        const pacienteIds = pacientesAtivos.map((p: any) => p.id);

        const { data: recentAppointments } = await supabase
          .from("agenda_medica")
          .select("paciente_id")
          .in("paciente_id", pacienteIds)
          .gte("horario", thirtyDaysAgo)
          .neq("status", "cancelado");

        const recentIds = new Set((recentAppointments || []).map((a: any) => a.paciente_id));
        const semRetorno = pacientesAtivos.filter((p: any) => !recentIds.has(p.id));

        if (semRetorno.length > 0) {
          suggestions.push({
            office_id: officeId,
            user_id: user.id,
            category: "medical",
            priority: "low",
            title: `${semRetorno.length} paciente${semRetorno.length > 1 ? "s" : ""} sem retorno`,
            description: `${semRetorno.length} paciente${semRetorno.length > 1 ? "s" : ""} não retornam há mais de 30 dias. Deseja que eu agende um contato de follow-up?`,
            action_type: "send_followup",
            action_payload: { patient_ids: semRetorno.slice(0, 10).map((p: any) => p.id) },
            entity_type: "pacientes",
            entity_id: null,
            expires_at: expiresIn(7),
          });
        }
      }
    } catch (e) {
      console.error("[ATHENA-SCAN] Pacientes sem retorno error:", e);
    }

    // ═══════════════════════════════════════════════════
    // 3. CASOS JURÍDICOS — prazos nos próximos 3 dias
    // ═══════════════════════════════════════════════════
    try {
      const { data: casesWithDeadline } = await supabase
        .from("cases")
        .select("id, title, deadline, area, status")
        .eq("office_id", officeId)
        .not("deadline", "is", null)
        .lte("deadline", threeDaysStr)
        .gte("deadline", now.toISOString().split("T")[0])
        .neq("status", "ENCERRADO")
        .order("deadline", { ascending: true });

      if (casesWithDeadline && casesWithDeadline.length > 0) {
        const urgent = casesWithDeadline.filter((c: any) => c.deadline === now.toISOString().split("T")[0] || c.deadline === tomorrowStr);
        const priority: SuggestionPriority = urgent.length > 0 ? "high" : "medium";
        const firstCase = casesWithDeadline[0];

        suggestions.push({
          office_id: officeId,
          user_id: user.id,
          category: "legal",
          priority,
          title: `${casesWithDeadline.length} prazo${casesWithDeadline.length > 1 ? "s" : ""} jurídico${casesWithDeadline.length > 1 ? "s" : ""} se aproximando`,
          description: `${casesWithDeadline.length === 1
            ? `O caso "${firstCase.title}" vence em ${firstCase.deadline}. Deseja revisar agora?`
            : `${casesWithDeadline.length} casos têm prazos nos próximos 3 dias. O mais urgente: "${firstCase.title}" (${firstCase.deadline}).`}`,
          action_type: "review_case",
          action_payload: { case_ids: casesWithDeadline.map((c: any) => c.id) },
          entity_type: "cases",
          entity_id: firstCase.id,
          expires_at: expiresIn(3),
        });
      }
    } catch (e) {
      console.error("[ATHENA-SCAN] Cases deadline error:", e);
    }

    // ═══════════════════════════════════════════════════
    // 4. LAUDOS MÉDICOS — não enviados há +2 dias
    // ═══════════════════════════════════════════════════
    try {
      const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
      const { data: pendingReports } = await supabase
        .from("medical_reports")
        .select("id, title, created_at, paciente_id")
        .eq("office_id", officeId)
        .eq("status", "draft")
        .lte("created_at", twoDaysAgo)
        .limit(20);

      if (pendingReports && pendingReports.length > 0) {
        suggestions.push({
          office_id: officeId,
          user_id: user.id,
          category: "document",
          priority: "medium",
          title: `${pendingReports.length} laudo${pendingReports.length > 1 ? "s" : ""} não enviado${pendingReports.length > 1 ? "s" : ""}`,
          description: `Você tem ${pendingReports.length} laudo${pendingReports.length > 1 ? "s" : ""} em rascunho há mais de 2 dias. Deseja revisar e enviar?`,
          action_type: "review_reports",
          action_payload: { report_ids: pendingReports.map((r: any) => r.id) },
          entity_type: "medical_reports",
          entity_id: null,
          expires_at: expiresIn(5),
        });
      }
    } catch (e) {
      console.error("[ATHENA-SCAN] Medical reports error:", e);
    }

    // ═══════════════════════════════════════════════════
    // 5. ASSINATURAS — documentos pendentes (ZapSign)
    // ═══════════════════════════════════════════════════
    try {
      const { data: pendingSignatures } = await supabase
        .from("documents")
        .select("id, name, case_id, created_at")
        .eq("office_id", officeId)
        .eq("signature_status", "pending")
        .limit(10);

      if (pendingSignatures && pendingSignatures.length > 0) {
        suggestions.push({
          office_id: officeId,
          user_id: user.id,
          category: "document",
          priority: "medium",
          title: `${pendingSignatures.length} documento${pendingSignatures.length > 1 ? "s" : ""} aguardando assinatura`,
          description: `${pendingSignatures.length} documento${pendingSignatures.length > 1 ? "s" : ""} pendente${pendingSignatures.length > 1 ? "s" : ""} de assinatura. Deseja cobrar a assinatura agora?`,
          action_type: "request_signature",
          action_payload: { document_ids: pendingSignatures.map((d: any) => d.id) },
          entity_type: "documents",
          entity_id: null,
          expires_at: expiresIn(5),
        });
      }
    } catch (e) {
      console.error("[ATHENA-SCAN] Signatures error:", e);
    }

    // ═══════════════════════════════════════════════════
    // 6. MONITORAMENTO — mensagens com falha
    // ═══════════════════════════════════════════════════
    try {
      const oneDayAgo = new Date(now.getTime() - 86400000).toISOString();
      const { data: failedNotifications } = await supabase
        .from("notifications_log")
        .select("id, recipient, error_message, created_at")
        .eq("office_id", officeId)
        .eq("status", "failed")
        .gte("created_at", oneDayAgo)
        .limit(20);

      if (failedNotifications && failedNotifications.length > 0) {
        suggestions.push({
          office_id: officeId,
          user_id: user.id,
          category: "alert",
          priority: "high",
          title: `⚠️ ${failedNotifications.length} falha${failedNotifications.length > 1 ? "s" : ""} de envio detectada${failedNotifications.length > 1 ? "s" : ""}`,
          description: `${failedNotifications.length} mensagem${failedNotifications.length > 1 ? "ns" : ""} não foram entregues nas últimas 24h. Deseja reprocessar?`,
          action_type: "reprocess_failed_notifications",
          action_payload: { notification_ids: failedNotifications.map((n: any) => n.id) },
          entity_type: "notifications_log",
          entity_id: null,
          expires_at: expiresIn(2),
        });
      }
    } catch (e) {
      console.error("[ATHENA-SCAN] Notifications error:", e);
    }

    // ═══════════════════════════════════════════════════
    // 7. ESCAVADOR — Clientes ativos sem processos vinculados
    // ═══════════════════════════════════════════════════
    try {
      // Busca clientes criados recentemente (últimos 7 dias) que não tenham processos vinculados
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      const { data: recentClients } = await supabase
        .from("clients")
        .select("id, full_name, document_id")
        .eq("office_id", officeId)
        .gte("created_at", sevenDaysAgo)
        .limit(10);

      if (recentClients && recentClients.length > 0) {
        for (const client of recentClients) {
          const { count } = await supabase
            .from("client_processes")
            .select("*", { count: "exact", head: true })
            .eq("client_id", client.id);

          if (count === 0) {
            suggestions.push({
              office_id: officeId,
              user_id: user.id,
              category: "legal",
              priority: "medium",
              title: `Consultar processos: ${client.full_name}`,
              description: `Este cliente foi cadastrado recentemente mas não possui processos vinculados. Deseja realizar uma busca automática no Escavador?`,
              action_type: "search_escavador_for_client",
              action_payload: { client_id: client.id, query: client.document_id || client.full_name },
              entity_type: "clients",
              entity_id: client.id,
              expires_at: expiresIn(5),
            });
          }
        }
      }
    } catch (e) {
      console.error("[ATHENA-SCAN] Escavador suggestions error:", e);
    }

    // ═══════════════════════════════════════════════════
    // Persiste sugestões (upsert para evitar duplicatas)
    // ═══════════════════════════════════════════════════
    if (suggestions.length > 0) {
      // Remove sugestões expiradas do mesmo office/user antes de inserir novas
      await supabase
        .from("assistant_suggestions")
        .delete()
        .eq("office_id", officeId)
        .eq("user_id", user.id)
        .lt("expires_at", now.toISOString());

      // Remove sugestões do mesmo tipo para evitar duplicatas desta sessão
      const categories = [...new Set(suggestions.map((s) => s.category))];
      await supabase
        .from("assistant_suggestions")
        .delete()
        .eq("office_id", officeId)
        .eq("user_id", user.id)
        .in("category", categories)
        .eq("is_dismissed", false);

      const { error: insertError } = await supabase
        .from("assistant_suggestions")
        .insert(suggestions);

      if (insertError) {
        console.error("[ATHENA-SCAN] Insert suggestions error:", insertError);
      }
    }

    // Carrega sugestões ativas para retornar ao frontend
    const { data: activeSuggestions } = await supabase
      .from("assistant_suggestions")
      .select("*")
      .eq("office_id", officeId)
      .eq("user_id", user.id)
      .eq("is_dismissed", false)
      .eq("is_executed", false)
      .gt("expires_at", now.toISOString())
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(5);

    console.log(`[ATHENA-SCAN] Scan complete. ${suggestions.length} new, ${activeSuggestions?.length ?? 0} active suggestions.`);

    return new Response(
      JSON.stringify({
        suggestions: activeSuggestions || [],
        scanned_at: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ATHENA-SCAN] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
