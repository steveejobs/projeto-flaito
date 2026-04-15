import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAndAuthorize, logAuditEvent } from "../_shared/auth.ts";
import { resilientFetch } from "../_shared/external-adapter.ts";
import { resolveBillingClient, logBillingUsage } from "../_shared/billing-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePaymentRequest {
  customer_local_id: string;
  value: number;
  due_date: string;
  description?: string;
  billing_type: "BOLETO" | "PIX" | "CREDIT_CARD";
  case_id?: string;
  client_id?: string;
  office_id: string;
  plan_id?: string;
}

interface AsaasPaymentResponse {
  id: string;
  dateCreated: string;
  customer: string;
  value: number;
  netValue: number;
  billingType: string;
  status: string;
  dueDate: string;
  description: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  pixTransaction?: {
    payload: string;
    encodedImage: string;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = crypto.randomUUID();

  try {
    const payload: CreatePaymentRequest = await req.json();
    console.log(`[asaas.create_payment] [${traceId}] Received request for office: ${payload.office_id}`);

    if (!payload.customer_local_id || !payload.value || !payload.due_date || !payload.billing_type || !payload.office_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields", code: "MISSING_FIELDS", trace_id: traceId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================
    // SECURITY GATE: Authenticate + Authorize
    // ==========================================
    const authResult = await authenticateAndAuthorize(req, "billing:generate", payload.office_id);

    if (!authResult.ok) {
      return new Response(
        JSON.stringify({ success: false, error: authResult.error, code: authResult.code, trace_id: traceId }),
        { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user, adminClient } = authResult;

    // --- Resolve API Client (Multi-tenant config-aware) ---
    let billingClient;
    try {
      billingClient = await resolveBillingClient(adminClient, payload.office_id, "office_operational");
    } catch (err: any) {
      console.error(`[asaas.create_payment] [${traceId}] Resolver error:`, err.message);
      
      await logBillingUsage(adminClient, {
        officeId: payload.office_id,
        context: "office_operational",
        operation: "create_payment",
        status: "DENIED",
        functionName: "asaas-create-payment",
        metadata: { error: err.message, trace_id: traceId }
      });

      return new Response(
        JSON.stringify({ 
          error: "Faturamento não configurado para este escritório", 
          code: "BILL_NOT_CONFIGURED", 
          details: err.message,
          trace_id: traceId 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ASAAS_API_KEY = billingClient.apiKey;
    const ASAAS_BASE_URL = billingClient.baseUrl;

    if (!ASAAS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Asaas API key not configured", code: "API_KEY_MISSING", trace_id: traceId }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: customerData, error: customerError } = await adminClient
      .from("asaas_customers")
      .select("asaas_customer_id")
      .eq("id", payload.customer_local_id)
      .eq("office_id", payload.office_id)
      .single();

    if (customerError || !customerData?.asaas_customer_id) {
      return new Response(
        JSON.stringify({ error: "Customer not synced with Asaas", code: "CUSTOMER_NOT_FOUND", trace_id: traceId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const asaasPayload = {
      customer: customerData.asaas_customer_id,
      billingType: payload.billing_type,
      value: payload.value,
      dueDate: payload.due_date,
      description: payload.description || "Pagamento de serviços jurídicos",
    };

    // ── Resilient Call to Asaas ──────────────────────────────────
    try {
      const asaasResponse = await resilientFetch(`${ASAAS_BASE_URL}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY,
          "Idempotency-Key": traceId // SRE: Idempotency protection for finance
        },
        body: JSON.stringify(asaasPayload),
        serviceName: "asaas",
        correlationId: traceId,
        timeoutMs: 20000, 
        isIdempotent: true // Seguro devido à Idempotency-Key
      });

      const asaasData: AsaasPaymentResponse = await asaasResponse.json();

      if (!asaasResponse.ok) {
        await logAuditEvent(adminClient, {
          event_type: "external_integration",
          actor_user_id: user.uid,
          office_id: payload.office_id,
          resource_type: "charge",
          action: "asaas.create_payment",
          status: "ERROR",
          metadata_json: { error: asaasData, asaas_customer_id: customerData.asaas_customer_id }
        });
        return new Response(
          JSON.stringify({ error: "Failed to create payment in Asaas", details: asaasData, trace_id: traceId }),
          { status: asaasResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const paymentRecord = {
        office_id: payload.office_id,
        customer_local_id: payload.customer_local_id,
        client_id: payload.client_id || null,
        case_id: payload.case_id || null,
        asaas_payment_id: asaasData.id,
        billing_type: payload.billing_type,
        value: payload.value,
        due_date: payload.due_date,
        description: payload.description || null,
        status: asaasData.status.toLowerCase() as any,
        invoice_url: asaasData.invoiceUrl || null,
        boleto_url: asaasData.bankSlipUrl || null,
        pix_payload: asaasData.pixTransaction?.payload || null,
        pix_qr_code_base64: asaasData.pixTransaction?.encodedImage || null,
        plan_id: payload.plan_id || null,
      };

      const { data: savedPayment, error: saveError } = await adminClient
        .from("asaas_payments")
        .insert(paymentRecord)
        .select()
        .single();

      if (saveError) {
        return new Response(
          JSON.stringify({ success: true, warning: "Payment created but failed to save locally", asaas_payment: asaasData, trace_id: traceId }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await logAuditEvent(adminClient, {
        event_type: "external_integration",
        actor_user_id: user.uid,
        office_id: payload.office_id,
        resource_type: "charge",
        action: "asaas.create_payment",
        status: "SUCCESS",
        metadata_json: { asaas_payment_id: asaasData.id, payment_id: savedPayment.id }
      });

      return new Response(
        JSON.stringify({ success: true, payment: savedPayment, asaas_payment_id: asaasData.id, trace_id: traceId }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (err: any) {
      // ── SRE: Handling Timeouts/Network failures with Consistency ──
      console.error(`[asaas.create_payment] [${traceId}] Terminal failure:`, err.message);

      // Se for timeout ou falha de rede fatal após retries, marcamos como pendente de confirmação externa
      // para que um webhook futuro ou job de reconciliação possa resolver sem duplicar cobrança.
      await logAuditEvent(adminClient, {
        event_type: "external_integration",
        actor_user_id: user.uid,
        office_id: payload.office_id,
        resource_type: "charge",
        action: "asaas.create_payment",
        status: "ERROR",
        metadata_json: { 
            error: err.message, 
            consistency_state: "PENDING_EXTERNAL_CONFIRMATION",
            idempotency_key: traceId 
        }
      });

      return new Response(
        JSON.stringify({ 
            success: false, 
            error: "Service temporarily unavailable. Payment might be in processing.", 
            code: "PENDING_EXTERNAL_CONFIRMATION",
            trace_id: traceId 
        }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: unknown) {
    console.error(`[asaas.create_payment] [${traceId}] Global error:`, error);
    return new Response(
      JSON.stringify({ error: "Internal server error", code: "INTERNAL_ERROR", trace_id: traceId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
