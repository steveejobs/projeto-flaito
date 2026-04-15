// supabase/functions/billing-generate/index.ts
// Gera cobrança no Asaas com base em configuração (billing_configs + billing_plans)
// SECURITY: JWT obrigatório + validação de membership + role check

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authenticateAndAuthorize, logAudit, requireResourceAccess } from "../_shared/auth.ts";

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
interface BillingGenerateRequest {
  office_id: string;
  client_id: string;
  case_id?: string;
  plan_id?: string;
  custom_value?: number;
  custom_description?: string;
  custom_billing_type?: "BOLETO" | "PIX" | "CREDIT_CARD";
  custom_due_days?: number;
  skip_approval?: boolean;
}

interface BillingConfig {
  id: string;
  office_id: string;
  enabled: boolean;
  environment: "sandbox" | "production";
  default_billing_type: "BOLETO" | "PIX" | "CREDIT_CARD";
  default_due_days: number;
  default_description_template: string;
  require_manual_approval: boolean;
  auto_send_after_approval: boolean;
}

interface BillingPlan {
  id: string;
  office_id: string;
  name: string;
  description: string | null;
  value: number;
  billing_type: "BOLETO" | "PIX" | "CREDIT_CARD" | null;
  due_days: number | null;
  recurrence: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
}

interface BillingRule {
  id: string;
  office_id: string;
  rule_type: "VALUE_LIMIT" | "DUE_DATE_POLICY" | "BLOCK_DUPLICATE" | "AUTO_OVERDUE_ACTION";
  config_json: Record<string, unknown>;
  active: boolean;
}

// ============================================
// Template Engine
// ============================================
function renderTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => context[key] ?? `{{${key}}}`);
}

// ============================================
// Validation
// ============================================
function validateValue(value: number, rules: BillingRule[]): { valid: boolean; error?: string } {
  const valueLimitRule = rules.find(r => r.rule_type === "VALUE_LIMIT" && r.active);
  if (valueLimitRule) {
    const { min_value, max_value } = valueLimitRule.config_json as { min_value?: number; max_value?: number };
    if (min_value !== undefined && value < min_value) {
      return { valid: false, error: `Valor abaixo do mínimo configurado (R$ ${min_value.toFixed(2)})` };
    }
    if (max_value !== undefined && value > max_value) {
      return { valid: false, error: `Valor excede limite configurado (R$ ${max_value.toFixed(2)})` };
    }
  }
  return { valid: true };
}

async function checkDuplicateCharge(
  adminClient: any,
  officeId: string,
  clientId: string,
  rules: BillingRule[]
): Promise<{ blocked: boolean; error?: string }> {
  const blockRule = rules.find(r => r.rule_type === "BLOCK_DUPLICATE" && r.active);
  if (!blockRule) return { blocked: false };

  const { data: pendingCharges } = await adminClient
    .from("asaas_payments")
    .select("id")
    .eq("office_id", officeId)
    .eq("customer_local_id", clientId)
    .in("status", ["pending", "confirmed"])
    .maybeSingle();

  if (pendingCharges) {
    return { blocked: true, error: "Cliente já possui cobrança pendente" };
  }

  return { blocked: false };
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
    const body = await req.json() as BillingGenerateRequest;

    if (!body.office_id || !body.client_id) {
      return json({ error: "Missing required fields: office_id, client_id", code: "MISSING_FIELDS" }, 400);
    }

    // ==========================================
    // SECURITY GATE: Authenticate + Authorize (Zero Trust)
    // ==========================================
    const authResult = await requireResourceAccess(req, {
      resourceType: 'clients',
      resourceId: body.client_id,
      minRole: 'MEMBER'
    });

    if (!authResult.ok) {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
        const auditClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await auditClient.from("audit_logs").insert({
          office_id: body.office_id,
          user_id: "anonymous",
          action: "billing.generate",
          status: "DENIED",
          details: { reason: authResult.code, error: authResult.error },
          trace_id: authResult.trace_id,
          created_at: new Date().toISOString(),
        });
      } catch (_) { /* audit failure should not break response */ }

      return json(
        { success: false, error: authResult.error, code: authResult.code, trace_id: authResult.trace_id },
        authResult.status
      );
    }

    const { user, membership, adminClient } = authResult;
    const traceId = crypto.randomUUID();

    // --- 1. Fetch billing config ---
    const { data: config, error: configErr } = await adminClient
      .from("billing_configs")
      .select("*")
      .eq("office_id", body.office_id)
      .single();

    if (configErr || !config) {
      return json({ success: false, error: "Configuração de cobrança não encontrada", code: "CONFIG_NOT_FOUND", trace_id: traceId }, 404);
    }

    const billingConfig = config as BillingConfig;

    // --- 2. Check if integration is enabled ---
    if (!billingConfig.enabled) {
      return json({
        success: false,
        error: "Integração Asaas desabilitada para este escritório",
        code: "INTEGRATION_DISABLED",
        trace_id: traceId,
      }, 403);
    }

    // --- 3. Fetch billing plan (if provided) ---
    let plan: BillingPlan | null = null;
    if (body.plan_id) {
      const { data: planData, error: planErr } = await adminClient
        .from("billing_plans")
        .select("*")
        .eq("id", body.plan_id)
        .eq("office_id", body.office_id)
        .single();

      if (planErr || !planData) {
        return json({ success: false, error: "Plano não encontrado", code: "PLAN_NOT_FOUND", trace_id: traceId }, 404);
      }

      plan = planData as BillingPlan;
      if (!plan.active) {
        return json({ success: false, error: "Plano inativo", code: "PLAN_INACTIVE", trace_id: traceId }, 400);
      }
    }

    // --- 4. Resolve values (custom > plan > config default) ---
    const value = body.custom_value ?? plan?.value;
    if (!value || value <= 0) {
      return json({ success: false, error: "Valor da cobrança não definido ou inválido", code: "INVALID_VALUE", trace_id: traceId }, 400);
    }

    const billingType = body.custom_billing_type ?? plan?.billing_type ?? billingConfig.default_billing_type;
    const dueDays = body.custom_due_days ?? plan?.due_days ?? billingConfig.default_due_days;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    let description = body.custom_description ?? plan?.description ?? billingConfig.default_description_template;
    description = renderTemplate(description, {
      service: plan?.name ?? "Serviço jurídico",
      client_name: "",
      case_title: "",
      date: new Date().toLocaleDateString("pt-BR"),
    });

    // --- 5. Fetch billing rules ---
    const { data: rules } = await adminClient
      .from("billing_rules")
      .select("*")
      .eq("office_id", body.office_id)
      .eq("active", true);

    const billingRules = (rules || []) as BillingRule[];

    // --- 6. Validate value against rules ---
    const valueValidation = validateValue(value, billingRules);
    if (!valueValidation.valid) {
      return json({ success: false, error: valueValidation.error, code: "VALUE_VALIDATION_FAILED", trace_id: traceId }, 400);
    }

    // --- 7. Check for duplicate charges ---
    const duplicateCheck = await checkDuplicateCharge(adminClient, body.office_id, body.client_id, billingRules);
    if (duplicateCheck.blocked) {
      return json({ success: false, error: duplicateCheck.error, code: "DUPLICATE_CHARGE_BLOCKED", trace_id: traceId }, 409);
    }

    // --- 8. Verify customer exists in Asaas ---
    const { data: customer, error: customerErr } = await adminClient
      .from("asaas_customers")
      .select("id, asaas_customer_id")
      .eq("id", body.client_id)
      .eq("office_id", body.office_id)
      .maybeSingle();

    if (customerErr || !customer?.asaas_customer_id) {
      return json({
        success: false,
        error: "Cliente não sincronizado com Asaas",
        code: "CUSTOMER_NOT_SYNCED",
        trace_id: traceId,
      }, 404);
    }

    // --- 9. Check if manual approval is required ---
    const requiresApproval = !body.skip_approval && billingConfig.require_manual_approval;

    if (requiresApproval) {
      const { data: approval, error: approvalErr } = await adminClient
        .from("charge_approvals")
        .insert({
          office_id: body.office_id,
          client_id: body.client_id,
          case_id: body.case_id || null,
          plan_id: body.plan_id || null,
          value,
          description,
          billing_type: billingType,
          due_date: dueDateStr,
          status: "PENDING",
          requested_by: user.uid,
          metadata: {
            plan_name: plan?.name,
            generated_at: new Date().toISOString(),
            generated_by: user.uid,
          },
        })
        .select()
        .single();

      if (approvalErr) {
        console.error(`[${traceId}] Error creating approval:`, approvalErr);
        return json({ success: false, error: "Erro ao criar solicitação de aprovação", code: "APPROVAL_CREATE_ERROR", trace_id: traceId }, 500);
      }

      await logAudit(adminClient, {
        office_id: body.office_id,
        user_id: user.uid,
        action: "billing.generate_approval_request",
        status: "SUCCESS",
        details: { approval_id: approval.id, value, client_id: body.client_id },
        trace_id: traceId,
      });

      return json({
        success: true,
        approval_required: true,
        approval_id: approval.id,
        status: "PENDING_APPROVAL",
        charge: { value, description, billing_type: billingType, due_date: dueDateStr },
        trace_id: traceId,
      }, 201);
    }

    // --- 10. Direct charge: get API key from secrets ---
    const envKey = billingConfig.environment === "production" ? "ASAAS_API_KEY_PRODUCTION" : "ASAAS_API_KEY";
    const apiKey = Deno.env.get(envKey) || Deno.env.get("ASAAS_API_KEY");

    if (!apiKey) {
      return json({
        success: false,
        error: "API key do Asaas não configurada",
        code: "API_KEY_MISSING",
        trace_id: traceId,
      }, 503);
    }

    const asaasBaseUrl = billingConfig.environment === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    // --- 11. Create payment in Asaas ---
    const asaasResult = await createAsaasPayment(asaasBaseUrl, apiKey, {
      customer: customer.asaas_customer_id,
      billingType: billingType,
      value,
      dueDate: dueDateStr,
      description,
      externalReference: body.case_id || body.client_id,
    });

    if (!asaasResult.success) {
      console.error(`[${traceId}] Asaas API error:`, asaasResult.error);
      await logAudit(adminClient, {
        office_id: body.office_id,
        user_id: user.uid,
        action: "billing.generate",
        status: "ERROR",
        details: { error: asaasResult.error, client_id: body.client_id, value },
        trace_id: traceId,
      });
      return json({
        success: false,
        error: "Erro ao criar cobrança no Asaas",
        details: asaasResult.error,
        code: "ASAAS_API_ERROR",
        trace_id: traceId,
      }, asaasResult.status || 502);
    }

    const asaasData = asaasResult.data as Record<string, unknown>;

    // --- 12. Save payment locally ---
    const { data: savedPayment, error: saveErr } = await adminClient
      .from("asaas_payments")
      .insert({
        office_id: body.office_id,
        customer_local_id: body.client_id,
        client_id: body.client_id,
        case_id: body.case_id || null,
        asaas_payment_id: asaasData.id,
        billing_type: billingType,
        value,
        due_date: dueDateStr,
        description,
        status: String(asaasData.status || "pending").toLowerCase(),
        invoice_url: asaasData.invoiceUrl || null,
        boleto_url: asaasData.bankSlipUrl || null,
        pix_payload: (asaasData.pixTransaction as Record<string, unknown> | undefined)?.payload || null,
        pix_qr_code_base64: (asaasData.pixTransaction as Record<string, unknown> | undefined)?.encodedImage || null,
        billing_config_id: billingConfig.id,
        plan_id: body.plan_id || null,
      })
      .select()
      .single();

    if (saveErr) {
      console.error(`[${traceId}] Error saving payment locally:`, saveErr);
      await logAudit(adminClient, {
        office_id: body.office_id,
        user_id: user.uid,
        action: "billing.generate",
        status: "ERROR",
        details: { error: saveErr.message, asaas_payment_id: asaasData.id, warning: "not_saved_locally" },
        trace_id: traceId,
      });
      return json({
        success: true,
        warning: "Cobrança criada no Asaas mas falha ao salvar localmente",
        asaas_payment: asaasData,
        save_error: saveErr.message,
        trace_id: traceId,
      }, 201);
    }

    await logAudit(adminClient, {
      office_id: body.office_id,
      user_id: user.uid,
      action: "billing.generate",
      status: "SUCCESS",
      details: { asaas_payment_id: asaasData.id, value, client_id: body.client_id, billing_type: billingType },
      trace_id: traceId,
    });

    return json({
      success: true,
      approval_required: false,
      status: "CREATED",
      payment: savedPayment,
      asaas_payment_id: asaasData.id,
      invoice_url: asaasData.invoiceUrl,
      boleto_url: asaasData.bankSlipUrl,
      pix: asaasData.pixTransaction ? {
        payload: (asaasData.pixTransaction as Record<string, unknown>).payload,
        qr_code_base64: (asaasData.pixTransaction as Record<string, unknown>).encodedImage,
      } : null,
      environment: billingConfig.environment,
      trace_id: traceId,
    }, 201);

  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("[billing-generate] Fatal error:", errorMsg);
    return json({ success: false, error: "Erro interno ao gerar cobrança", details: errorMsg, code: "INTERNAL_ERROR" }, 500);
  }
});
