import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { officeId, pacienteId, inputText, tipoAnalise, agentType, imageUrl } = await req.json()

    // 1. Setup Supabase clint
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Obter o usuário autenticado que fez a requisição
    const { data: userData, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !userData?.user) {
        throw new Error('Não autenticado')
    }
    const userId = userData.user.id

    // 2. Fetch User AI Config from ai_agents (managed by AIAgentsManager)
    const { data: aiAgent, error: configError } = await supabaseClient
      .from('ai_agents')
      .select('*')
      .eq('slug', agentType === 'iridology' ? 'medical-iridology' : 'medical-clinical')
      .maybeSingle()
      
    if (configError) throw configError;

    // We still need the api_key if it was in ai_config, but ai_agents doesn't have api_key. They might use server-side env vars instead.
    const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('VITE_OPENAI_API_KEY');
    
    if (!apiKey) {
        throw new Error("Chave de API da OpenAI não configurada via interface nem pelo .env do Supabase Edge Functions. Se estiver rodando local, inicie a edge function com --env-file .env");
    }

    // 3. Selecionar o prompt correto baseado no agentType
    let systemPrompt = aiAgent?.system_prompt;
    
    if (!systemPrompt) {
        if (agentType === 'clinical') {
          systemPrompt = `Atue como um Motor de Apoio Multidisciplinar focado em Nutrição, Medicina Integrativa e Neurologia. Analise o caso fornecido.
Forneça as informações estruturadas neste JSON EXTATO:
{
  "estrutura": "Resumo clínico...",
  "hipoteses": ["Hipótese 1", "Hipótese 2"],
  "nutricao": { "avaliacao": "...", "hipoteses": [], "protocolos": [], "referencias": [] },
  "integrativa": { "terapias": [{"nome": "Acupuntura", "descricao": "...", "evidencia": "B"}], "referencias": [] },
  "neurologia": { "avaliacao": "...", "correlacoes": [], "investigacao": [], "referencias": [] }
}
Regra: Não retorne formatação markdown (sem \`\`\`json etc)`;
        } else if (agentType === 'iridology') {
          systemPrompt = `Você é um Iridologista Master e Médico Integrativo. Você receberá imagens de alta resolução do olho do paciente, junto com suas notas clínicas (se houver). 
Seu objetivo é realizar uma leitura detalhada da íris.
Retorne EXATAMENTE APENAS um JSON válido estruturado assim:
{
  "summary": "Resumo clínico...",
  "vitalityIndex": 85,
  "criticalAlerts": [{"title": "Fígado", "description": "Sobrecarga estromal", "severity": "moderate"}],
  "findings": [{"zone": 2, "name": "Vesícula", "type": "Mancha psórica", "eye": "right", "severity": "moderate", "description": "Mancha alaranjada..."}],
  "systems": [{"name": "Digestório", "status": "attention", "details": "Deficiência gástrica..."}],
  "anamnesisQuestions": ["O paciente tem gastrite?"],
  "references": ["Bernard Jensen"]
}
Regra: Não retorne formatação markdown.`;
        } else {
            systemPrompt = "Você é um excelente assistente médico.";
        }
    }

    // 4. Preparar Mensagens para OpenAI API (Suportando Vision se tiver imageUrl)
    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (imageUrl) {
        messages.push({
            role: "user",
            content: [
                { type: "text", text: `Analise as seguintes informacoes do caso: ${inputText || 'Sem infos adicionais'}` },
                {
                    type: "image_url",
                    image_url: {
                        url: imageUrl,
                        detail: "high"
                    }
                }
            ]
        });
    } else {
        messages.push({
            role: "user",
            content: `Analise as seguintes informacoes do caso: ${inputText || 'Analise completa por favor.'}
            Contexto da Analise Clinica Solicitada: ${tipoAnalise}`
        });
    }

    // 5. Chamar OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Model de texto + vision robusto
        messages: messages,
        temperature: 0.1, // temperatura baixa para gerar JSON estavel
      }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI Error: ${err}`);
    }

    const openAiData = await response.json();
    let rawOutput = openAiData.choices[0].message.content;
    
    // 6. Tentar parsear o JSON para garantir segurança enviando pro front
    try {
        // limpar marcardores de blocos de codigo caso a openai os retorne
        rawOutput = rawOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonOutput = JSON.parse(rawOutput);
        
        return new Response(JSON.stringify({ resultado: jsonOutput }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (parseError) {
        console.error("OpenAI não retornou JSON válido:", rawOutput);
        throw new Error("IA não retornou o formato JSON esperado.");
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
