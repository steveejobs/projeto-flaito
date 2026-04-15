import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAndAuthorize } from "../_shared/auth.ts";
import { decrypt } from "../_shared/crypto.ts";
import { resilientFetch } from "../_shared/external-adapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateRequest {
  integration_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = crypto.randomUUID();

  try {
    const { integration_id }: ValidateRequest = await req.json();

    if (!integration_id) {
       return new Response(JSON.stringify({ error: "Missing integration_id" }), { status: 400, headers: corsHeaders });
    }

    // 1. Authenticate user as Owner or Admin
    // Buscamos o office_id primeiro
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseKey);

    const { data: integ, error: fetchError } = await adminClient
      .from("office_billing_integrations")
      .select("office_id, encrypted_api_key, is_sandbox, provider")
      .eq("id", integration_id)
      .single();

    if (fetchError || !integ) {
      return new Response(JSON.stringify({ error: "Integration not found" }), { status: 404, headers: corsHeaders });
    }

    const authResult = await authenticateAndAuthorize(req, "billing:manage", integ.office_id);
    if (!authResult.ok) {
      return new Response(JSON.stringify({ error: authResult.error }), { status: authResult.status, headers: corsHeaders });
    }

    // 2. Decrypt API Key
    let apiKey: string;
    try {
      apiKey = await decrypt(integ.encrypted_api_key!);
    } catch (err) {
      return new Response(JSON.stringify({ error: "Failed to decrypt API key", details: err.message }), { status: 500, headers: corsHeaders });
    }

    // 3. PING Asaas
    const baseUrl = integ.is_sandbox 
      ? "https://sandbox.asaas.com/api/v3" 
      : "https://api.asaas.com/v3";

    console.log(`[billing-validate] Testing integration ${integration_id} on ${baseUrl}`);

    const asaasResponse = await resilientFetch(`${baseUrl}/merchants/myMerchant`, {
      method: "GET",
      headers: {
        "access_token": apiKey,
      },
      serviceName: "asaas-ping",
      correlationId: traceId,
      timeoutMs: 15000
    });

    const asaasData = await asaasResponse.json();

    if (!asaasResponse.ok) {
      await adminClient.from("office_billing_integrations").update({
        status: "invalid",
        operational_health: "invalid",
        metadata: { last_error: asaasData, last_check: new Date().toISOString() }
      }).eq("id", integration_id);

      return new Response(JSON.stringify({ success: false, error: "Invalid API Key", details: asaasData }), { status: 400, headers: corsHeaders });
    }

    // 4. Update Status to Active
    const { error: updateError } = await adminClient.from("office_billing_integrations").update({
      status: "active",
      operational_health: "valid",
      asaas_account_id: asaasData.id, // Sincroniza o ID da conta real
      metadata: { 
        last_check: new Date().toISOString(),
        merchant_name: asaasData.name,
        merchant_email: asaasData.email
      }
    }).eq("id", integration_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Integração validada e ativada com sucesso",
      merchant: asaasData.name
    }), { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error(`[billing-validate] [${traceId}] Critical error:`, error.message);
    return new Response(JSON.stringify({ error: "Internal server error", details: error.message }), { status: 500, headers: corsHeaders });
  }
});
