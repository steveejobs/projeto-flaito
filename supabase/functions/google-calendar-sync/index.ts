import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let eventoAgenda: any = null;

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json();
    console.log("Recebido payload:", JSON.stringify(payload));

    // Suporta chamada via Webhook (payload.record) ou chamada direta (payload)
    eventoAgenda = payload.record || payload;

    if (!eventoAgenda || !eventoAgenda.id || !eventoAgenda.office_id || !eventoAgenda.data_hora) {
      throw new Error("Payload inválido. Dados mínimos não fornecidos.");
    }

    const agendaId = eventoAgenda.id;

    // 1. Obter o Refresh Token da Tabela Institucional
    const { data: integrationData, error: integrationErr } = await supabaseClient
      .from('office_integrations')
      .select('refresh_token, status')
      .eq('office_id', eventoAgenda.office_id)
      .eq('provider', 'google_calendar')
      .single();

    if (integrationErr || !integrationData) {
      throw new Error("Integração do Google Calendar ausente para este consultório. Conta não vinculada.");
    }

    if (integrationData.status !== 'active') {
      throw new Error(`A integração do Google Calendar está pausada ou revogada (Status: ${integrationData.status}).`);
    }

    const refreshToken = integrationData.refresh_token;

    // 2. Renovar Access Token do Google
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Tokens oauth de aplicação Google (client_id/secret) não configurados no Supabase Vault/Env.");
    }

    const tokenRefreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRefreshRes.ok) {
      throw new Error(`Google OAuth Refresh Error: ${await tokenRefreshRes.text()}`);
    }

    const { access_token } = await tokenRefreshRes.json();

    // 3. Montar Payload do Google Calendar
    // O Google exige DateTime no formato RFC3339, que a nossa `data_hora` TIMESTAMPTZ já exporta ou aproxima.
    const startTimeDate = new Date(eventoAgenda.data_hora);
    const duracaoMin = eventoAgenda.duracao_minutos || 60; // default 60 min
    const endTimeDate = new Date(startTimeDate.getTime() + duracaoMin * 60000);

    const googleEventBody = {
      summary: `Consulta Flaito: [${eventoAgenda.tipo_consulta || 'Geral'}]`,
      description: eventoAgenda.observacoes || "Agendado via Flaito Medical",
      start: {
        dateTime: startTimeDate.toISOString(),
      },
      end: {
        dateTime: endTimeDate.toISOString(),
      },
      // Podemos injetar source, metadados
    };

    // 4. Decidir entre POST (novo) ou PATCH (atualizar existente)
    const hasGoogleId = !!eventoAgenda.google_event_id;
    const httpMethod = hasGoogleId ? "PATCH" : "POST";
    const googleEndpoint = hasGoogleId
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventoAgenda.google_event_id}`
      : `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

    console.log(`Disparando [${httpMethod}] para o Google API.`);

    const googleRes = await fetch(googleEndpoint, {
      method: httpMethod,
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(googleEventBody),
    });

    if (!googleRes.ok) {
      throw new Error(`Google Calendar API Error: ${await googleRes.text()}`);
    }

    const googleData = await googleRes.json();
    const newGoogleId = googleData.id;

    // 5. Retro-Atualizar no Supabase Agenda Medica 🟢 Sucesso
    await supabaseClient
      .from("agenda_medica")
      .update({
        google_event_id: newGoogleId,
        sync_status: "synced",
        sync_last_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq("id", agendaId);

    return new Response(JSON.stringify({ success: true, googleData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Erro na Edge Function:", error);
    
    // Tratativa B: Erro 🔴 Falha
    try {
      if (eventoAgenda?.id) {
         // O fallback só roda se conseguirmos instanciar o record (via try) ou scope externo
         const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        await supabaseClient
          .from("agenda_medica")
          .update({
            sync_status: "failed",
            sync_last_at: new Date().toISOString(),
            sync_error: error.message,
          })
          .eq("id", eventoAgenda.id);
      }
    } catch (e) {
      console.error("Erro critico ao processar o fallback de falha:", e);
    }

    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
