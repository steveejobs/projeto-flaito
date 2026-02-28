import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cep } = await req.json();
    
    if (!cep || typeof cep !== "string") {
      console.error("[cep-proxy] CEP inválido:", cep);
      return new Response(
        JSON.stringify({ erro: true, message: "CEP inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const digits = cep.replace(/\D/g, "");
    
    if (digits.length !== 8) {
      console.error("[cep-proxy] CEP deve ter 8 dígitos:", digits);
      return new Response(
        JSON.stringify({ erro: true, message: "CEP deve ter 8 dígitos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[cep-proxy] Buscando CEP:", digits);

    const url = `https://viacep.com.br/ws/${digits}/json/`;
    const viaCepRes = await fetch(url, {
      headers: {
        "Accept": "application/json",
        // Alguns provedores devolvem HTML (WAF/rate limit); um UA explícito ajuda a evitar bloqueios.
        "User-Agent": "lovable-edge/cep-proxy",
      },
    });

    const rawBody = await viaCepRes.text();

    if (!viaCepRes.ok) {
      console.error("[cep-proxy] ViaCEP não-ok:", viaCepRes.status, rawBody.slice(0, 500));
      return new Response(
        JSON.stringify({ erro: true, message: "Erro ao consultar CEP" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("[cep-proxy] ViaCEP retornou corpo não-JSON:", rawBody.slice(0, 500));
      console.error("[cep-proxy] Erro parse JSON:", parseErr);
      return new Response(
        JSON.stringify({ erro: true, message: "Erro ao consultar CEP" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[cep-proxy] Resposta ViaCEP:", JSON.stringify(data));

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[cep-proxy] Erro:", error);
    return new Response(
      JSON.stringify({ erro: true, message: "Erro ao consultar CEP" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
