import { supabase } from "@/integrations/supabase/client";

export type NijaFullAnalysisResult = {
  meta: {
    ramo: string;
    ramoConfiavel: boolean;
    faseProcessual: string;
    poloAtuacao: "AUTOR" | "REU" | "TERCEIRO" | "INDEFINIDO";
    grauRiscoGlobal: "BAIXO" | "MEDIO" | "ALTO";
    resumoTatico: string;
  };
  partes: {
    cliente?: {
      nome: string;
      papelProcessual: string;
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
  linhaDoTempo: {
    ordem: number;
    dataDetectada?: string;
    tipoAto: string;
    descricao: string;
    trecho?: string;
  }[];
  prescricao: {
    haPrescricao: boolean;
    tipo: "GERAL" | "INTERCORRENTE" | "NENHUMA" | "DUVIDOSA";
    fundamentacao: string;
    risco: "BAIXO" | "MEDIO" | "ALTO";
  };
  vicios: {
    codigo: string;
    label: string;
    natureza: "FORMAL" | "MATERIAL" | "MISTA";
    gravidade: "BAIXA" | "MEDIA" | "ALTA";
    atoRelacionado: string;
    trecho: string;
    fundamentosLegais: string[];
    observacoes: string;
  }[];
  estrategias: {
    principais: {
      label: string;
      descricao: string;
      recomendadaPara: string[];
      possiveisPecas: string[];
    }[];
    secundarias: {
      label: string;
      descricao: string;
    }[];
  };
  sugestaoPeca?: {
    tipo: string;
    tituloSugestao: string;
    focoPrincipal: string;
  };
};

/**
 * Mapeia faseProcessual da NIJA para o stage do caso
 */
function mapFaseToStage(fase?: string): string | null {
  if (!fase) return null;
  const lower = fase.toLowerCase();
  if (lower.includes("pré") || lower.includes("extra") || lower.includes("administrativ")) return "pre_processual";
  if (lower.includes("conhecimento") || lower.includes("instrução") || lower.includes("inicial")) return "conhecimento";
  if (lower.includes("recurso") || lower.includes("recursal") || lower.includes("apelação")) return "recursal";
  if (lower.includes("execução") || lower.includes("cumprimento")) return "execucao";
  return null;
}

/**
 * Mapeia poloAtuacao da NIJA para o side do caso
 */
function mapPoloToSide(polo?: string): "ATAQUE" | "DEFESA" | null {
  if (!polo) return null;
  if (polo === "AUTOR") return "ATAQUE";
  if (polo === "REU") return "DEFESA";
  return null;
}

export async function runNijaFullAnalysis(params: {
  caseId: string;
  rawText: string;
  ramoHint?: string | null;
  faseHint?: string | null;
  poloHint?: "AUTOR" | "REU" | "TERCEIRO" | "INDEFINIDO" | null;
}): Promise<NijaFullAnalysisResult> {
  const { caseId, rawText, ramoHint, faseHint, poloHint } = params;

  // NIJA Fase 1: Verificar reading_status dos documentos antes de chamar IA
  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select("id, reading_status, extracted_text_chars")
    .eq("case_id", caseId)
    .is("deleted_at", null);

  if (docsError) {
    console.error("[runNijaFullAnalysis] Erro ao buscar documentos:", docsError);
    throw new Error("Erro ao verificar status dos documentos.");
  }

  // Verificar se todos os documentos têm leitura suficiente
  const docsWithProblems = (documents || []).filter(doc => {
    const status = doc.reading_status;
    return !status || 
           status === "PENDING" || 
           status === "INSUFFICIENT_READING" || 
           status === "ERROR" || 
           status === "FALLBACK_CLIENT_PDFJS";
  });

  if (docsWithProblems.length > 0) {
    throw new Error(
      `LEITURA_INSUFICIENTE: ${docsWithProblems.length} documento(s) não foram lidos adequadamente. ` +
      `Reprocesse os documentos antes de rodar a análise.`
    );
  }

  const { data, error } = await supabase.functions.invoke("nija-full-analysis", {
    body: {
      rawText,
      ramoHint: ramoHint ?? null,
      faseHint: faseHint ?? null,
      poloHint: poloHint ?? null,
      caseMeta: {},
      clientMeta: {},
      opponentMeta: {},
      observacoes: null,
    },
  });

  // Safari fix: validate response before processing to prevent download behavior
  if (error) {
    const errorMessage = error.message || "Erro desconhecido";
    console.error("[runNijaFullAnalysis] Edge function error:", error);
    throw new Error(errorMessage);
  }

  if (!data || typeof data !== "object") {
    console.error("[runNijaFullAnalysis] Invalid response type:", typeof data);
    throw new Error("Resposta inválida do serviço NIJA");
  }

  if (data.error) {
    console.error("[runNijaFullAnalysis] API error:", data.error);
    throw new Error(data.error);
  }

  // Preparar campos adicionais a partir da análise
  const updateFields: Record<string, unknown> = {
    nija_full_analysis: data,
    nija_full_last_run_at: new Date().toISOString(),
  };

  // Salvar resumo tático como summary do caso
  if (data.meta?.resumoTatico) {
    updateFields.summary = data.meta.resumoTatico;
  }

  // Salvar ramo como area (se disponível e ainda não preenchido)
  if (data.meta?.ramo) {
    updateFields.area = data.meta.ramo;
  }

  // Salvar polo como side
  const mappedSide = mapPoloToSide(data.meta?.poloAtuacao);
  if (mappedSide) {
    updateFields.side = mappedSide;
  }

  // Salvar fase como stage
  const mappedStage = mapFaseToStage(data.meta?.faseProcessual);
  if (mappedStage) {
    updateFields.stage = mappedStage;
  }

  // Salvar número do processo se detectado
  if (data.processo?.numero) {
    updateFields.cnj_number = data.processo.numero;
  }

  // Persistir metadados no case via RPC (SECURITY DEFINER) para evitar bloqueio de RLS
  const { error: updateError } = await supabase.rpc("lexos_nija_update_case_metadata", {
    p_case_id: caseId,
    p_patch: JSON.parse(JSON.stringify(updateFields)),
  });

  if (updateError) throw updateError;

  return data as NijaFullAnalysisResult;
}

/**
 * Helper para consulta "solta" da NIJA.
 * Se não vier caseId, cria automaticamente um caso associado ao office do usuário.
 */
export type PreDetectedData = {
  clientName?: string;
  opponentName?: string;
  processNumber?: string;
  processYear?: string; // Ano extraído do CNJ (ex: "2016")
  courtName?: string;
  comarca?: string;
  lawyerName?: string;
  oabNumber?: string;
  actionType?: string; // Tipo de ação (ex: "Execução de Título Extrajudicial")
  identifiedDocs?: Array<{ label: string; category: string }>;
  // Eventos detectados do processo (timeline) - enriquecidos com dicionário eProc
  events?: Array<{
    date: string;
    description: string;
    code?: string;
    enrichedLabel?: string;
    eventNumber?: number;
    meaning?: string; // Significado do dicionário eProc
    category?: string; // Categoria do evento (CITACAO, INTIMACAO, etc.)
  }>;
};

/**
 * Constrói um título automático inteligente baseado nos dados pré-detectados
 */
function buildAutoTitle(preDetected?: PreDetectedData): string {
  const parts: string[] = [];

  // Tipo de ação (se detectado)
  if (preDetected?.actionType?.trim()) {
    // Limitar tamanho do tipo de ação
    const actionShort = preDetected.actionType.length > 50 
      ? preDetected.actionType.slice(0, 50) 
      : preDetected.actionType;
    parts.push(actionShort);
  }

  // CNJ (se detectado)
  if (preDetected?.processNumber?.trim()) {
    parts.push(preDetected.processNumber);
  }

  // Partes (se detectadas) - formato "Autor x Réu"
  if (preDetected?.opponentName && preDetected?.clientName) {
    // Resumir nomes longos (pegar primeiras 2-3 palavras significativas)
    const shortClient = preDetected.clientName.split(/[\s\-,]+/).slice(0, 2).join(" ");
    const shortOpponent = preDetected.opponentName.split(/[\s\-,]+/).slice(0, 2).join(" ");
    parts.push(`${shortOpponent} x ${shortClient}`);
  } else if (preDetected?.clientName) {
    const shortClient = preDetected.clientName.split(/[\s\-,]+/).slice(0, 3).join(" ");
    parts.push(shortClient);
  } else if (preDetected?.opponentName) {
    const shortOpponent = preDetected.opponentName.split(/[\s\-,]+/).slice(0, 3).join(" ");
    parts.push(`vs ${shortOpponent}`);
  }

  if (parts.length > 0) {
    return parts.join(" - ");
  }

  // Fallback: título genérico com data
  return `NIJA – Análise – ${new Date().toLocaleString("pt-BR")}`;
}

export async function runNijaFullAnalysisQuick(params: {
  rawText: string;
  ramoHint?: string | null;
  faseHint?: string | null;
  poloHint?: "AUTOR" | "REU" | "TERCEIRO" | "INDEFINIDO" | null;
  caseId?: string | null;
  titleHint?: string | null;
  preDetected?: PreDetectedData;
  subjectId?: string | null;
  side?: "ATAQUE" | "DEFESA" | null;
  // Polo detection metadata
  poloDetected?: "REU" | "AUTOR" | "INDEFINIDO" | null;
  poloSource?: string | null;
  poloConfidence?: number | null;
  poloEvidences?: string[] | null;
}): Promise<NijaFullAnalysisResult & { caseId: string }> {
  const {
    rawText,
    ramoHint = null,
    faseHint = null,
    poloHint = null,
    caseId: existingCaseId,
    titleHint,
    preDetected,
    subjectId = null,
    side = null,
    poloDetected = null,
    poloSource = null,
    poloConfidence = null,
    poloEvidences = null,
  } = params;

  try {
    if (!rawText || !rawText.trim()) {
      throw new Error("Texto para análise NIJA não pode ser vazio.");
    }

    // 0) Se já existe caseId, roda FULL e salva summary pós-FULL
    if (existingCaseId) {
      const fullResult = await runNijaFullAnalysis({
        caseId: existingCaseId,
        rawText,
        ramoHint,
        faseHint,
        poloHint,
      });
      const resumo = (fullResult as any)?.meta?.resumoTatico ?? null;
      if (resumo) {
        const { error: sErr } = await supabase.rpc("lexos_nija_update_case_metadata", {
          p_case_id: existingCaseId,
          p_patch: { summary: resumo },
        });
        if (sErr) console.warn("[NIJA_QUICK] falhou salvar summary:", sErr);
      }
      // Salvar eventos se fornecidos
      if (preDetected?.events && preDetected.events.length > 0) {
        await saveEventsToCase(existingCaseId, preDetected.events);
      }
      return { ...fullResult, caseId: existingCaseId };
    }

    // 1) Buscar o office_id do usuário atual
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      throw new Error("Usuário não autenticado. Faça login para usar a NIJA.");
    }

    const { data: memberData, error: memberError } = await supabase
      .from("office_members")
      .select("office_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (memberError) {
      console.error("[NIJA_QUICK] Erro ao buscar office:", memberError);
      throw new Error("Não foi possível identificar o escritório ativo.");
    }

    if (!memberData?.office_id) {
      throw new Error("Nenhum escritório ativo encontrado.");
    }

    const officeId = memberData.office_id;

    // 2) Buscar ou criar cliente
    const clientNameToUse = preDetected?.clientName?.trim() || "NIJA - Cliente Automático";
    
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
    } else {
      const upperName = clientNameToUse.toUpperCase();
      const isPJ = /\b(LTDA|S\.?A\.?|ME|EPP|EIRELI|SOCIEDADE|COMERCIO|INDUSTRIA|EMPRESA)\b/.test(upperName);
      
      const { data: newClient, error: newClientError } = await supabase
        .from("clients")
        .insert({
          office_id: officeId,
          created_by: userId,
          full_name: clientNameToUse,
          person_type: isPJ ? "PJ" : "PF",
          notes: clientNameToUse === "NIJA - Cliente Automático" 
            ? "Cliente criado automaticamente para análises NIJA soltas."
            : "Cliente identificado automaticamente pela NIJA.",
        })
        .select("id")
        .single();

      if (newClientError || !newClient?.id) {
        console.error("[NIJA_QUICK] Erro ao criar cliente:", newClientError);
        throw new Error("Falha ao criar cliente para o caso automático.");
      }

      clientId = newClient.id;
    }

    // ===============================
    // NIJA — CRIAÇÃO DE CASO (ROBUSTA)
    // ===============================
    const tituloAuto = titleHint?.trim() || buildAutoTitle(preDetected);
    const stage = "pre_processual";
    const sideFinal: "ATAQUE" | "DEFESA" = side ?? "ATAQUE";

    console.log("[NIJA_QUICK] criando case via RPC", {
      clientId,
      tituloAuto,
      stage,
      side: sideFinal,
      subjectId,
    });

    // RPC ao invés de INSERT direto (bypass RLS)
    const { data: rpcCaseId, error: caseRpcError } = await supabase.rpc(
      "lexos_nija_create_case",
      {
        p_client_id: clientId,
        p_side: sideFinal,
        p_title: tituloAuto,
        p_stage: stage,
        p_subject_id: subjectId ?? null,
      }
    );

    if (caseRpcError || !rpcCaseId) {
      console.error("[NIJA_QUICK] RPC lexos_nija_create_case falhou:", caseRpcError);
      throw caseRpcError ?? new Error("Falha ao criar caso via RPC (lexos_nija_create_case).");
    }

    const caseId = rpcCaseId as string;
    console.log("[NIJA_QUICK] case criado", { caseId });

    // UPDATE extras (não bloqueia)
    const extraFields: Record<string, any> = {};
    if (ramoHint) extraFields.area = ramoHint;
    if (preDetected?.processNumber) extraFields.cnj_number = preDetected.processNumber;
    if (preDetected?.opponentName) extraFields.opponent_name = preDetected.opponentName;
    if (preDetected?.courtName) extraFields.court_name = preDetected.courtName;
    if (preDetected?.comarca) extraFields.comarca = preDetected.comarca;
    if (preDetected?.lawyerName) extraFields.lawyer_name = preDetected.lawyerName;
    if (preDetected?.oabNumber) extraFields.oab_number = preDetected.oabNumber;
    if (preDetected?.identifiedDocs?.length) extraFields.identified_docs = preDetected.identifiedDocs;

    if (Object.keys(extraFields).length > 0) {
      // Persistir extras via RPC (SECURITY DEFINER) para evitar bloqueio de RLS
      const { error: updateError } = await supabase.rpc("lexos_nija_update_case_metadata", {
        p_case_id: caseId,
        p_patch: JSON.parse(JSON.stringify(extraFields)),
      });
      if (updateError) console.warn("[NIJA_QUICK] case criado, mas falhou update extras:", updateError);
    }

    // Salvar eventos detectados
    if (preDetected?.events?.length) {
      await saveEventsToCase(caseId, preDetected.events);
    }

    // Rodar FULL
    const fullResult = await runNijaFullAnalysis({
      caseId,
      rawText,
      ramoHint,
      faseHint,
      poloHint,
    });

    // Salvar summary pós-FULL
    const resumo = (fullResult as any)?.meta?.resumoTatico ?? null;
    if (resumo) {
      const { error: sErr } = await supabase.rpc("lexos_nija_update_case_metadata", {
        p_case_id: caseId,
        p_patch: { summary: resumo },
      });
      if (sErr) console.warn("[NIJA_QUICK] case criado, mas falhou salvar summary:", sErr);
    }

    return { ...fullResult, caseId };
  } catch (err) {
    console.error("[NIJA_QUICK] Erro fatal — NIJA não persistiu case:", err);
    throw err;
  }
}

/**
 * Salva eventos detectados na tabela case_events
 * Remove eventos anteriores com source=NIJA_DETECTION antes de inserir novos
 */
async function saveEventsToCase(
  caseId: string,
  events: Array<{
    date: string;
    description: string;
    code?: string;
    enrichedLabel?: string;
    eventNumber?: number;
  }>
): Promise<void> {
  if (!events || events.length === 0) return;

  try {
    // Buscar usuário atual
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id || null;

    // PASSO 1: Remover eventos anteriores com source=NIJA_DETECTION para evitar duplicatas
    const { error: deleteError } = await supabase
      .from("case_events")
      .delete()
      .eq("case_id", caseId)
      .eq("source", "NIJA_DETECTION");

    if (deleteError) {
      console.warn("[NIJA] Erro ao limpar eventos antigos:", deleteError);
      // Continuar mesmo com erro para inserir novos eventos
    }

    // PASSO 2: Preparar eventos para inserção
    const eventsToInsert = events.map((event) => {
      // Converter data DD/MM/AAAA para ISO
      let isoDate: string | null = null;
      if (event.date) {
        const [day, month, year] = event.date.split("/").map(Number);
        if (day && month && year) {
          isoDate = new Date(year, month - 1, day).toISOString();
        }
      }

      return {
        case_id: caseId,
        event_type: event.code || "DOCUMENTO",
        title: event.enrichedLabel || event.description.slice(0, 200),
        created_by: userId,
        source: "NIJA_DETECTION",
        payload: {
          date: event.date,
          fullDescription: event.description,
          code: event.code || null,
          enrichedLabel: event.enrichedLabel || null,
          eventNumber: event.eventNumber || null,
          detectedAt: isoDate,
        },
      };
    });

    // PASSO 3: Inserir novos eventos
    const { error } = await supabase.from("case_events").insert(eventsToInsert);

    if (error) {
      console.error("[NIJA] Erro ao salvar eventos:", error);
    } else {
      console.log(`[NIJA] ${eventsToInsert.length} eventos salvos no caso ${caseId}`);
    }
  } catch (err) {
    console.error("[NIJA] Falha ao salvar eventos:", err);
  }
}
