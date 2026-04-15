import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireResourceAccess, logAudit } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(res: unknown, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
  });
}

// ============================================
// Types
// ============================================
interface ApproveRequest {
  approval_id: string;
  approved: boolean;
  rejection_reason?: string;
}

interface ChargeApproval {
  id: string;
  office_id: string;
  client_id: string;
  case_id: string | null;
  plan_id: string | null;
  value: number;
  description: string;
  billing_type: "BOLETO" | "PIX" | "CREDIT_CARD";
  due_date: string;
  status: string;
  requested_by: string | null;
}

interface BillingConfig {
  id: string;
  office_id: string;
  enabled: boolean;
  environment: "sandbox" | "production";
  auto_send_after_approval: boolean;
}

// ============================================
// Asaas API
// ============================================
async function createAsaasPayment(
  asaasBaseUrl: string,
  apiKey: string,
  params: {
    customer: string;
    billingType: string;
    value: number;
    dueDate: string;
    description: string;
    externalReference?: string;
  }
): Promise<{ success: boolean; data?: unknown; error?: string; status?: number }> {
  try {
    const response = await fetch(`${asaasBaseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": apiKey,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data?.errors?.[0]?.description || data?.message || "Erro ao criar pagamento no Asaas",
        status: response.status,
      };
    }

    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Erro de conexão com Asaas",
    };
  }
}

// ============================================
// Main Handler
// ============================================
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const body = await req.json() as ApproveRequest;

    if (!body.approval_id || typeof body.approved !== "boolean") {
      return json({ error: "Missing required fields: approval_id, approved", code: "MISSING_FIELDS" }, 400);
    }

    if (!body.approved && !body.rejection_reason) {
      return json({ error: "rejection_reason is required when rejecting", code: "MISSING_REASON" }, 400);
    }

    // ==========================================
    // SECURITY GATE: Authenticate + Authorize (Zero Trust)
    // ==========================================
    const authResult = await requireResourceAccess(req, {
      resourceType: 'charge_approvals',
      resourceId: body.approval_id,
      minRole: 'ADMIN' // Apenas admins podem aprovar faturamento
    });

    if (!authResult.ok) {
      return authResult.response;
    }

    const { user, membership, adminClient } = authResult;
    const traceId = crypto.randomUUID();

    // --- 2. Re-fetch full approval record (initial lookup was minimal for auth gate) ---
    const { data: fullApproval, error: fullApprovalErr } = await adminClient
      .from("charge_approvals")
      .select("*")
      .eq("id", body.approval_id)
      .single();

    if (fullApprovalErr || !fullApproval) {
      return json({ error: "Solicitação de aprovação não encontrada", code: "APPROVAL_NOT_FOUND", trace_id: traceId }, 404);
    }

    const chargeApproval = fullApproval as ChargeApproval;

    // --- 3. Validate status ---
    if (chargeApproval.status !== "PENDING") {
      return json({
        success: false,
        error: `Solicitação já foi processada (status: ${chargeApproval.status})`,
        code: "ALREADY_PROCESSED",
        trace_id: traceId,
      }, 409);
    }

    // --- 3. Handle rejection ---
    if (!body.approved) {
      const { error: updateErr } = await adminClient
        .from("charge_approvals")
        .update({
          status: "REJECTED",
          rejection_reason: body.rejection_reason,
          approved_by: user.uid,
          approved_at: new Date().toISOString(),
        })
        .eq("id", body.approval_id);

      if (updateErr) {
        console.error(`[${traceId}] Error updating approval:`, updateErr);
        return json({ success: false, error: "Erro ao atualizar solicitação", code: "UPDATE_ERROR", trace_id: traceId }, 500);
      }

      await logAudit(adminClient, {
        office_id: chargeApproval.office_id,
        user_id: user.uid,
        action: "billing.reject",
        status: "SUCCESS",
        details: { approval_id: body.approval_id, reason: body.rejection_reason },
        trace_id: traceId,
      });

      return json({
        success: true,
        status: "REJECTED",
        approval_id: body.approval_id,
        trace_id: traceId,
      });
    }

    // --- 4. Handle approval ---
    const { error: approveUpdateErr } = await adminClient
      .from("charge_approvals")
      .update({
        status: "APPROVED",
        approved_by: user.uid,
        approved_at: new Date().toISOString(),
      })
      .eq("id", body.approval_id);

    if (approveUpdateErr) {
      console.error(`[${traceId}] Error approving:`, approveUpdateErr);
      return json({ success: false, error: "Erro ao aprovar solicitação", code: "APPROVE_ERROR", trace_id: traceId }, 500);
    }

    // --- 5. Fetch billing config to check auto_send ---
    const { data: config, error: configErr } = await adminClient
      .from("billing_configs")
      .select("*")
      .eq("office_id", chargeApproval.office_id)
      .single();

    if (configErr || !config) {
      console.warn(`[${traceId}] Billing config not found, approval saved but not sent to Asaas`);
      await logAudit(adminClient, {
        office_id: chargeApproval.office_id,
        user_id: user.uid,
        action: "billing.approve",
        status: "SUCCESS",
        details: { approval_id: body.approval_id, auto_sent: false, warning: "config_not_found" },
        trace_id: traceId,
      });
      return json({
        success: true,
        status: "APPROVED",
        approval_id: body.approval_id,
        auto_sent: false,
        warning: "Configuração de cobrança não encontrada. Envio manual necessário.",
        trace_id: traceId,
      });
    }

    const billingConfig = config as BillingConfig;

    // --- 6. If auto_send_after_approval, create payment in Asaas ---
    if (!billingConfig.auto_send_after_approval) {
      await logAudit(adminClient, {
        office_id: chargeApproval.office_id,
        user_id: user.uid,
        action: "billing.approve",
        status: "SUCCESS",
        details: { approval_id: body.approval_id, auto_sent: false },
        trace_id: traceId,
      });
      return json({
        success: true,
        status: "APPROVED",
        approval_id: body.approval_id,
        auto_sent: false,
        message: "Cobrança aprovada. Envio manual necessário.",
        trace_id: traceId,
      });
    }

    if (!billingConfig.enabled) {
      await logAudit(adminClient, {
        office_id: chargeApproval.office_id,
        user_id: user.uid,
        action: "billing.approve",
        status: "SUCCESS",
        details: { approval_id: body.approval_id, auto_sent: false, warning: "integration_disabled" },
        trace_id: traceId,
      });
      return json({
        success: true,
        status: "APPROVED",
        approval_id: body.approval_id,
        auto_sent: false,
        warning: "Integração Asaas desabilitada. Cobrança aprovada mas não enviada.",
        trace_id: traceId,
      });
    }

    // --- 7. Get API key ---
    const envKey = billingConfig.environment === "production" ? "ASAAS_API_KEY_PRODUCTION" : "ASAAS_API_KEY";
    const apiKey = Deno.env.get(envKey) || Deno.env.get("ASAAS_API_KEY");

    if (!apiKey) {
      console.error(`[${traceId}] API key missing for auto-send`);
      return json({
        success: true,
        status: "APPROVED",
        approval_id: body.approval_id,
        auto_sent: false,
        error: "API key do Asaas não configurada. Envio manual necessário.",
        trace_id: traceId,
      }, 200);
    }

    // --- 8. Fetch customer ---
    const { data: customer, error: customerErr } = await adminClient
      .from("asaas_customers")
      .select("asaas_customer_id")
      .eq("id", chargeApproval.client_id)
      .eq("office_id", chargeApproval.office_id)
      .maybeSingle();

    if (customerErr || !customer?.asaas_customer_id) {
      console.error(`[${traceId}] Customer not synced with Asaas`);
      return json({
        success: true,
        status: "APPROVED",
        approval_id: body.approval_id,
        auto_sent: false,
        error: "Cliente não sincronizado com Asaas. Envio manual necessário.",
        trace_id: traceId,
      }, 200);
    }

    // --- 9. Create payment in Asaas ---
    const asaasBaseUrl = billingConfig.environment === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    const asaasResult = await createAsaasPayment(asaasBaseUrl, apiKey, {
      customer: customer.asaas_customer_id,
      billingType: chargeApproval.billing_type,
      value: chargeApproval.value,
      dueDate: chargeApproval.due_date,
      description: chargeApproval.description,
      externalReference: chargeApproval.case_id || chargeApproval.client_id,
    });

    if (!asaasResult.success) {
      console.error(`[${traceId}] Asaas API error:`, asaasResult.error);
      await logAudit(adminClient, {
        office_id: chargeApproval.office_id,
        user_id: user.uid,
        action: "billing.approve_send",
        status: "ERROR",
        details: { approval_id: body.approval_id, error: asaasResult.error },
        trace_id: traceId,
      });
      return json({
        success: true,
        status: "APPROVED",
        approval_id: body.approval_id,
        auto_sent: false,
        error: "Cobrança aprovada mas falha ao enviar para Asaas",
        details: asaasResult.error,
        trace_id: traceId,
      }, 200);
    }

    const asaasData = asaasResult.data as Record<string, unknown>;

    // --- 10. Save payment locally ---
    const { data: savedPayment, error: saveErr } = await adminClient
      .from("asaas_payments")
      .insert({
        office_id: chargeApproval.office_id,
        customer_local_id: chargeApproval.client_id,
        client_id: chargeApproval.client_id,
        case_id: chargeApproval.case_id || null,
        asaas_payment_id: asaasData.id,
        billing_type: chargeApproval.billing_type,
        value: chargeApproval.value,
        due_date: chargeApproval.due_date,
        description: chargeApproval.description,
        status: String(asaasData.status || "pending").toLowerCase(),
        invoice_url: asaasData.invoiceUrl || null,
        boleto_url: asaasData.bankSlipUrl || null,
        pix_payload: (asaasData.pixTransaction as Record<string, unknown> | undefined)?.payload || null,
        pix_qr_code_base64: (asaasData.pixTransaction as Record<string, unknown> | undefined)?.encodedImage || null,
        approval_id: body.approval_id,
      })
      .select()
      .single();

    // --- 11. Update approval status ---
    const { error: finalUpdateErr } = await adminClient
      .from("charge_approvals")
      .update({
        status: "SENT_TO_ASAAS",
        asaas_payment_id: asaasData.id,
      })
      .eq("id", body.approval_id);

    if (finalUpdateErr) {
      console.error(`[${traceId}] Error updating final approval status:`, finalUpdateErr);
    }

    await logAudit(adminClient, {
      office_id: chargeApproval.office_id,
      user_id: user.uid,
      action: "billing.approve_send",
      status: "SUCCESS",
      details: { approval_id: body.approval_id, asaas_payment_id: asaasData.id, value: chargeApproval.value },
      trace_id: traceId,
    });

    return json({
      success: true,
      status: "SENT_TO_ASAAS",
      approval_id: body.approval_id,
      auto_sent: true,
      payment: savedPayment,
      asaas_payment_id: asaasData.id,
      invoice_url: asaasData.invoiceUrl,
      trace_id: traceId,
    }, 201);

  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("[billing-approve] Fatal error:", errorMsg);
    return json({ success: false, error: "Erro interno ao processar aprovação", details: errorMsg, code: "INTERNAL_ERROR" }, 500);
  }
});
