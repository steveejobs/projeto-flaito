// supabase/functions/nija-prescricao/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { NIJA_CORE_PROMPT } from "../_shared/nija-core-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NijaAnaliseRequest {
  tipoAnalise: 'prescricao' | 'decadencia';
  naturezaPretensao: string;
  marcoInicial: {
    data: string;
    descricao: string;
  };
  documentos: Array<{
    id: string;
    filename: string;
    kind: string;
  }>;
  observacoes: string;
  documentoConteudoExtraido?: string | null;
  caso: {
    title: string;
    cnj_number: string | null;
    area: string | null;
    subtype: string | null;
    side: string;
    status: string;
    opponent_name: string | null;
  };
  cliente: {
    full_name: string;
    person_type: string;
    cpf: string | null;
    cnpj: string | null;
  };
}

const SYSTEM_PROMPT_PRESCRICAO = `${NIJA_CORE_PROMPT}

==================================================
### MÓDULO NIJA: ANÁLISE DE PRESCRIÇÃO ###
==================================================

Você é um assistente jurídico especializado em análise de PRESCRIÇÃO no direito brasileiro. Sua função é analisar as informações fornecidas e emitir uma nota técnica sobre os prazos prescricionais aplicáveis.

CONCEITO DE PRESCRIÇÃO:
Prescrição é a perda da PRETENSÃO (direito de ação) pelo decurso do tempo. Atinge o direito de exigir judicialmente uma prestação. O direito material subsiste, mas perde-se a capacidade de exigi-lo coercitivamente.

REGRAS OBRIGATÓRIAS:
1. Identifique o prazo prescricional aplicável com base na natureza da pretensão informada
2. Calcule a data de prescrição a partir do marco inicial fornecido (actio nata)
3. Considere causas de SUSPENSÃO e INTERRUPÇÃO (citação, acordo, moratória, incapacidade)
4. A prescrição pode ser suspensa, interrompida e até renunciada
5. Use linguagem técnica jurídica mas clara
6. Formate a resposta como uma nota técnica profissional

PROIBIÇÕES ABSOLUTAS:
- NUNCA invente, crie ou cite artigos de lei fictícios
- NUNCA invente, crie ou cite súmulas inexistentes
- NUNCA invente, crie ou cite precedentes, acórdãos ou julgados fictícios
- NUNCA atribua entendimentos a tribunais sem certeza absoluta
- Se não tiver certeza sobre um dispositivo legal, NÃO o cite

REGRA DE JURISPRUDÊNCIA:
Se não houver jurisprudência segura ou consolidada sobre o tema com base nos dados fornecidos, você DEVE declarar expressamente:
"Não localizei precedente seguro com base nos dados fornecidos. Recomenda-se conferência em fonte oficial (STJ, STF ou Tribunal de Justiça competente) para verificação de entendimento jurisprudencial atualizado."

ESTRUTURA DA NOTA TÉCNICA (seções obrigatórias e separadas):
1. IDENTIFICAÇÃO (dados do caso e cliente)
2. NATUREZA DA PRETENSÃO
3. PRAZO PRESCRICIONAL APLICÁVEL
4. MARCO INICIAL E DIES A QUO (teoria da actio nata)
5. PRAZO FINAL (dies ad quem)
6. CAUSAS DE SUSPENSÃO/INTERRUPÇÃO POTENCIAIS
7. (A) FUNDAMENTAÇÃO LEGAL - Cite APENAS dispositivos que você tem CERTEZA
8. (B) JURISPRUDÊNCIA - Cite APENAS precedentes que tem ABSOLUTA CERTEZA
9. (C) PONTOS CONTROVERTIDOS / AUSÊNCIA DE ENTENDIMENTO CONSOLIDADO
10. ANÁLISE DE RISCO
11. RECOMENDAÇÕES
12. CONCLUSÃO

IMPORTANTE: Esta análise é meramente orientativa e não substitui a análise do advogado responsável. Recomenda-se sempre a conferência dos dispositivos legais e jurisprudência em fontes oficiais.`;

const SYSTEM_PROMPT_DECADENCIA = `${NIJA_CORE_PROMPT}

==================================================
### MÓDULO NIJA: ANÁLISE DE DECADÊNCIA ###
==================================================

Você é um assistente jurídico especializado em análise de DECADÊNCIA no direito brasileiro. Sua função é analisar as informações fornecidas e emitir uma nota técnica sobre os prazos decadenciais aplicáveis.

CONCEITO DE DECADÊNCIA (distinto de Prescrição):
Decadência é a perda do PRÓPRIO DIREITO (direito potestativo) pelo não exercício no prazo legal ou convencional. Diferente da prescrição:
- Prescrição: atinge a PRETENSÃO (direito de ação), o direito material subsiste
- Decadência: extingue o PRÓPRIO DIREITO potestativo

CARACTERÍSTICAS DISTINTIVAS DA DECADÊNCIA:
1. NÃO se suspende nem se interrompe (regra geral, salvo exceções legais como incapacidade absoluta)
2. Pode ser legal (lei) ou convencional (contrato)
3. Decadência legal pode ser reconhecida de ofício pelo juiz
4. Decadência convencional depende de alegação da parte
5. Atinge direitos potestativos (direitos que dependem apenas da vontade do titular)

DIPLOMAS LEGAIS RELEVANTES PARA DECADÊNCIA:
- Código Civil (Lei 10.406/2002): Arts. 207-211, Arts. 178, 179, 445, 501, 504, 505, 618, etc.
- CDC (Lei 8.078/90): Art. 26 (vício do produto/serviço - 30/90 dias)
- CTN (Lei 5.172/66): Arts. 168, 173

PROIBIÇÕES ABSOLUTAS:
- NUNCA invente, crie ou cite artigos de lei fictícios
- NUNCA invente, crie ou cite súmulas inexistentes
- NUNCA invente, crie ou cite precedentes, acórdãos ou julgados fictícios
- NUNCA atribua entendimentos a tribunais sem certeza absoluta
- Se não tiver certeza sobre um dispositivo legal, NÃO o cite

REGRA DE JURISPRUDÊNCIA:
Se não houver jurisprudência segura ou consolidada sobre o tema com base nos dados fornecidos, você DEVE declarar expressamente:
"Não localizei precedente seguro com base nos dados fornecidos. Recomenda-se conferência em fonte oficial (STJ, STF ou Tribunal de Justiça competente) para verificação de entendimento jurisprudencial atualizado."

ESTRUTURA DA NOTA TÉCNICA (seções obrigatórias e separadas):
1. IDENTIFICAÇÃO (dados do caso e cliente)
2. NATUREZA DO DIREITO (potestativo vs obrigacional)
3. DISTINÇÃO PRESCRIÇÃO x DECADÊNCIA NO CASO CONCRETO
4. PRAZO DECADENCIAL APLICÁVEL
5. MARCO INICIAL
6. PRAZO FINAL
7. IMPOSSIBILIDADE DE SUSPENSÃO/INTERRUPÇÃO (ou exceções)
8. (A) FUNDAMENTAÇÃO LEGAL
9. (B) JURISPRUDÊNCIA
10. (C) PONTOS CONTROVERTIDOS
11. ANÁLISE DE RISCO
12. RECOMENDAÇÕES
13. CONCLUSÃO

IMPORTANTE: Esta análise é meramente orientativa e não substitui a análise do advogado responsável. Recomenda-se sempre a conferência dos dispositivos legais e jurisprudência em fontes oficiais.`;

serve(async (req) => {
  // Preflight CORS - Safari fix: always return Content-Type: application/json
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    const payload: NijaAnaliseRequest = await req.json();
    
    console.log('[NIJA] start', { tipo: payload.tipoAnalise, case: payload.caso?.cnj_number });

    // NIJA Fase 1: Guardrail - verificar tamanho mínimo do texto extraído
    const MIN_CHARS_REQUIRED = 1500;
    const conteudoExtraido = payload.documentoConteudoExtraido || "";
    if (conteudoExtraido.length > 0 && conteudoExtraido.length < MIN_CHARS_REQUIRED) {
      console.error(`[NIJA] Texto muito curto: ${conteudoExtraido.length} chars`);
      return new Response(
        JSON.stringify({
          error: "LEITURA_INSUFICIENTE",
          message: `Texto muito curto (${conteudoExtraido.length} caracteres). Mínimo necessário: ${MIN_CHARS_REQUIRED} caracteres.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Seleciona prompt baseado no tipo de análise
    const tipoAnalise = payload.tipoAnalise || 'prescricao';
    const systemPrompt = tipoAnalise === 'decadencia' 
      ? SYSTEM_PROMPT_DECADENCIA 
      : SYSTEM_PROMPT_PRESCRICAO;

    const tipoLabel = tipoAnalise === 'decadencia' ? 'decadência' : 'prescrição';
    const tipoLabelMaiusculo = tipoAnalise === 'decadencia' ? 'DECADÊNCIA' : 'PRESCRIÇÃO';

    // Build extracted content section if provided
    const conteudoExtraidoSection = payload.documentoConteudoExtraido
      ? `\n\nCONTEÚDO EXTRAÍDO DOS DOCUMENTOS (trechos selecionados pelo usuário):\n${payload.documentoConteudoExtraido}`
      : '';

    const userPrompt = `Analise a ${tipoLabel} para o seguinte caso:

DADOS DO CASO:
- Processo: ${payload.caso.title || "Não informado"}
- CNJ: ${payload.caso.cnj_number || "Não informado"}
- Área: ${payload.caso.area || "Não informada"}
- Subtipo: ${payload.caso.subtype || "Não informado"}
- Polo: ${payload.caso.side === "ATAQUE" ? "Autor (Ataque)" : "Réu (Defesa)"}
- Status: ${payload.caso.status}
- Parte contrária: ${payload.caso.opponent_name || "Não informada"}

DADOS DO CLIENTE:
- Nome: ${payload.cliente.full_name}
- Tipo: ${payload.cliente.person_type === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
- Documento: ${payload.cliente.cpf || payload.cliente.cnpj || "Não informado"}

NATUREZA DA PRETENSÃO/DIREITO:
${payload.naturezaPretensao}

MARCO INICIAL:
- Data: ${payload.marcoInicial.data}
- Descrição: ${payload.marcoInicial.descricao}

DOCUMENTOS ANEXADOS AO CASO:
${payload.documentos.length > 0 
  ? payload.documentos.map(d => `- ${d.filename} (${d.kind})`).join("\n")
  : "Nenhum documento selecionado"}${conteudoExtraidoSection}

OBSERVAÇÕES ADICIONAIS:
${payload.observacoes || "Nenhuma observação adicional"}

Por favor, elabore a nota técnica de análise de ${tipoLabelMaiusculo}.${conteudoExtraidoSection ? ' Utilize os trechos extraídos dos documentos para enriquecer a análise, identificando datas, partes, prazos e cláusulas relevantes.' : ''}`;

    console.log('[NIJA] fetch AI gateway');

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
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[NIJA] gateway error', { status: response.status, body: errorText });

      // Check for overloaded in error text
      if (errorText.toLowerCase().includes('overloaded')) {
        return new Response(
          JSON.stringify({ error: "Servidor ocupado (deploy overloaded). Aguarde e tente novamente." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Erro ao processar análise de ${tipoLabel}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const notaTecnica = data.choices?.[0]?.message?.content || "Não foi possível gerar a análise.";

    console.log('[NIJA] success');

    return new Response(
      JSON.stringify({ notaTecnica, tipoAnalise }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('[NIJA] error', { message: error instanceof Error ? error.message : 'unknown' });
    
    // Check for overloaded in catch
    const errMsg = error instanceof Error ? error.message.toLowerCase() : '';
    if (errMsg.includes('overloaded')) {
      return new Response(
        JSON.stringify({ error: "Servidor ocupado (deploy overloaded). Aguarde e tente novamente." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
