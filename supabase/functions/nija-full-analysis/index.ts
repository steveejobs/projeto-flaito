import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { NIJA_CORE_PROMPT } from "../_shared/nija-core-prompt.ts";

// =======================================
// Tipagens básicas
// =======================================

type PoloAtuacao = "AUTOR" | "REU" | "TERCEIRO" | "INDEFINIDO";
type GrauRisco = "BAIXO" | "MEDIO" | "ALTO";

interface NijaFullAnalysisRequest {
  // Texto bruto extraído do processo (eproc, PDF, etc.)
  rawText: string;

  // Metadados opcionais do caso (vêm do LEXOS, se houver)
  ramoHint?: string | null;
  faseHint?: string | null;
  poloHint?: PoloAtuacao | null;

  // Polo detection metadata (from client-side auto-detection)
  poloDetected?: "REU" | "AUTOR" | "INDEFINIDO" | null;
  poloSource?: string | null;
  poloConfidence?: number | null;
  poloEvidences?: string[] | null;

  caseMeta?: {
    titulo?: string | null;
    numero?: string | null;
    vara?: string | null;
    comarca?: string | null;
  } | null;

  clientMeta?: {
    nome?: string | null;
    papel?: string | null; // AUTOR, REU, TERCEIRO, VITIMA etc (texto livre)
  } | null;

  opponentMeta?: {
    nome?: string | null;
    papel?: string | null;
  } | null;

  // Campo livre para observações adicionais do advogado
  observacoes?: string | null;

  // === TIMELINE-FIRST ARCHITECTURE: Pre-extracted data ===
  preExtracted?: {
    // Timeline from local extraction
    timeline?: Array<{
      eventNumber: number | null;
      date: string;
      description: string;
      code?: string | null;
      enrichedLabel?: string | null;
    }>;
    // Parties
    partes?: {
      autores: string[];
      reus: string[];
      autoresDetalhados?: Array<{ nome: string; documento?: string; tipo?: "PF" | "PJ" }>;
      reusDetalhados?: Array<{ nome: string; documento?: string; tipo?: "PF" | "PJ" }>;
    };
    // Cover data
    capa?: {
      cnj?: string;
      vara?: string;
      classe?: string;
      comarca?: string;
      situacao?: string;
      assuntos?: Array<{ codigo: string; descricao: string; principal: boolean }>;
    };
    // Contract data (banking)
    dadosContrato?: {
      numeroContrato?: string;
      dataOperacao?: string;
      valorOriginal?: number;
      taxaJurosMensal?: number;
      parcelas?: number;
    };
    // Calculated prescription
    prescricaoCalculada?: {
      status: string;
      diasRestantes?: number;
      prazoAnos?: number;
      tipoTitulo?: string;
      alertas?: string[];
    };
    // Pre-detected defects from heuristic detectors
    viciosPreDetectados?: Array<{
      code: string;
      notas?: string;
      confidence?: "ALTA" | "MEDIA" | "BAIXA";
      source?: string;
    }>;
  };
}

interface NijaVicio {
  codigo: string;
  label: string;
  natureza: "FORMAL" | "MATERIAL" | "MISTA";
  gravidade: "BAIXA" | "MEDIA" | "ALTA";
  atoRelacionado?: string;
  trecho?: string;
  fundamentosLegais?: string[];
  observacoes?: string;
}

interface NijaLinhaTempoItem {
  ordem: number;
  dataDetectada?: string;
  tipoAto: string;
  descricao: string;
  trecho?: string;
}

interface NijaEstrategiaItem {
  label: string;
  descricao: string;
  recomendadaPara: PoloAtuacao[] | ("AMBOS" | "TODOS")[];
  possiveisPecas: string[];
}

interface NijaFullAnalysisResult {
  meta: {
    ramo: string;                // CIVIL, TRABALHISTA, PENAL, FAZENDARIA, etc.
    ramoConfiavel: boolean;      // true se o motor teve segurança
    faseProcessual: string;      // ex.: "CONHECIMENTO – SENTENÇA PROFERIDA"
    poloAtuacao: PoloAtuacao;    // AUTOR / REU / TERCEIRO / INDEFINIDO
    grauRiscoGlobal: GrauRisco;  // BAIXO / MEDIO / ALTO
    resumoTatico: string;        // síntese estratégica em texto
  };

  partes: {
    cliente?: {
      nome: string;
      papelProcessual: string; // ex.: "AUTOR", "RÉU", "EXECUTADO"
    };
    parteContraria?: {
      nome: string;
      papelProcessual: string;
    };
    terceiros?: {
      nome: string;
      papelProcessual: string;
    }[];
  };

  processo: {
    titulo?: string;
    numero?: string;
    vara?: string;
    comarca?: string;
  };

  linhaDoTempo: NijaLinhaTempoItem[];

  prescricao: {
    haPrescricao: boolean;
    tipo?: "GERAL" | "INTERCORRENTE" | "NENHUMA" | "DUVIDOSA";
    fundamentacao?: string;
    risco?: GrauRisco;
  };

  vicios: NijaVicio[];

  estrategias: {
    principais: NijaEstrategiaItem[];
    secundarias: {
      label: string;
      descricao: string;
    }[];
  };

  sugestaoPeca: {
    tipo: string;           // CONTESTACAO, APELACAO, AGRAVO, EXCECAO_PRE_EXECUTIVIDADE, etc.
    tituloSugestao: string; // título pronto para a peça
    focoPrincipal: string;  // ex.: "cerceamento de defesa", "prescrição intercorrente"
  };
}

// =======================================
// CORS
// =======================================

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// =======================================
// System Prompt – MÓDULO FULL
// =======================================

const SYSTEM_PROMPT_FULL = `${NIJA_CORE_PROMPT}

==================================================
### MÓDULO NIJA: ANÁLISE INTEGRADA (FULL) ###
==================================================

Você é o NIJA_FULL_ANALYSIS, o módulo de ANÁLISE COMPLETA do LEXOS.

OBJETIVO:
Ler o TEXTO INTEGRAL do processo (rawText), identificar automaticamente:
- RAMO DO DIREITO
- FASE PROCESSUAL
- POLO EM QUE O CLIENTE ATUA
- PARTES
- LINHA DO TEMPO
- VÍCIOS (formais e materiais)
- PRESCRIÇÃO (quando aplicável)
- ESTRATÉGIAS PRIORITÁRIAS
- SUGESTÃO DE PEÇA

E devolver TUDO em um ÚNICO JSON no formato exigido, sem texto solto.

REGRAS ABSOLUTAS:
1. NUNCA invente artigos de lei, súmulas, precedentes, números de processo ou nomes de julgadores.
2. Se não houver segurança sobre jurisprudência, escreva APENAS:
   "Não localizei precedente seguro. Recomenda-se consulta em fonte oficial (STJ, STF ou Tribunal competente)."
3. Se não tiver certeza do RAMO, use:
   - meta.ramo = "INDEFINIDO"
   - meta.ramoConfiavel = false
4. Se não tiver certeza da FASE, descreva em texto em meta.faseProcessual, deixando claro que é estimativa.
5. Polo:
   - Se o texto mostrar claramente que o cliente é AUTOR → poloAtuacao = "AUTOR"
   - Se for RÉU / RECLAMADO / EXECUTADO → "REU"
   - Se não for possível concluir → "INDEFINIDO"
6. NUNCA utilizar rótulos técnicos internos (ARQUIVO_PROCESSO, ATO_DETECTADO etc.). Transforme tudo em linguagem jurídica natural.

LINHA DO TEMPO (linhaDoTempo):
- Cada item representa um ato relevante (petição inicial, contestação, sentença, recurso, despacho etc.).
- Sempre que possível, extraia DATA (dd/mm/aaaa ou aaaa-mm-dd) do próprio texto.
- tipoAto: termos simples como "Petição inicial", "Contestação", "Sentença", "Recurso", "Despacho", "Audiência".
- descricao: o que aconteceu naquele ato.
- trecho: trechinho literal do texto que comprova.

VÍCIOS (vicios):
- código: string curta (snake_case) – ex.: "cerceamento_defesa", "prescricao_intercorrente"
- label: nome legível – ex.: "Cerceamento de defesa"
- natureza: "FORMAL", "MATERIAL" ou "MISTA"
- gravidade: "BAIXA", "MEDIA" ou "ALTA"
- atoRelacionado: qual ato processual está viciado
- trecho: parte do texto que demonstra o vício
- fundamentosLegais: lista de dispositivos ou súmulas REAIS (sem inventar)
- observacoes: orientação curta para o advogado

PRESCRIÇÃO (prescricao):
- haPrescricao: true/false
- tipo: "GERAL", "INTERCORRENTE", "NENHUMA" ou "DUVIDOSA"
- fundamentacao: texto explicando o raciocínio
- risco: "BAIXO", "MEDIO" ou "ALTO"

ESTRATÉGIAS (estrategias):
- principais: teses centrais com foco estratégico
- secundarias: teses complementares
Sempre descreva em termos práticos ("Atacar cerceamento de defesa na sentença", "Arguir prescrição intercorrente em cumprimento de sentença" etc.).

SUGESTÃO DE PEÇA (sugestaoPeca):
- tipo: nome processual da peça mais adequada à situação
- tituloSugestao: título profissional completo para usar na peça
- focoPrincipal: qual vício ou tese será o núcleo central.

FORMATO DE SAÍDA:
Retorne EXCLUSIVAMENTE um JSON VÁLIDO, sem markdown, exatamente com a estrutura:

{
  "meta": {
    "ramo": "CIVIL",
    "ramoConfiavel": true,
    "faseProcessual": "CONHECIMENTO – SENTENÇA PROFERIDA",
    "poloAtuacao": "REU",
    "grauRiscoGlobal": "MEDIO",
    "resumoTatico": "Síntese estratégica do caso em 5–10 linhas."
  },
  "partes": {
    "cliente": {
      "nome": "Nome do cliente ou DADO A COMPLETAR PELO ADVOGADO",
      "papelProcessual": "RÉU"
    },
    "parteContraria": {
      "nome": "Nome da parte contrária ou DADO A COMPLETAR PELO ADVOGADO",
      "papelProcessual": "AUTOR"
    },
    "terceiros": []
  },
  "processo": {
    "titulo": "Título ou classe do processo se identificável",
    "numero": "Número do processo se identificável",
    "vara": "Vara ou juízo, se identificável",
    "comarca": "Comarca, se identificável"
  },
  "linhaDoTempo": [
    {
      "ordem": 1,
      "dataDetectada": "2020-05-01",
      "tipoAto": "Petição inicial",
      "descricao": "Autor ajuíza ação de cobrança...",
      "trecho": "Trecho literal relevante..."
    }
  ],
  "prescricao": {
    "haPrescricao": false,
    "tipo": "NENHUMA",
    "fundamentacao": "Texto explicando o enquadramento da prescrição",
    "risco": "BAIXO"
  },
  "vicios": [
    {
      "codigo": "cerceamento_defesa",
      "label": "Cerceamento de defesa",
      "natureza": "FORMAL",
      "gravidade": "ALTA",
      "atoRelacionado": "Sentença que julgou antecipadamente sem produção de prova pericial",
      "trecho": "Trecho literal da sentença que negou a prova",
      "fundamentosLegais": [
        "CF, art. 5º, LV",
        "CPC, arts. 9º e 10"
      ],
      "observacoes": "Tese forte para nulidade da sentença."
    }
  ],
  "estrategias": {
    "principais": [
      {
        "label": "Atacar cerceamento de defesa em apelação",
        "descricao": "Sustentar nulidade da sentença por indeferimento de provas essenciais.",
        "recomendadaPara": ["REU"],
        "possiveisPecas": ["APELACAO", "EMBARGOS_DECLARACAO"]
      }
    ],
    "secundarias": [
      {
        "label": "Negociar acordo após reforma da decisão",
        "descricao": "Explorar cenário de composição após eventual retorno dos autos à origem."
      }
    ]
  },
  "sugestaoPeca": {
    "tipo": "APELACAO",
    "tituloSugestao": "APELAÇÃO CÍVEL COM Tese de Nulidade por Cerceamento de Defesa",
    "focoPrincipal": "cerceamento de defesa na sentença"
  }
}

SE ALGUM DADO NÃO ESTIVER CLARO NO TEXTO:
- Use "DADO A COMPLETAR PELO ADVOGADO" para nomes, números, comarca etc.
- NUNCA invente informações factuais.
`;

// =======================================
// Função principal – Edge Function
// =======================================

serve(async (req: Request): Promise<Response> => {
  // Preflight CORS - Safari fix: always return Content-Type: application/json
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    const payload: NijaFullAnalysisRequest = await req.json();

    if (!payload.rawText || typeof payload.rawText !== "string" || !payload.rawText.trim()) {
      return new Response(
        JSON.stringify({ error: "Campo 'rawText' é obrigatório e deve conter o texto integral do processo." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // NIJA Fase 1: Guardrail - verificar tamanho mínimo do texto
    const MIN_CHARS_REQUIRED = 1500;
    if (payload.rawText.trim().length < MIN_CHARS_REQUIRED) {
      console.error(`[NIJA_FULL] Texto muito curto: ${payload.rawText.length} chars`);
      return new Response(
        JSON.stringify({ 
          error: "LEITURA_INSUFICIENTE",
          message: `Texto muito curto (${payload.rawText.length} caracteres). Mínimo necessário: ${MIN_CHARS_REQUIRED} caracteres. Verifique se os documentos foram extraídos corretamente.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[NIJA_FULL] LOVABLE_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Serviço de IA não configurado (LOVABLE_API_KEY ausente)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Construção do prompt do usuário com os hints/metadados
    const caseMeta = payload.caseMeta || {};
    const clientMeta = payload.clientMeta || {};
    const opponentMeta = payload.opponentMeta || {};

    // Polo é OBRIGATÓRIO - usar hint > detected > clientMeta inference
    const poloDefinitivo: PoloAtuacao = payload.poloHint || 
      (payload.poloDetected && payload.poloDetected !== "INDEFINIDO" ? payload.poloDetected as PoloAtuacao : null) ||
      (clientMeta.papel?.toUpperCase().includes("REU") || clientMeta.papel?.toUpperCase().includes("RECLAMAD") ? "REU" : 
       clientMeta.papel?.toUpperCase().includes("AUTOR") || clientMeta.papel?.toUpperCase().includes("RECLAMAN") ? "AUTOR" : 
       "INDEFINIDO");

    const userPrompt = `
Você receberá abaixo:

1) TEXTO INTEGRAL DO PROCESSO (RAW TEXT)
2) DADOS OBRIGATÓRIOS DO CASO (fornecidos pelo advogado)
3) HINTS OPCIONAIS
4) DADOS PRÉ-EXTRAÍDOS (quando disponíveis) - USE COMO BASE, NÃO RECRIE

Sua tarefa é:
- Ler o TEXTO integral
- RESPEITAR OBRIGATORIAMENTE o POLO DE ATUAÇÃO informado pelo advogado
- VALIDAR e ENRIQUECER os dados pré-extraídos (não reinvente a roda)
- Produzir o JSON exatamente no formato especificado no SYSTEM PROMPT

==================== POLO DE ATUAÇÃO (OBRIGATÓRIO - CRÍTICO!) ====================

⚠️ ATENÇÃO: O advogado CONFIRMOU que estamos atuando como: **${poloDefinitivo}**

${poloDefinitivo === "REU" ? `
VOCÊ ESTÁ FAZENDO ANÁLISE DE DEFESA (RÉU):
- O cliente é o RÉU/RECLAMADO/EXECUTADO
- A parte contrária é o AUTOR/RECLAMANTE/EXEQUENTE
- Estratégias devem focar em DEFESA: contestar alegações, arguir preliminares de defesa, demonstrar improcedência
- Vícios a detectar: vícios NOS ATOS DO AUTOR (inicial inepta, ilegitimidade ativa, falta de interesse de agir)
- Vícios a detectar: vícios NOS ATOS DO JUIZ que prejudicaram a defesa (cerceamento de defesa)
- NÃO sugerir teses de ataque (como condenação do réu em danos)
- Peças típicas: Contestação, Exceções, Embargos, Impugnação, Contrarrazões
` : poloDefinitivo === "AUTOR" ? `
VOCÊ ESTÁ FAZENDO ANÁLISE DE ATAQUE (AUTOR):
- O cliente é o AUTOR/RECLAMANTE/EXEQUENTE
- A parte contrária é o RÉU/RECLAMADO/EXECUTADO
- Estratégias devem focar em ATAQUE: fundamentar pretensão, demonstrar direito, pedir condenação
- Vícios a detectar: vícios NOS ATOS DO RÉU (contestação intempestiva, revelia)
- Vícios a detectar: vícios NOS ATOS DO JUIZ que prejudicaram o autor
- NÃO sugerir teses de defesa (como ilegitimidade passiva)
- Peças típicas: Petição inicial, Réplica, Recurso de Apelação, Memoriais
` : `
POLO INDEFINIDO - Identifique no texto quem é o cliente e adapte a análise.
`}

REGRA ABSOLUTA: TODAS as estratégias, vícios e sugestões de peças devem ser COERENTES com o polo ${poloDefinitivo}.

==================== DADOS PRÉ-EXTRAÍDOS (TIMELINE-FIRST) ====================
${payload.preExtracted ? `
⚠️ IMPORTANTE: Os dados abaixo já foram extraídos localmente com alta precisão.
USE-OS COMO BASE. Sua tarefa é VALIDAR e ENRIQUECER, não recriar do zero.

TIMELINE LOCAL (${payload.preExtracted.timeline?.length || 0} eventos):
${JSON.stringify(payload.preExtracted.timeline?.slice(0, 15) || [], null, 2)}
${(payload.preExtracted.timeline?.length || 0) > 15 ? `... e mais ${(payload.preExtracted.timeline?.length || 0) - 15} eventos` : ""}

PARTES EXTRAÍDAS:
- Autores: ${payload.preExtracted.partes?.autores?.join(", ") || "não extraídos"}
- Réus: ${payload.preExtracted.partes?.reus?.join(", ") || "não extraídos"}

CAPA DO PROCESSO:
- CNJ: ${payload.preExtracted.capa?.cnj || "não identificado"}
- Vara: ${payload.preExtracted.capa?.vara || "não identificada"}
- Classe: ${payload.preExtracted.capa?.classe || "não identificada"}
- Comarca: ${payload.preExtracted.capa?.comarca || "não identificada"}
- Assuntos: ${payload.preExtracted.capa?.assuntos?.map(a => a.descricao).join("; ") || "não identificados"}

${payload.preExtracted.dadosContrato ? `
DADOS CONTRATUAIS (CCB/Bancário):
- Número: ${payload.preExtracted.dadosContrato.numeroContrato || "N/A"}
- Data: ${payload.preExtracted.dadosContrato.dataOperacao || "N/A"}
- Valor: R$ ${payload.preExtracted.dadosContrato.valorOriginal?.toLocaleString("pt-BR") || "N/A"}
- Taxa Juros: ${payload.preExtracted.dadosContrato.taxaJurosMensal || "N/A"}% a.m.
- Parcelas: ${payload.preExtracted.dadosContrato.parcelas || "N/A"}
` : ""}

${payload.preExtracted.prescricaoCalculada ? `
PRESCRIÇÃO CALCULADA:
- Status: ${payload.preExtracted.prescricaoCalculada.status}
- Tipo Título: ${payload.preExtracted.prescricaoCalculada.tipoTitulo || "N/A"}
- Prazo: ${payload.preExtracted.prescricaoCalculada.prazoAnos || "N/A"} anos
- Dias Restantes: ${payload.preExtracted.prescricaoCalculada.diasRestantes ?? "N/A"}
- Alertas: ${payload.preExtracted.prescricaoCalculada.alertas?.join("; ") || "nenhum"}
` : ""}

${payload.preExtracted.viciosPreDetectados?.length ? `
VÍCIOS PRÉ-DETECTADOS (${payload.preExtracted.viciosPreDetectados.length}):
${payload.preExtracted.viciosPreDetectados.map(v => `- ${v.code}: ${v.notas} (${v.confidence || "MEDIA"})`).join("\n")}

⚠️ INCORPORE estes vícios na sua análise. Adicione os que faltarem, mas NÃO remova os já detectados.
` : ""}

` : "Nenhum dado pré-extraído disponível. Extraia do texto bruto."}

==================== DADOS DO CASO (METADADOS DO SISTEMA) ====================

RAMO DO DIREITO: ${payload.ramoHint || "não informado - detectar do texto"}
FASE SUGERIDA: ${payload.faseHint || "não informada - detectar do texto"}

DADOS DO PROCESSO:
- Título: ${caseMeta.titulo || "não informado"}
- Número: ${caseMeta.numero || "não informado"}
- Vara: ${caseMeta.vara || "não informada"}
- Comarca: ${caseMeta.comarca || "não informada"}

NOSSO CLIENTE (${poloDefinitivo === "REU" ? "RÉU/RECLAMADO" : poloDefinitivo === "AUTOR" ? "AUTOR/RECLAMANTE" : "a identificar"}):
- Nome: ${clientMeta.nome || "não informado"}
- Papel declarado: ${clientMeta.papel || "não informado"}

PARTE CONTRÁRIA (${poloDefinitivo === "REU" ? "AUTOR/RECLAMANTE" : poloDefinitivo === "AUTOR" ? "RÉU/RECLAMADO" : "a identificar"}):
- Nome: ${opponentMeta.nome || "não informado"}
- Papel declarado: ${opponentMeta.papel || "não informado"}

OBSERVAÇÕES DO ADVOGADO:
${payload.observacoes || "nenhuma observação adicional"}

==================== DETECÇÃO AUTOMÁTICA DE POLO ====================

Polo detectado automaticamente: ${payload.poloDetected || "não detectado"}
Fonte da detecção: ${payload.poloSource || "N/A"}
Confiança: ${payload.poloConfidence ? (payload.poloConfidence * 100).toFixed(0) + "%" : "N/A"}
Evidências:
${(payload.poloEvidences || []).slice(0, 3).map((e: string) => `  • ${e}`).join('\n') || "  Nenhuma"}

POLO DEFINITIVO (CONFIRMADO PELO ADVOGADO): ${poloDefinitivo}

LEMBRETE CRÍTICO:
- O campo "poloAtuacao" no JSON de saída DEVE ser: "${poloDefinitivo}"
- As estratégias em "estrategias.principais[].recomendadaPara" devem incluir "${poloDefinitivo}"
- NUNCA sugira teses incompatíveis com o polo (ex: se somos RÉU, não sugira "condenar o réu")
- Se houver vícios pré-detectados, INCLUA-OS no array "vicios" com os dados enriquecidos

==================== TEXTO INTEGRAL DO PROCESSO (RAW TEXT) ====================

${payload.rawText}
`;

    console.log("[NIJA_FULL] Chamando AI gateway...");

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT_FULL },
            { role: "user", content: userPrompt },
          ],
          stream: false,
        }),
      },
    );

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errorText = await aiResponse.text();
      console.error("[NIJA_FULL] Erro AI gateway:", status, errorText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao processar análise integrada do NIJA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResponse.json();
    const content: string = aiData.choices?.[0]?.message?.content || "";

    if (!content) {
      console.error("[NIJA_FULL] Resposta vazia do modelo.");
      return new Response(
        JSON.stringify({ error: "Resposta vazia do serviço de IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Remover possíveis fences ```json ... ```
    let jsonContent = content.trim();
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith("```")) {
      jsonContent = jsonContent.slice(0, -3);
    }

    let parsed: NijaFullAnalysisResult;
    try {
      parsed = JSON.parse(jsonContent.trim());
    } catch (e) {
      console.error("[NIJA_FULL] Falha ao fazer JSON.parse direto. Tentando extrair bloco JSON...", e);

      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        return new Response(
          JSON.stringify({ error: "Formato de resposta inválido. Não foi possível localizar JSON." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      try {
        parsed = JSON.parse(match[0]);
      } catch (e2) {
        console.error("[NIJA_FULL] Falha ao parsear JSON extraído:", e2);
        return new Response(
          JSON.stringify({ error: "Não foi possível processar a resposta da IA." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    console.log("[NIJA_FULL] Análise integrada gerada com sucesso.");

    // Post-processing: Ensure polo matches poloDefinitivo
    if (!parsed.meta) {
      parsed.meta = {
        ramo: "INDEFINIDO",
        ramoConfiavel: false,
        faseProcessual: "INDEFINIDO",
        poloAtuacao: poloDefinitivo,
        grauRiscoGlobal: "MEDIO",
        resumoTatico: ""
      };
    }

    const normalizedParsedPolo = (parsed.meta.poloAtuacao || "").toUpperCase().trim();
    const normalizedDefinitivo = (poloDefinitivo || "INDEFINIDO").toUpperCase().trim();

    if (normalizedParsedPolo !== normalizedDefinitivo && normalizedDefinitivo !== "INDEFINIDO") {
      console.warn(`[NIJA_FULL] Corrigindo polo de ${parsed.meta.poloAtuacao} para ${poloDefinitivo}`);
      parsed.meta.poloAtuacao = poloDefinitivo;
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[NIJA_FULL] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
