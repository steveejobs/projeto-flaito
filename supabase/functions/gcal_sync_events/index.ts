/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: Json, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function pickMeetingUrl(e: Record<string, unknown>): string | null {
  const candidates: string[] = [];
  if (typeof e?.hangoutLink === "string") candidates.push(e.hangoutLink);
  if (typeof e?.location === "string") candidates.push(e.location);
  if (typeof e?.htmlLink === "string") candidates.push(e.htmlLink);

  const desc = typeof e?.description === "string" ? e.description : "";
  const urlRegex = /(https?:\/\/[^\s)>\]]+)/gi;
  const matches = desc.match(urlRegex) || [];
  for (const m of matches) candidates.push(m);

  const priority = candidates.find((u) =>
    /meet\.google\.com\/|teams\.microsoft\.com\/|zoom\.us\/|webex\.com\//i.test(u),
  );
  return (priority || candidates[0] || null)?.trim() || null;
}

function providerFromUrl(url: string | null): string | null {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("meet.google.com/")) return "MEET";
  if (u.includes("teams.microsoft.com/") || u.includes("join.microsoft.com/")) return "TEAMS";
  if (u.includes("zoom.us/")) return "ZOOM";
  if (u.includes("webex.com/")) return "WEBEX";
  return "OUTRO";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return json({ error: "missing_env", needs: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] }, 500);
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
      return json({ error: "missing_google_secrets", message: "Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nos secrets do Supabase" }, 500);
    }

    // Auth do usuário (JWT do Supabase)
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!jwt) {
      console.log("No JWT token provided");
      return json({ error: "not_authenticated" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const office_id = body?.office_id as string | undefined;
    const calendar_id = (body?.calendar_id as string | undefined) || "primary";

    console.log("Sync request for office_id:", office_id, "calendar_id:", calendar_id);

    if (!office_id) return json({ error: "missing_office_id" }, 400);

    // intervalo padrão: -7 dias .. +60 dias
    const now = new Date();
    const from = body?.from ? new Date(body.from) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const to = body?.to ? new Date(body.to) : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    // Descobrir user_id do JWT
    const { data: authData, error: authErr } = await supa.auth.getUser(jwt);
    if (authErr || !authData?.user?.id) {
      console.error("Auth failed:", authErr?.message);
      return json({ error: "auth_failed", details: authErr?.message }, 401);
    }
    const user_id = authData.user.id;
    console.log("User authenticated:", user_id);

    // Carregar conexão
    const { data: conn, error: connErr } = await supa
      .from("google_calendar_connections")
      .select("id, calendar_id, access_token, refresh_token, token_expires_at, scopes")
      .eq("user_id", user_id)
      .eq("office_id", office_id)
      .eq("calendar_id", calendar_id)
      .maybeSingle();

    if (connErr) {
      console.error("Connection query failed:", connErr.message);
      return json({ error: "conn_query_failed", details: connErr.message }, 500);
    }
    if (!conn?.refresh_token) {
      console.log("No Google connection found or missing refresh_token");
      return json({ error: "google_not_connected_or_missing_refresh_token" }, 400);
    }

    console.log("Found Google connection, exchanging refresh token");

    // Trocar refresh_token por access_token
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: conn.refresh_token,
      }),
    });

    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok || !tokenJson?.access_token) {
      console.error("Google token exchange failed:", tokenJson);
      return json({ error: "google_token_exchange_failed", details: tokenJson }, 502);
    }

    const accessToken = tokenJson.access_token as string;
    const expiresIn = Number(tokenJson.expires_in || 0);
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    console.log("Token exchanged successfully, fetching calendar events");

    // Persistir access_token atualizado
    await supa.rpc("upsert_google_calendar_connection", {
      p_office_id: office_id,
      p_calendar_id: calendar_id,
      p_scopes: conn.scopes || ["https://www.googleapis.com/auth/calendar.events"],
      p_access_token: accessToken,
      p_refresh_token: null,
      p_token_expires_at: expiresAt,
    });

    // Buscar eventos
    const timeMin = from.toISOString();
    const timeMax = to.toISOString();

    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin,
      timeMax,
      maxResults: "2500",
    });

    const eventsResp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar_id)}/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const eventsJson = await eventsResp.json();
    if (!eventsResp.ok) {
      console.error("Google events list failed:", eventsJson);
      return json({ error: "google_events_list_failed", details: eventsJson }, 502);
    }

    const items = Array.isArray(eventsJson?.items) ? eventsJson.items : [];
    console.log("Received", items.length, "events from Google Calendar");

    // Montar payloads para upsert
    const rows = items
      .filter((e: Record<string, unknown>) => !!e?.id && (e?.status !== "cancelled"))
      .map((e: Record<string, unknown>) => {
        const start = e?.start as Record<string, unknown> | undefined;
        const end = e?.end as Record<string, unknown> | undefined;
        
        const startDT = start?.dateTime as string | null || null;
        const endDT = end?.dateTime as string | null || null;
        const startDate = start?.date as string | null || null;

        const all_day = !!startDate && !startDT;

        const meeting_url = pickMeetingUrl(e);
        const meeting_provider = providerFromUrl(meeting_url);

        const row: Record<string, unknown> = {
          office_id,
          external_source: "GCAL",
          external_event_id: String(e.id),
          raw_payload: e,

          title: e.summary || "(Sem título)",
          notes: e.description || null,
          location: e.location || null,

          all_day,
          meeting_url,
          meeting_provider,

          status: "PENDENTE",
          kind: "AUDIENCIA",

          date: all_day ? startDate : null,
          time: null,

          start_at: all_day ? null : (startDT ? new Date(startDT).toISOString() : null),
          end_at: all_day ? null : (endDT ? new Date(endDT).toISOString() : null),
        };

        return row;
      });

    if (rows.length === 0) {
      console.log("No events to sync");
      return json({ ok: true, imported: 0, updated: 0, skipped: 0, window: { from: timeMin, to: timeMax } });
    }

    console.log("Upserting", rows.length, "events to agenda_items");

    const { data: upserted, error: upErr } = await supa
      .from("agenda_items")
      .upsert(rows, { onConflict: "office_id,external_source,external_event_id" })
      .select("id, external_event_id");

    if (upErr) {
      console.error("Upsert failed:", upErr.message);
      return json({ error: "upsert_failed", details: upErr.message }, 500);
    }

    const imported = upserted?.length || 0;
    console.log("Sync complete. Upserted:", imported);

    return json({
      ok: true,
      imported,
      updated: 0,
      skipped: 0,
      window: { from: timeMin, to: timeMax },
      total_received: items.length,
      total_upserted: imported,
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return json({ error: "unexpected", details: String((e as Error)?.message || e) }, 500);
  }
});
