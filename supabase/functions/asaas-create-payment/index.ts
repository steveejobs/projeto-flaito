import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") || "https://sandbox.asaas.com/api/v3";

    if (!ASAAS_API_KEY) {
      console.error("ASAAS_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          error: "Asaas API key not configured. Please configure ASAAS_API_KEY in Supabase Functions secrets." 
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: CreatePaymentRequest = await req.json();
    console.log("Received payment request:", JSON.stringify(payload, null, 2));

    // Validate required fields
    if (!payload.customer_local_id || !payload.value || !payload.due_date || !payload.billing_type || !payload.office_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: customer_local_id, value, due_date, billing_type, office_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the Asaas customer ID from our local customer record
    const { data: customerData, error: customerError } = await supabase
      .from("asaas_customers")
      .select("asaas_customer_id")
      .eq("id", payload.customer_local_id)
      .eq("office_id", payload.office_id)
      .single();

    if (customerError || !customerData?.asaas_customer_id) {
      console.error("Customer lookup error:", customerError);
      return new Response(
        JSON.stringify({ error: "Customer not found or not synced with Asaas" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const asaasCustomerId = customerData.asaas_customer_id;
    console.log("Found Asaas customer ID:", asaasCustomerId);

    // Create payment in Asaas
    const asaasPayload = {
      customer: asaasCustomerId,
      billingType: payload.billing_type,
      value: payload.value,
      dueDate: payload.due_date,
      description: payload.description || "Pagamento de serviços jurídicos",
    };

    console.log("Creating payment in Asaas:", JSON.stringify(asaasPayload, null, 2));

    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify(asaasPayload),
    });

    const asaasData: AsaasPaymentResponse = await asaasResponse.json();
    console.log("Asaas response:", JSON.stringify(asaasData, null, 2));

    if (!asaasResponse.ok) {
      console.error("Asaas API error:", asaasData);
      return new Response(
        JSON.stringify({ error: "Failed to create payment in Asaas", details: asaasData }),
        { status: asaasResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store payment in our database
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
      status: asaasData.status.toLowerCase() as "pending" | "confirmed" | "received" | "overdue" | "refunded" | "cancelled",
      invoice_url: asaasData.invoiceUrl || null,
      boleto_url: asaasData.bankSlipUrl || null,
      pix_payload: asaasData.pixTransaction?.payload || null,
      pix_qr_code_base64: asaasData.pixTransaction?.encodedImage || null,
    };

    console.log("Saving payment to database:", JSON.stringify(paymentRecord, null, 2));

    const { data: savedPayment, error: saveError } = await supabase
      .from("asaas_payments")
      .insert(paymentRecord)
      .select()
      .single();

    if (saveError) {
      console.error("Error saving payment to database:", saveError);
      // Payment was created in Asaas but failed to save locally
      // We still return success but include a warning
      return new Response(
        JSON.stringify({
          success: true,
          warning: "Payment created in Asaas but failed to save locally",
          asaas_payment: asaasData,
          save_error: saveError.message,
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Payment saved successfully:", savedPayment.id);

    return new Response(
      JSON.stringify({
        success: true,
        payment: savedPayment,
        asaas_payment_id: asaasData.id,
        invoice_url: asaasData.invoiceUrl,
        boleto_url: asaasData.bankSlipUrl,
        pix: asaasData.pixTransaction ? {
          payload: asaasData.pixTransaction.payload,
          qr_code_base64: asaasData.pixTransaction.encodedImage,
        } : null,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
