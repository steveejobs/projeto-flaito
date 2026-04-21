import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-frontend-client",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Rate limiting in-memory (per isolate)
const ipCache = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_COUNT = 30;
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const origin = req.headers.get("origin") || "";
  const clientHeader = req.headers.get("x-frontend-client");

  // 1. Security Check: Origin & Custom Header
  // Permite localhost para dev, e domínios do projeto
  const isAllowedOrigin = !origin || 
    origin.includes("localhost") || 
    origin.includes("127.0.0.1") || 
    origin.endsWith(".supabase.co") || 
    origin.endsWith(".vercel.app") ||
    origin.includes("flaito.com.br");

  if (!isAllowedOrigin || clientHeader !== "flaito-app") {
    console.warn(`[cep-proxy] Unauthorized access attempt: Origin=${origin}, IP=${clientIp}`);
    return new Response(
      JSON.stringify({ erro: true, message: "Acesso não autorizado" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. Rate Limiting
  const now = Date.now();
  const state = ipCache.get(clientIp) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

  if (now > state.resetAt) {
    state.count = 1;
    state.resetAt = now + RATE_LIMIT_WINDOW;
  } else {
    state.count++;
  }
  ipCache.set(clientIp, state);

  if (state.count > RATE_LIMIT_COUNT) {
    console.warn(`[cep-proxy] Rate limit exceeded for IP: ${clientIp}`);
    return new Response(
      JSON.stringify({ erro: true, message: "Muitas requisições. Tente novamente mais tarde." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
