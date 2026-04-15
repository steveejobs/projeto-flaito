// supabase/functions/asaas-webhook/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyStaticToken } from "../_shared/webhook-security.ts";

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
  const correlationId = crypto.randomUUID();
  
  try {
    if (req.method !== "POST") return json({ ok: false }, 405);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json();
    const asaas_event_id = String(payload?.id || "");
    const event_type = String(payload?.event || "UNKNOWN");
    const asaas_payment_id = String(payload?.payment?.id || "");
    const account_id = String(payload?.account || ""); // ID da subconta ou conta própria do tenant

    if (!asaas_event_id) {
       return json({ ok: false, error: "Missing event id" }, 400);
    }

    // ============================================
    // 2. RESOLUÇÃO DE TENANT E VALIDAÇÃO DE SECRET
    // ============================================
    let resolvedOfficeId: string | null = null;
    let resolvedSecret: string | null = null;

    if (account_id) {
      // Buscar integração ativa para este account_id (campo asaas_account_id deve ser mapeado)
      // Nota: Na migração simplificada da Fase 23, o account_id ainda não foi adicionado.
      // Como migramos para billing_configs, vamos buscar por office_id via metadata se possível,
      // ou manter a lógica de account_id se o campo for adicionado.
      
      const { data: config } = await supabase
        .from("billing_configs")
        .select("office_id, asaas_webhook_secret")
        .eq("asaas_account_id", account_id)
        .eq("enabled", true)
        .maybeSingle();

      if (config) {
        resolvedOfficeId = config.office_id;
        resolvedSecret = config.asaas_webhook_secret;
      }
    }

    // Fallback: Se não resolveu via account_id, tenta o token global (para Platform Master)
    const expectedGlobalToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN")?.trim();
    const receivedToken = req.headers.get("asaas-access-token") || "";

    if (resolvedSecret) {
      // Validação específica do tenant
      if (!verifyStaticToken(receivedToken, resolvedSecret)) {
         console.error(`[asaas-webhook] Unauthorized for account ${account_id} [${correlationId}]`);
         return json({ ok: false, error: "Unauthorized tenant webhook" }, 401);
      }
    } else if (expectedGlobalToken) {
      // Validação global
      if (!verifyStaticToken(receivedToken, expectedGlobalToken)) {
         console.error(`[asaas-webhook] Unauthorized global access attempt [${correlationId}]`);
         return json({ ok: false, error: "Unauthorized global webhook" }, 401);
      }
    } else {
      // Nenhuma validação possível
      console.error(`[asaas-webhook] No security context for account ${account_id} [${correlationId}]`);
      return json({ ok: false, error: "Forbidden" }, 403);
    }

    // ============================================
    // 2. IDEMPOTENCIA ATÔMICA (Atomic DB Check)
    // ============================================
    const { error: idempotencyError } = await supabase
      .from("asaas_webhook_events")
      .insert({
        asaas_event_id,
        event_type,
        asaas_payment_id: asaas_payment_id || null,
        office_id: resolvedOfficeId, // Registrar qual escritório este evento pertence
        payload,
      });

    if (idempotencyError) {
      // 23505 = Unique Violation (Evento já processado)
      if (idempotencyError.code === "23505") {
        console.info(`[asaas-webhook] Duplicate event [${asaas_event_id}] skipped.`);
        return json({ ok: true, message: "Duplicate" });
      }
      throw idempotencyError;
    }

    // ============================================
    // 3. PROCESSAMENTO (Side Effects)
    // ============================================
    if (asaas_payment_id) {
      const status = mapEventToStatus(event_type);
      
      const { data: p, error: fetchError } = await supabase
        .from("asaas_payments")
        .select("id, paid_at, status")
        .eq("asaas_payment_id", asaas_payment_id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (p?.id) {
        // GOVERNANÇA DE ESTADO: 
        // Se já estiver pago (RECEIVED/CONFIRMED), não retroceder status
        const alreadyPaid = p.status === "CONFIRMED" || p.status === "RECEIVED" || !!p.paid_at;
        const newStatusIsPayment = status === "CONFIRMED" || status === "RECEIVED";

        // Impedir que eventos atrasados ou erráticos "des-paguem" uma fatura
        if (alreadyPaid && !newStatusIsPayment && status !== "REFUNDED") {
           console.warn(`[asaas-webhook] Prevented invalid state regression for payment ${p.id}: ${p.status} -> ${status}`);
           return json({ ok: true });
        }

        const shouldMarkerAsPaid = newStatusIsPayment && !p.paid_at;

        await supabase
          .from("asaas_payments")
          .update({
            status,
            paid_at: shouldMarkerAsPaid ? new Date().toISOString() : p.paid_at,
          })
          .eq("id", p.id);
      }
    }

    return json({ ok: true });
  } catch (e: any) {
    console.error(`[asaas-webhook] Failure [${correlationId}]:`, e.message);
    // Retornamos 200 pro provedor para evitar retries infinitos se o evento for inválido,
    // mas 400 ou 500 se quisermos que ele reenvie (opcional dependendo da política de retry da ASAAS).
    // Recomendação: 200 + log interno para webhook.
    return json({ ok: true, error: "Internal processing bypass" });
  }
});
