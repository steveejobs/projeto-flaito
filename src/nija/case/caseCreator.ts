// src/nija/case/caseCreator.ts
// Criação automática de caso a partir da extração EPROC SEM IA

import { supabase } from "@/integrations/supabase/client";
import type { EprocExtractionResult } from "@/nija/extraction/mode";
import type { NijaAnalyzerResponse } from "@/nija/core/analyzer";
import { validateCNJ } from "@/nija/connectors/cnj/validator";
import {
  saveEventSegments,
  mapCategoryToNature,
  type EventSegmentInput,
  type DocumentNature,
} from "@/nija/extraction/eventSegments";
import { inferCategoryFromText } from "@/nija/connectors/eproc/eventDictionary";
import { getTjtoDictionaryCached, type TjtoDocEntry } from "@/nija/connectors/tjto/dictionary";
import { generateTimelineSummary } from "@/nija/extraction/timelineSummary";

export interface CreateCaseFromExtractionParams {
  extractionResult: EprocExtractionResult;
  analysisResult: NijaAnalyzerResponse;
  actingSide: "AUTOR" | "REU";
  clientName: string;
  opponentName: string;
  processNumber: string;
  lawyerName: string;
  oabNumber: string;
  vara: string;
  city: string;
  identifiedDocs?: Array<{ label: string; category: string }>;
  /** Document IDs to link to the created case */
  documentIds?: string[];
}

export interface CreateCaseResult {
  caseId: string;
  clientId: string;
}

/**
 * Constrói um título automático baseado EXCLUSIVAMENTE nos dados da V2
 * PRIORIDADE: tipoAcao > CNJ > Partes identificadas
 * SEM FALLBACKS genéricos de texto solto
 */
function buildAutoTitle(params: CreateCaseFromExtractionParams): string {
  const PLACEHOLDER = "Não identificado nos documentos analisados";
  
  // Função auxiliar para verificar valor válido
  const isValid = (val: string | undefined | null): val is string => 
    !!val && val.trim() !== "" && val !== PLACEHOLDER && 
    val.toLowerCase() !== "undefined" &&
    !val.toLowerCase().includes("sociedade mercantil") &&
    !val.toLowerCase().includes("sociedade empresária");
  
  // FORMATO SOLICITADO: [CNJ] - [Tipo de Ação] - [Autor]
  // SEM "x [Réu]" duplicado
  const parts: string[] = [];

  // PRIORIDADE 1: CNJ formatado (com pontos) para título legível
  if (isValid(params.processNumber)) {
    const digitsOnly = params.processNumber.replace(/\D/g, "").trim();
    // Formatar para leitura humana: NNNNNNN-DD.AAAA.J.TR.OOOO
    if (digitsOnly.length === 20) {
      const proc = digitsOnly.substring(0, 7);
      const dv = digitsOnly.substring(7, 9);
      const year = digitsOnly.substring(9, 13);
      const justice = digitsOnly.substring(13, 14);
      const court = digitsOnly.substring(14, 16);
      const origin = digitsOnly.substring(16, 20);
      parts.push(`${proc}-${dv}.${year}.${justice}.${court}.${origin}`);
    } else {
      parts.push(digitsOnly);
    }
  }

  // PRIORIDADE 2: Tipo de ação (ex: "Execução de Título Extrajudicial")
  const tipoAcao = params.extractionResult.capa.tipoAcao;
  if (isValid(tipoAcao)) {
    // Usar o tipo de ação EXATO sem truncar se for <= 50 chars
    const actionClean = tipoAcao.length > 50 ? tipoAcao.slice(0, 47) + "..." : tipoAcao;
    parts.push(actionClean);
  }

  // PRIORIDADE 3: Autor APENAS (sem réu, sem duplicação)
  // Usar autores extraídos se disponíveis
  const autoresExtraidos = params.extractionResult.peticaoInicial.autores;
  const autorPrincipal = autoresExtraidos?.[0];
  
  if (isValid(autorPrincipal)) {
    // Pegar apenas os primeiros 2-3 nomes para não ficar muito longo
    const shortAutor = autorPrincipal.split(/[\s\-,]+/).slice(0, 3).join(" ");
    parts.push(shortAutor);
  } else if (isValid(params.clientName) && params.actingSide === "AUTOR") {
    // Fallback: usar clientName APENAS se for o autor
    const shortClient = params.clientName.split(/[\s\-,]+/).slice(0, 3).join(" ");
    parts.push(shortClient);
  } else if (isValid(params.opponentName) && params.actingSide === "REU") {
    // Se somos o réu, o autor é o oponente
    const shortOpponent = params.opponentName.split(/[\s\-,]+/).slice(0, 3).join(" ");
    parts.push(shortOpponent);
  }

  // Retorna título construído ou fallback mínimo
  if (parts.length > 0) {
    return parts.join(" - ");
  }

  // Fallback MÍNIMO - sem dados inventados
  return `Caso NIJA - ${new Date().toLocaleDateString("pt-BR")}`
}

/**
 * Maps TJTO code to DocumentNature using integrated dictionary
 */
function mapTjtoCodeToNature(code: string | null | undefined, dict: Record<string, TjtoDocEntry>): DocumentNature {
  if (!code) return "sistemico";
  
  const upperCode = code.toUpperCase();
  const entry = dict[upperCode];
  
  if (entry?.category) {
    return mapCategoryToNature(entry.category);
  }
  
  // Fallback: infer from code pattern
  // PET = petition, DECDESPA/DESPACHO = decision, CERT = communication, etc.
  if (/^PET/i.test(upperCode) || /^INIC/i.test(upperCode)) return "peticao";
  if (/^DEC|^DESP|^SENT/i.test(upperCode)) return "decisao";
  if (/^CERT|^INT|^NOT|^MAND/i.test(upperCode)) return "comunicacao";
  if (/^PROC|^SUBS/i.test(upperCode)) return "procuracao";
  if (/^DOC|^ANX|^COMP/i.test(upperCode)) return "anexo";
  
  return "sistemico";
}

/**
 * Salva eventos detectados na tabela case_events e case_event_segments
 * GARANTIA DE PERSISTÊNCIA: Aguarda o case_id e salva TODOS os segmentos
 */
async function saveEventsToCase(
  caseId: string,
  officeId: string,
  eventos: EprocExtractionResult["eventos"],
  userId: string | null
): Promise<{ eventsCount: number; segmentsCount: number }> {
  if (!eventos || eventos.length === 0) {
    console.warn("[caseCreator] saveEventsToCase: Nenhum evento para salvar");
    return { eventsCount: 0, segmentsCount: 0 };
  }
  
  if (!caseId) {
    console.error("[caseCreator] CRITICAL: case_id is null/undefined - cannot save events");
    throw new Error("case_id é obrigatório para salvar eventos");
  }
  
  console.log(`[caseCreator] saveEventsToCase: Salvando ${eventos.length} eventos no caso ${caseId}`);

  // Load TJTO dictionary for document nature mapping
  const tjtoDict = await getTjtoDictionaryCached();
  console.log(`[caseCreator] TJTO dictionary loaded with ${Object.keys(tjtoDict).length} entries`);

  try {
    // Remove previous events with source=NIJA_DETECTION
    const { error: deleteError } = await supabase
      .from("case_events")
      .delete()
      .eq("case_id", caseId)
      .eq("source", "NIJA_DETECTION");
    
    if (deleteError) {
      console.warn("[caseCreator] Erro ao limpar eventos antigos:", deleteError);
    }

    // Prepare events for insertion - normalize dates (accept 2010+ old cases)
    const eventsToInsert = eventos.map((evento, idx) => {
      let isoDate: string | null = null;
      if (evento.data && evento.data !== "Não identificado nos documentos analisados") {
        const parts = evento.data.split("/").map(Number);
        if (parts.length === 3) {
          const [day, month, year] = parts;
          // Validate: day 1-31, month 1-12, year 1900-2100 (accept old 2010 cases)
          if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
            isoDate = new Date(year, month - 1, day).toISOString();
          }
        }
      }

      return {
        case_id: caseId,
        event_type: evento.tipoEvento || "DOCUMENTO",
        title: evento.labelEnriquecido || evento.descricaoLiteral?.slice(0, 200) || `Evento ${evento.numeroEvento || idx + 1}`,
        created_by: userId,
        source: "NIJA_DETECTION",
        payload: {
          date: evento.data,
          hora: evento.hora,
          fullDescription: evento.descricaoLiteral,
          code: evento.codigoTjto || null,
          enrichedLabel: evento.labelEnriquecido || null,
          eventNumber: evento.numeroEvento || idx + 1,
          documentoVinculado: evento.documentoVinculado || null,
          source: "NIJA_DETECTION",
          detectedAt: isoDate,
          // NOVO: incluir peças anexas agrupadas
          pecasAnexas: (evento as any).pecasAnexas || [],
        },
      };
    });

    console.log(`[caseCreator] Inserindo ${eventsToInsert.length} eventos...`);

    const { data: insertedEvents, error } = await supabase
      .from("case_events")
      .insert(eventsToInsert)
      .select("id");

    if (error) {
      console.error("[caseCreator] Erro ao salvar eventos:", error);
      return { eventsCount: 0, segmentsCount: 0 };
    }

    const eventsCount = insertedEvents?.length || 0;
    console.log(`[caseCreator] ✅ ${eventsCount} eventos salvos no caso ${caseId}`);

    // GARANTIA: Save segments for EACH event with TJTO dictionary integration
    let segmentsCount = 0;
    if (insertedEvents && insertedEvents.length > 0) {
      const segments: EventSegmentInput[] = [];

      for (let i = 0; i < eventos.length; i++) {
        const evento = eventos[i];
        const insertedEvent = insertedEvents[i];
        
        if (!insertedEvent?.id) {
          console.warn(`[caseCreator] Evento ${i} não tem ID inserido, pulando segmento`);
          continue;
        }

        // Convert date to ISO - accept old dates (2010+)
        let eventDate: string | null = null;
        if (evento.data && evento.data !== "Não identificado nos documentos analisados") {
          const parts = evento.data.split("/").map(Number);
          if (parts.length === 3) {
            const [day, month, year] = parts;
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
              eventDate = new Date(year, month - 1, day).toISOString();
            }
          }
        }

        // INTEGRATED DICTIONARY: Map TJTO code to document_nature
        const tjtoCode = evento.codigoTjto || null;
        const nature = mapTjtoCodeToNature(tjtoCode, tjtoDict);
        
        // Get enriched label from dictionary if available
        let enrichedLabel = evento.labelEnriquecido;
        if (tjtoCode && tjtoDict[tjtoCode.toUpperCase()]) {
          enrichedLabel = tjtoDict[tjtoCode.toUpperCase()].label;
        }

        // Confidence based on dictionary match
        const confidence: "high" | "medium" | "low" = 
          (tjtoCode && tjtoDict[tjtoCode.toUpperCase()]) ? "high" : 
          tjtoCode ? "medium" : "low";

        segments.push({
          caseId,  // CRITICAL: case_id is passed here
          eventId: insertedEvent.id,
          officeId,
          seqNumber: evento.numeroEvento || i + 1,
          eventDate,
          rawDescription: evento.descricaoLiteral || "",
          documentNature: nature,
          label: enrichedLabel || evento.descricaoLiteral?.slice(0, 100) || `Evento ${evento.numeroEvento || i + 1}`,
          tjtoCode,
          excerpt: evento.descricaoLiteral?.slice(0, 500) || null,
          confidence,
        });
      }

      if (segments.length > 0) {
        console.log(`[caseCreator] Salvando ${segments.length} segmentos com case_id=${caseId}...`);
        const segmentResult = await saveEventSegments(segments);
        if (segmentResult.success) {
          segmentsCount = segmentResult.count;
          console.log(`[caseCreator] ✅ ${segmentsCount} segmentos salvos na Auditoria Forense`);
        } else {
          console.error("[caseCreator] ❌ Erro ao salvar segmentos:", segmentResult.error);
        }
      }
    }
    
    return { eventsCount, segmentsCount };
  } catch (err) {
    console.error("[caseCreator] Falha crítica ao salvar eventos:", err);
    throw err;
  }
}

/**
 * Cria um caso automaticamente a partir dos dados extraídos do EPROC
 * SEM chamar nenhuma Edge Function de IA
 */
export async function createCaseFromExtraction(
  params: CreateCaseFromExtractionParams
): Promise<CreateCaseResult> {
  const {
    extractionResult,
    analysisResult,
    actingSide,
    clientName,
    opponentName,
    processNumber,
    lawyerName,
    oabNumber,
    vara,
    city,
    identifiedDocs,
  } = params;

  // 1) Buscar o office_id do usuário atual
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    throw new Error("Usuário não autenticado. Faça login para criar um caso.");
  }

  const { data: memberData, error: memberError } = await supabase
    .from("office_members")
    .select("office_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memberError) {
    console.error("[caseCreator] Erro ao buscar office:", memberError);
    throw new Error("Não foi possível identificar o escritório ativo.");
  }

  if (!memberData?.office_id) {
    throw new Error("Nenhum escritório ativo encontrado.");
  }

  const officeId = memberData.office_id;

  // 2) Buscar ou criar cliente com dados detalhados da extração
  const clientNameToUse = clientName?.trim() || "NIJA - Cliente Automático";

  // Buscar dados detalhados das partes extraídas
  const autoresDetalhados = extractionResult.peticaoInicial.autoresDetalhados || [];
  const reusDetalhados = extractionResult.peticaoInicial.reusDetalhados || [];
  
  // Determinar qual lista usar baseado no actingSide
  const partesCliente = actingSide === "AUTOR" ? autoresDetalhados : reusDetalhados;
  
  // Encontrar a parte que corresponde ao nome do cliente
  const parteClienteMatch = partesCliente.find(
    p => p.nome && clientNameToUse.toUpperCase().includes(p.nome.toUpperCase().split(/\s+/)[0])
  ) || partesCliente[0]; // fallback para a primeira parte

  // Extrair documento (CPF/CNPJ) da parte correspondente
  const clientDocument = parteClienteMatch?.documento?.replace(/\D/g, "") || null;
  const clientTipo = parteClienteMatch?.tipo;
  
  // Cidade da comarca (da capa do processo)
  const comarcaCity = extractionResult.capa.comarca?.replace(/^Comarca de\s*/i, "").trim() || city || null;

  const { data: existingClient } = await supabase
    .from("clients")
    .select("id")
    .eq("office_id", officeId)
    .eq("full_name", clientNameToUse)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  let clientId: string;

  if (existingClient?.id) {
    clientId = existingClient.id;
    console.log("[caseCreator] Cliente existente encontrado:", clientId);
  } else {
    const upperName = clientNameToUse.toUpperCase();
    const isPJ = clientTipo === "PJ" || /\b(LTDA|S\.?A\.?|ME|EPP|EIRELI|SOCIEDADE|COMERCIO|INDUSTRIA|EMPRESA)\b/.test(upperName);

    // Preparar dados do cliente com informações extraídas
    const clientInsertData = {
      office_id: officeId,
      created_by: userId,
      full_name: clientNameToUse,
      person_type: isPJ ? "PJ" as const : "PF" as const,
      source: "NIJA",
      ai_extracted: true,
      notes: "Cliente identificado automaticamente pela NIJA.",
      cpf: (!isPJ && clientDocument && clientDocument.length >= 11) ? clientDocument : null,
      cnpj: (isPJ && clientDocument && clientDocument.length >= 11) ? clientDocument : null,
      city: comarcaCity || null,
    };

    console.log("[caseCreator] Criando cliente com dados:", clientInsertData);

    const { data: newClient, error: newClientError } = await supabase
      .from("clients")
      .insert(clientInsertData)
      .select("id")
      .single();

    if (newClientError || !newClient?.id) {
      console.error("[caseCreator] Erro ao criar cliente:", newClientError);
      throw new Error("Falha ao criar cliente para o caso.");
    }

    clientId = newClient.id;
    console.log("[caseCreator] Novo cliente criado:", clientId, "com CPF/CNPJ:", clientDocument || "N/A");
  }

  // 3) Construir título automático
  const tituloAuto = buildAutoTitle(params);
  // Valores válidos para stage: pre_processual, judicializado, arquivado
  const stage = "pre_processual";
  const sideFinal: "ATAQUE" | "DEFESA" = actingSide === "AUTOR" ? "ATAQUE" : "DEFESA";

  console.log("[caseCreator] Criando caso via RPC", {
    clientId,
    tituloAuto,
    stage,
    side: sideFinal,
  });

  // 4) Criar caso via RPC (bypass RLS)
  const { data: rpcCaseId, error: caseRpcError } = await supabase.rpc(
    "lexos_nija_create_case",
    {
      p_client_id: clientId,
      p_side: sideFinal,
      p_title: tituloAuto,
      p_stage: stage,
      p_subject_id: null,
    }
  );

  if (caseRpcError || !rpcCaseId) {
    console.error("[caseCreator] RPC falhou:", caseRpcError);
    throw caseRpcError ?? new Error("Falha ao criar caso via RPC.");
  }

  const caseId = rpcCaseId as string;
  console.log("[caseCreator] Caso criado", { caseId });

  // 5) UPDATE campos extras
  const extraFields: Record<string, unknown> = {};
  const PLACEHOLDER = "Não identificado nos documentos analisados";

  // Função auxiliar para verificar se valor é válido (não vazio e não placeholder)
  const isValidValue = (val: string | undefined | null): val is string => {
    return !!val && val.trim() !== "" && val !== PLACEHOLDER;
  };
  
  // Sanitização extrema do CNJ (remove espaços especiais e normaliza traço/ponto)
  const sanitizeCnjSource = (cnj: string): string => {
    return (cnj || "")
      .replace(/\u00A0/g, "")
      .replace(/\s/g, "")
      .replace(/[–—]/g, "-")
      .replace(/[^\d.-]/g, "")
      .trim();
  };

  // Função para extrair 20 dígitos do CNJ (a partir da string sanitizada)
  const extractCnjDigits = (cnj: string): string => {
    const sanitized = sanitizeCnjSource(cnj);
    const digits = sanitized.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 20) return digits;
    if (digits.length < 20) return digits.padStart(20, "0");
    return digits.slice(0, 20);
  };

  // Função para aplicar máscara CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (25 chars)
  const applyCnjMask = (digits: string): string => {
    if (digits.length !== 20) return "";
    const proc = digits.substring(0, 7);
    const dv = digits.substring(7, 9);
    const year = digits.substring(9, 13);
    const justice = digits.substring(13, 14);
    const court = digits.substring(14, 16);
    const origin = digits.substring(16, 20);
    return `${proc}-${dv}.${year}.${justice}.${court}.${origin}`.trim();
  };

  // CNJ - enviar COM MÁSCARA (banco exige formato NNNNNNN-DD.AAAA.J.TR.OOOO)
  if (isValidValue(processNumber)) {
    // SANITIZAR IMEDIATAMENTE a entrada (remove NBSP, zero-width, e espaços invisíveis)
    const sanitizedInput = processNumber
      .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, '')
      .replace(/\s/g, '')
      .trim();
    
    const digits = extractCnjDigits(sanitizedInput);

    if (digits.length === 20) {
      const maskedCnjForRpc = applyCnjMask(digits).trim();

      // Sanitização ASCII Pura + remoção explícita de espaços internos
      // (remove quaisquer caracteres fora do intervalo ASCII imprimível e qualquer whitespace residual)
      const finalCnj = maskedCnjForRpc
        .replace(/\s/g, "")
        .replace(/[^\x20-\x7E]/g, "")
        .trim();

      console.log("DEBUG CNJ:", finalCnj, "Length:", finalCnj.length);
      console.log("DEBUG CNJ encoded:", encodeURIComponent(finalCnj));

      if (finalCnj.length === 25) {
        extraFields.cnj_number = finalCnj;
        console.log("CNJ formatado enviado ao RPC:", finalCnj);
      } else {
        console.warn("[caseCreator] CNJ máscara inválida:", finalCnj.length, "esperado: 25");
      }
    } else if (digits.length > 0) {
      console.warn("[caseCreator] CNJ inválido (dígitos):", digits.length, "esperado: 20");
    }
  }

  // Oponente (nome e documento)
  if (isValidValue(opponentName)) {
    extraFields.opponent_name = opponentName;
  }
  
  // CPF/CNPJ do oponente (extraído das partes)
  const partesOponente = actingSide === "AUTOR" ? reusDetalhados : autoresDetalhados;
  const oponenteMatch = partesOponente.find(
    p => p.nome && opponentName?.toUpperCase().includes(p.nome.toUpperCase().split(/\s+/)[0])
  ) || partesOponente[0];
  
  if (oponenteMatch?.documento) {
    const docLimpo = oponenteMatch.documento.replace(/\D/g, "");
    if (docLimpo.length >= 11) {
      extraFields.opponent_doc = docLimpo;
      console.log("[caseCreator] opponent_doc extraído:", docLimpo);
    }
  }

  // Vara como court_name
  if (isValidValue(vara)) {
    extraFields.court_name = vara;
  }

  // Comarca
  if (isValidValue(city)) {
    extraFields.comarca = city;
  }

  // Advogado
  if (isValidValue(lawyerName)) {
    extraFields.lawyer_name = lawyerName;
  }

  // OAB
  if (isValidValue(oabNumber)) {
    extraFields.oab_number = oabNumber;
  }

  // Documentos identificados
  if (identifiedDocs && identifiedDocs.length > 0) {
    extraFields.identified_docs = identifiedDocs;
  }

  // Área/ramo detectado
  if (analysisResult.ramoFinal) {
    extraFields.area = analysisResult.ramoFinal;
  }
  
  // === NOVOS CAMPOS DA EXTRAÇÃO ===
  
  // Tipo de ação (ex: "EXECUÇÃO DE TÍTULO EXTRAJUDICIAL")
  const tipoAcao = extractionResult.capa.tipoAcao;
  if (isValidValue(tipoAcao)) {
    extraFields.subtype = tipoAcao;
  }
  
  // Data de autuação (converter DD/MM/YYYY para ISO)
  const dataAutuacao = extractionResult.capa.dataAutuacao;
  if (isValidValue(dataAutuacao)) {
    const parts = dataAutuacao.split(/[\s\/]+/).filter(Boolean);
    if (parts.length >= 3) {
      const [day, month, year] = parts.map(Number);
      if (day && month && year && day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        const isoDate = new Date(year, month - 1, day).toISOString();
        extraFields.judicialized_at = isoDate;
      }
    }
  }
  
  // Nome do juiz (campo capa.juiz)
  const juiz = extractionResult.capa.juiz;
  if (isValidValue(juiz)) {
    // Salvar juiz no summary se não tiver resumo ainda
    if (!extraFields.summary) {
      extraFields.summary = `Juiz: ${juiz}`;
    }
  }

  // Análise heurística completa (SEM IA)
  const nijaAnalysisData = {
    meta: {
      ramo: analysisResult.ramoFinal || null,
      ramoConfiavel: !!analysisResult.ramoFinal,
      faseProcessual: "INICIAL",
      poloAtuacao: actingSide,
      grauRiscoGlobal: analysisResult.recommendation.findings.length > 3 ? "ALTO" : 
                       analysisResult.recommendation.findings.length > 0 ? "MEDIO" : "BAIXO",
      resumoTatico: analysisResult.recommendation.resumoTatico || "Análise heurística local sem IA.",
    },
    vicios: analysisResult.recommendation.findings.map((f) => ({
      codigo: f.defect.code,
      label: f.defect.label,
      gravidade: f.defect.severity === "CRITICA" ? "ALTA" : f.defect.severity === "ALTA" ? "ALTA" : "MEDIA",
      observacoes: f.notas || "",
    })),
    estrategias: {
      principais: analysisResult.recommendation.mainStrategies.map((s) => ({
        label: s.label,
        descricao: s.description,
        possiveisPecas: s.recommendedWhenDefects || [],
      })),
      secundarias: (analysisResult.recommendation.secondaryStrategies || []).map((s) => ({
        label: s.label,
        descricao: s.description,
      })),
    },
    source: "EXTRACTION_ONLY_LOCAL",
    createdAt: new Date().toISOString(),
  };

  extraFields.nija_full_analysis = nijaAnalysisData;
  extraFields.nija_full_last_run_at = new Date().toISOString();

  // PHASE 3: Gerar resumo automático dos andamentos
  if (extractionResult.eventos && extractionResult.eventos.length > 0) {
    const timelineSummary = generateTimelineSummary(extractionResult.eventos);
    console.log(`[caseCreator] Timeline summary generated: ${timelineSummary.qualidade} quality, ${timelineSummary.percentualComData}% com data`);
    
    // Usar resumo da timeline como summary principal
    if (timelineSummary.resumoTexto && timelineSummary.resumoTexto.length > 10) {
      extraFields.summary = timelineSummary.resumoTexto;
    }
  }

  // Fallback: Resumo tático como summary se não tiver resumo da timeline
  if (!extraFields.summary && analysisResult.recommendation.resumoTatico) {
    extraFields.summary = analysisResult.recommendation.resumoTatico;
  }

  if (Object.keys(extraFields).length > 0) {
    console.log("[caseCreator] extraFields a salvar:", JSON.stringify(extraFields, null, 2));
    console.log("[caseCreator] case_id para update:", caseId);

    // Usar RPC para bypass RLS (SECURITY DEFINER)
    const { data: rpcData, error: updateError } = await supabase.rpc(
      "lexos_nija_update_case_metadata",
      {
        p_case_id: caseId,
        p_patch: extraFields as unknown as Record<string, never>,
      }
    );

    console.log("[caseCreator] RPC result:", { data: rpcData, error: updateError });

    if (updateError) {
      console.error("[caseCreator] ❌ Falhou update extras via RPC:", updateError);
      
      // Fallback: tentar update direto (pode falhar por RLS)
      console.log("[caseCreator] Tentando update direto como fallback...");
      const updatePayload = {
        nija_full_analysis: extraFields.nija_full_analysis,
        nija_full_last_run_at: extraFields.nija_full_last_run_at,
        summary: extraFields.summary,
        area: extraFields.area,
        subtype: extraFields.subtype,
        opponent_name: extraFields.opponent_name,
      };
      const { error: directError } = await supabase
        .from("cases")
        .update(updatePayload as never)
        .eq("id", caseId);
      
      if (directError) {
        console.error("[caseCreator] ❌ Fallback direto também falhou:", directError);
      } else {
        console.log("[caseCreator] ✅ Fallback direto funcionou");
      }
    } else {
      console.log("[caseCreator] ✅ Metadados salvos com sucesso via RPC:", Object.keys(extraFields));
    }
  }

  // 6) Salvar eventos detectados - GARANTIA DE PERSISTÊNCIA
  let eventStats = { eventsCount: 0, segmentsCount: 0 };
  if (extractionResult.eventos && extractionResult.eventos.length > 0) {
    console.log(`[caseCreator] Iniciando persistência de ${extractionResult.eventos.length} eventos...`);
    eventStats = await saveEventsToCase(caseId, officeId, extractionResult.eventos, userId);
    console.log(`[caseCreator] ✅ Persistência completa: ${eventStats.eventsCount} eventos, ${eventStats.segmentsCount} segmentos`);
  } else {
    console.warn("[caseCreator] Nenhum evento para persistir");
  }

  // 7) Vincular documentos ao caso (update case_id nos documents)
  if (params.documentIds && params.documentIds.length > 0) {
    console.log(`[caseCreator] Vinculando ${params.documentIds.length} documento(s):`, params.documentIds);
    
    const { data: updatedDocs, error: docLinkError } = await supabase
      .from("documents")
      .update({ case_id: caseId })
      .in("id", params.documentIds)
      .select("id");

    if (docLinkError) {
      console.warn("[caseCreator] Erro ao vincular documentos:", docLinkError);
    } else {
      console.log(`[caseCreator] ${updatedDocs?.length ?? 0} documento(s) vinculado(s) ao caso ${caseId}`);
    }
  } else {
    console.warn("[caseCreator] Nenhum documentId fornecido para vincular ao caso");
  }

  return { caseId, clientId };
}
