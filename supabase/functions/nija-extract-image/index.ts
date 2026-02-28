// supabase/functions/nija-extract-image/index.ts
// Edge function para OCR de PDFs-imagem usando Vision AI (Provisório)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight - Safari fix: always return Content-Type: application/json
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    const { imageBase64, pageNumber = 1 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "imageBase64 é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[nija-extract-image] LOVABLE_API_KEY não configurada");
      return new Response(
        JSON.stringify({ success: false, error: "API key não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[nija-extract-image] Processando página ${pageNumber}, imagem ~${Math.round(imageBase64.length / 1024)}KB`);

    // Prompt especializado para OCR de documentos judiciais
    const systemPrompt = `Você é um assistente especializado em OCR de documentos judiciais brasileiros.
Sua tarefa é extrair TODO o texto visível na imagem de forma precisa e completa.

INSTRUÇÕES:
1. Transcreva EXATAMENTE o que está escrito, mantendo formatação de parágrafos
2. Preserve números de processo no formato CNJ (NNNNNNN-NN.AAAA.J.TR.OOOO)
3. Preserve nomes de partes, advogados, números OAB
4. Preserve datas no formato DD/MM/AAAA
5. Preserve códigos de eventos (ex: PETIÇÃO, DESPACHO, SENTENÇA, etc.)
6. Se for uma tela do sistema EPROC, PJe ou PROJUDI, indique no início
7. Retorne o texto puro, sem comentários adicionais

IMPORTANTE: Extraia TODO o texto legível, mesmo que pareça incompleto.`;

    const userPrompt = `Extraia todo o texto visível nesta imagem de documento judicial (página ${pageNumber}).`;

    // Preparar conteúdo da imagem
    let imageContent: { type: string; image_url: { url: string } };
    
    if (imageBase64.startsWith("data:")) {
      imageContent = {
        type: "image_url",
        image_url: { url: imageBase64 }
      };
    } else {
      imageContent = {
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
      };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              imageContent
            ]
          }
        ],
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[nija-extract-image] Erro da API:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Créditos insuficientes. Adicione créditos na sua conta Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao processar imagem: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || "";

    console.log(`[nija-extract-image] Texto extraído: ${extractedText.length} caracteres`);

    // Detectar sistema judicial
    let systemDetected: string | null = null;
    let isJudicialSystem = false;
    
    const textLower = extractedText.toLowerCase();
    if (textLower.includes("eproc") || textLower.includes("e-proc")) {
      systemDetected = "EPROC";
      isJudicialSystem = true;
    } else if (textLower.includes("pje") || textLower.includes("processo judicial eletrônico")) {
      systemDetected = "PJe";
      isJudicialSystem = true;
    } else if (textLower.includes("projudi")) {
      systemDetected = "PROJUDI";
      isJudicialSystem = true;
    } else if (textLower.includes("tribunal") || textLower.includes("vara") || textLower.includes("comarca")) {
      isJudicialSystem = true;
    }

    // Calcular confiança baseada no tamanho do texto
    const confidence = Math.min(100, Math.round((extractedText.length / 2000) * 100));

    return new Response(
      JSON.stringify({
        success: true,
        extracted_text: extractedText,
        is_judicial_system: isJudicialSystem,
        system_detected: systemDetected,
        confidence,
        chars_extracted: extractedText.length,
        page_number: pageNumber,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[nija-extract-image] Erro:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
