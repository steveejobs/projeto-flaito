/**
 * Billing Resolver Utilities
 * Localização: supabase/functions/_shared/billing-resolver.ts
 * 
 * Responsável por decidir qual credencial do Asaas usar com base no contexto 
 * (SaaS Billing vs Office Operational) e nas configurações do tenant.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt } from "./encryption.ts";

export type BillingContext = "saas_billing" | "office_operational";

export interface BillingClient {
  apiKey: string;
  baseUrl: string;
  isSandbox: boolean;
  mode: "platform_master" | "tenant_key" | "subaccount";
  integrationId?: string;
}

/**
 * Resolve as credenciais corretas para a operação de billing.
 */
export async function resolveBillingClient(
  adminClient: SupabaseClient,
  officeId: string,
  context: BillingContext
): Promise<BillingClient> {
  console.log(`[billing-resolver] Resolving client for office: ${officeId}, context: ${context}`);

  // Contexto: SaaS Billing (Flaito cobrando o escritório)
  if (context === "saas_billing") {
    const isProd = Deno.env.get("ENVIRONMENT") === "production";
    const apiKey = Deno.env.get(isProd ? "ASAAS_API_KEY_PRODUCTION" : "ASAAS_API_KEY");
    const baseUrl = isProd ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

    if (!apiKey) throw new Error("[billing-resolver] Master ASAAS_API_KEY not configured");

    return {
      apiKey,
      baseUrl,
      isSandbox: !isProd,
      mode: "platform_master"
    };
  }

  // Contexto: Office Operational
  const { data: config, error } = await adminClient
    .from("billing_configs")
    .select("*")
    .eq("office_id", officeId)
    .single();

  if (error || !config) {
    throw new Error(`[billing-resolver] No billing configuration found for office ${officeId}`);
  }

  // Resolver API Key
  let apiKey: string;
  
  if (!config.asaas_api_key_encrypted) {
    // Fallback para master se permitido ou erro
    const isProd = Deno.env.get("ENVIRONMENT") === "production";
    apiKey = Deno.env.get(isProd ? "ASAAS_API_KEY_PRODUCTION" : "ASAAS_API_KEY")!;
  } else {
    // Decriptografar usando o novo helper
    if (!config.encryption_iv) {
      throw new Error("[billing-resolver] Missing encryption IV in billing_configs");
    }
    apiKey = await decrypt(config.asaas_api_key_encrypted, config.encryption_iv);
  }

  const baseUrl = config.environment === 'production' 
    ? "https://api.asaas.com/v3" 
    : "https://sandbox.asaas.com/api/v3";

  return {
    apiKey,
    baseUrl,
    isSandbox: config.environment === 'sandbox',
    mode: config.asaas_api_key_encrypted ? "tenant_key" : "platform_master",
    integrationId: config.id
  };
}

/**
 * Registra o uso de uma credencial para fins de auditoria e compliance financeiro.
 */
export async function logBillingUsage(
  adminClient: SupabaseClient,
  params: {
    officeId: string;
    integrationId?: string;
    context: BillingContext;
    operation: string;
    status: "SUCCESS" | "DENIED" | "ERROR";
    functionName: string;
    metadata?: any;
  }
) {
  try {
    await adminClient.from("office_billing_usage_logs").insert({
      office_id: params.officeId,
      integration_id: params.integrationId,
      context: params.context,
      operation: params.operation,
      status: params.status,
      used_in_function: params.functionName,
      provider: "asaas",
      metadata_json: params.metadata || {}
    });
  } catch (err) {
    console.error("[billing-resolver] Critical: Failed to log billing usage", err);
    // Não paramos o fluxo principal se o log falhar, mas avisamos no console
  }
}
