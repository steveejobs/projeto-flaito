import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, imageUrl, focusOn } = await req.json();

    if (!imageBase64 && !imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageBase64 ou imageUrl é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isFocusAddress = focusOn === 'address';

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Chave de API não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[lexos-extract-document-data] Iniciando extração...");

    // Preparar a imagem para a API
    let imageContent: { type: "image_url"; image_url: { url: string } };
    
    if (imageBase64) {
      // Se recebeu base64, usar diretamente
      imageContent = {
        type: "image_url",
        image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` }
      };
    } else {
      // Se recebeu URL, usar a URL diretamente
      imageContent = {
        type: "image_url",
        image_url: { url: imageUrl }
      };
    }

    const systemPrompt = isFocusAddress
      ? `Você é um assistente especializado em extrair dados de endereço de comprovantes de residência brasileiros (contas de luz, água, telefone, etc).

Analise a imagem do comprovante e extraia os dados de ENDEREÇO quando disponíveis:
- Logradouro com número
- Bairro
- Cidade
- Estado (UF)
- CEP

Retorne APENAS um JSON válido com os campos encontrados. Use null para campos não encontrados.
Não inclua explicações, apenas o JSON.`
      : `Você é um assistente especializado em extrair dados de documentos brasileiros (RG, CNH, CPF, comprovante de endereço).

Analise a imagem do documento e extraia os seguintes dados quando disponíveis:
- Nome completo
- CPF
- RG e órgão emissor
- Data de nascimento
- Nacionalidade
- Estado civil (se visível)
- Endereço completo (logradouro, número, bairro, cidade, estado, CEP)
- Profissão (se visível)

Retorne APENAS um JSON válido com os campos encontrados. Use null para campos não encontrados.
Não inclua explicações, apenas o JSON.`;

    const userPrompt = isFocusAddress 
      ? "Extraia os dados de ENDEREÇO deste comprovante de residência:"
      : "Extraia os dados deste documento brasileiro:";

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
        tools: [
          {
            type: "function",
            function: {
              name: "extract_document_data",
              description: "Extrai dados estruturados de um documento brasileiro",
              parameters: {
                type: "object",
                properties: {
                  full_name: { type: "string", description: "Nome completo" },
                  cpf: { type: "string", description: "CPF no formato 000.000.000-00" },
                  rg: { type: "string", description: "Número do RG" },
                  rg_issuer: { type: "string", description: "Órgão emissor do RG (ex: SSP/SP)" },
                  birth_date: { type: "string", description: "Data de nascimento no formato DD/MM/AAAA" },
                  nationality: { type: "string", description: "Nacionalidade" },
                  marital_status: { type: "string", description: "Estado civil" },
                  profession: { type: "string", description: "Profissão" },
                  address_line: { type: "string", description: "Logradouro com número" },
                  neighborhood: { type: "string", description: "Bairro" },
                  city: { type: "string", description: "Cidade" },
                  state: { type: "string", description: "Estado (UF)" },
                  cep: { type: "string", description: "CEP no formato 00000-000" }
                },
                required: []
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_document_data" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar imagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log("[lexos-extract-document-data] Resposta da IA recebida");

    // Função para normalizar nomes em Title Case
    const toTitleCase = (name: string | null | undefined): string => {
      if (!name) return '';
      const prepositions = ['de', 'da', 'do', 'das', 'dos', 'e', 'di'];
      return name
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((word, index) => {
          if (index > 0 && prepositions.includes(word)) {
            return word;
          }
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
    };

    // Extrair dados do tool call
    let extractedData: Record<string, string | null> = {};
    
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        extractedData = JSON.parse(toolCall.function.arguments);
        console.log("[lexos-extract-document-data] Dados extraídos:", Object.keys(extractedData).filter(k => extractedData[k]));
      } catch (e) {
        console.error("Erro ao parsear argumentos:", e);
      }
    }

    // Fallback: tentar extrair do content se não veio via tool
    if (Object.keys(extractedData).length === 0 && result.choices?.[0]?.message?.content) {
      try {
        const content = result.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Erro ao parsear content:", e);
      }
    }

    // Normalizar campos de texto para Title Case
    if (extractedData.full_name) extractedData.full_name = toTitleCase(extractedData.full_name);
    if (extractedData.profession) extractedData.profession = toTitleCase(extractedData.profession);
    if (extractedData.nationality) extractedData.nationality = toTitleCase(extractedData.nationality);
    if (extractedData.city) extractedData.city = toTitleCase(extractedData.city);
    if (extractedData.neighborhood) extractedData.neighborhood = toTitleCase(extractedData.neighborhood);

    return new Response(
      JSON.stringify({ 
        success: true,
        data: extractedData,
        fieldsFound: Object.keys(extractedData).filter(k => extractedData[k] !== null && extractedData[k] !== "")
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[lexos-extract-document-data] Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
