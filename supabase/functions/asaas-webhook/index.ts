// supabase/functions/asaas-webhook/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function json(res: unknown, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function getEnv(name: string, optional = false) {
  const v = Deno.env.get(name);
  if (!v && !optional) throw new Error(`Missing env: ${name}`);
  return v || "";
}

function mapEventToStatus(ev: string) {
  switch (ev) {
    case "PAYMENT_CONFIRMED": return "CONFIRMED";
    case "PAYMENT_RECEIVED": return "RECEIVED";
    case "PAYMENT_OVERDUE": return "OVERDUE";
    case "PAYMENT_REFUNDED":
    case "PAYMENT_PARTIALLY_REFUNDED": return "REFUNDED";
    case "PAYMENT_DELETED": return "CANCELED";
    case "PAYMENT_CREATED":
    case "PAYMENT_UPDATED":
    case "PAYMENT_RESTORED":
    case "PAYMENT_AUTHORIZED":
    case "PAYMENT_APPROVED_BY_RISK_ANALYSIS":
    case "PAYMENT_AWAITING_RISK_ANALYSIS":
      return "PENDING";
    default:
      return "ERROR";
  }
}

serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ ok: false }, 405);

    const expectedToken = getEnv("ASAAS_WEBHOOK_TOKEN", true).trim();
    if (expectedToken) {
      const got = (req.headers.get("asaas-access-token") || "").trim();
      if (!got || got !== expectedToken) {
        return json({ ok: false, error: "Unauthorized" }, 401);
      }
    }

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const payload = await req.json();
    const asaas_event_id = String(payload?.id || crypto.randomUUID());
    const event_type = String(payload?.event || "UNKNOWN");
    const asaas_payment_id = String(payload?.payment?.id || "");

    const { data: exists } = await supabase
      .from("asaas_webhook_events")
      .select("id")
      .eq("asaas_event_id", asaas_event_id)
      .maybeSingle();

    if (!exists) {
      await supabase.from("asaas_webhook_events").insert({
        asaas_event_id,
        event_type,
        asaas_payment_id: asaas_payment_id || null,
        payload,
      });
    }

    if (asaas_payment_id) {
      const status = mapEventToStatus(event_type);
      const { data: p } = await supabase
        .from("asaas_payments")
        .select("id, paid_at")
        .eq("asaas_payment_id", asaas_payment_id)
        .maybeSingle();

      if (p?.id) {
        const paid =
          (event_type === "PAYMENT_CONFIRMED" || event_type === "PAYMENT_RECEIVED") &&
          !p.paid_at;

        await supabase
          .from("asaas_payments")
          .update({
            status,
            paid_at: paid ? new Date().toISOString() : p.paid_at,
          })
          .eq("id", p.id);
      }
    }

    return json({ ok: true });
  } catch (e) {
    return json({ ok: true });
  }
});
