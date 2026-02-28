// src/hooks/useNijaExtraction.ts
// NIJA Extraction Hook - Handles file upload, text extraction, and document processing

import { useState, useRef, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  extractTextFromPdfFile, 
  type ExtractionResult, 
  saveExtractionToDatabase,
  enrichDoc, 
  type EnrichedDoc,
  extractProcessYear, 
  normalizeComarcaToCity, 
  normalizePartyPrefill,
  type QuickMetadata, 
  type ProcessEvent,
  isImagePdf, 
  getImagePdfReason,
  convertPdfPageToImage,
  convertPdfFirstPageToImage,
  saveEventSegments, 
  mapCategoryToNature, 
  type EventSegmentInput,
  getTjtoDictionaryCached,
  extractDocCode,
  getEprocEventDictionaryCached,
  inferCategoryFromText,
  type EprocEventCategory,
  // Bookmark extraction
  extractBookmarksFromPdfFile,
  type BookmarkExtractionResult,
  type EprocDocumentBookmark,
} from "@/nija";
import {
  OCR_MAX_PAGES,
  OCR_RETRIES,
  OCR_BACKOFF_MS,
  IMAGE_PDF_MIN_CHARS,
  MIN_CHARS_TOTAL,
} from "@/nija/extraction/constants";
import { validateCNJ, formatCNJ } from "@/nija/connectors/cnj/validator";
import { 
  logNijaStart, 
  logNijaSuccess, 
  logNijaError, 
  createNijaTimer 
} from "@/lib/nijaLogger";
import { supabase } from "@/integrations/supabase/client";
import { assertLexosChatPayload } from "@/contracts/lexosChatAssistant";


// ======================================================
// TYPES
// ======================================================

export interface ProcessFile {
  id: string;
  file: File;
  filename: string;
  size: number;
  status: "uploading" | "extracting" | "ready" | "error" | "image_pdf" | "ocr_processing";
  extractedText: string;
  errorMessage?: string;
  isImagePdf?: boolean;
  extractionResult?: ExtractionResult;
  extractionMethod?: "pdf_text" | "vision_ocr" | "text_file";
  // If linked to a document in DB
  documentId?: string;
  // PDF bookmarks/outlines extraction
  bookmarkResult?: BookmarkExtractionResult | null;
}

export interface ExtractionProgress {
  currentPage: number;
  totalPages: number;
  percent: number;
}

export interface UseNijaExtractionOptions {
  actingSide: "REU" | "AUTOR";
  clientName: string;
  opponentName: string;
  processNumber: string;
  vara: string;
  city: string;
  lawyerName: string;
  oabNumber: string;
  setClientName: (v: string) => void;
  setOpponentName: (v: string) => void;
  setProcessNumber: (v: string) => void;
  setProcessYear: (v: string) => void;
  setVara: (v: string) => void;
  setCity: (v: string) => void;
  setLawyerName: (v: string) => void;
  setOabNumber: (v: string) => void;
}

export interface NijaDocumentInput {
  id: string;
  filename: string;
  content: string;
  kind: "ARQUIVO_PROCESSO" | "DOCUMENTO_COMPLEMENTAR";
}

// ======================================================
// METADATA DETECTION (moved from Nija.tsx)
// ======================================================

// Imports already available from @/nija at top of file

async function detectProcessMetadataEprocV2(text: string): Promise<QuickMetadata> {
  console.log("--- INICIANDO EXTRAÇÃO V2 ---");
  
  const result: QuickMetadata = { events: [], defendants: [] };
  
  // Limpeza inicial para evitar quebras de regex com \r
  const cleanText = text.replace(/\r/g, "");
  
  // 1. CNJ (aceitar string crua, sanitizar e VALIDAR dígito verificador)
  const cnjMatch = cleanText.match(/\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4}/);
  if (cnjMatch) {
    // Sanitizar imediatamente: remove NBSP, zero-width chars, e espaços
    const rawCnj = cnjMatch[0]
      .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, '')
      .replace(/\s/g, '')
      .trim();
    
    // Validar dígito verificador antes de aceitar
    const validation = validateCNJ(rawCnj);
    
    if (validation.valid) {
      result.cnjNumber = formatCNJ(rawCnj);
      result.processYear = extractProcessYear(result.cnjNumber);
    } else {
      // Log silencioso - não quebrar fluxo
      logNijaError("useNijaExtraction", "CNJ_INVALID_MATCH", 
        { message: validation.error || "Dígito verificador inválido" },
        { payload: { rawCnj, error: validation.error } }
      );
      // Continuar sem CNJ - extração normal
    }
  }

  // 2. Autor e Réu - Abordagem V2.3: baseada em LINHAS para formato de colunas do eProc
  // O eProc exibe "AUTOR" e "RÉU" na mesma linha, com os nomes na linha ABAIXO
  const lines = cleanText.split('\n');
  const headerIndex = lines.findIndex(l => l.includes('Partes e Representantes'));
  console.log("[V2.3] headerIndex 'Partes e Representantes':", headerIndex);

  if (headerIndex !== -1) {
    const searchLines = lines.slice(headerIndex, headerIndex + 50);
    console.log("[V2.3] searchLines (primeiras 20):", searchLines.slice(0, 20));
    
    // Encontrar linha que contém AUTOR (pode estar junto com RÉU na mesma linha)
    const autorLineIdx = searchLines.findIndex(l => /\bAUTOR\b/i.test(l));
    const reuLineIdx = searchLines.findIndex(l => /\bR[ÉE]U\b/i.test(l));
    
    console.log("[V2.3] autorLineIdx:", autorLineIdx, "reuLineIdx:", reuLineIdx);
    
    // Helper: verificar se linha deve ser ignorada (páginas de separação, URLs, ruídos, saudações, etc.)
    // NÃO ignora nomes de empresas como "TRANSPORTADORA E CONSTRUTORA NORDESTE LTDA"
    const isIgnoredLine = (line: string): boolean => {
      if (!line) return true;
      const normalized = line
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!normalized) return true;

      const lower = normalized.toLowerCase();

      // Ignorar páginas de separação e marcas de escritório
      if (lower.includes("página de separação") || lower.includes("pagina de separacao")) return true;
      if (lower.includes("www.") || lower.includes("http")) return true;
      if (lower.includes("nwadv.com") || lower.includes("@")) return true;

      // Ignorar cabeçalhos de PDF/processo
      if (lower.includes("excelentíssimo") || lower.includes("excelentissimo")) return true;

      // Ignorar saudações, títulos honoríficos e termos comuns de ruído (inclui termos de endereço + verbos)
      // NÃO inclui "transportadora", "construtora", "nordeste" - são nomes válidos de empresas
      if (/(senhor|juiz|doutor|vara|comarca|excelent|página|pagina|evento|direito|direitos|processo|eletrônico|eletronico|através|atraves|mediante|procurador|endereço|endereco|conforme|respeitosamente|presença|presenca|subscreve|pessoa|jurídica|juridica|inscrita|bairro|cep|estado|jardim|campo grande|rua bahia|profissional|fundações|fundacoes|comunicações|comunicacoes|estilo|mandato|incluso|abaixo|assinados|propor|presente)/i.test(normalized)) return true;

      if (/^\s*evento\s*\d*/i.test(normalized)) return true;
      if (/^\s*página\s*\d*/i.test(normalized)) return true;

      return false;
    };

    // Helper: verificar se nome contém ruídos que invalidam a extração
    const hasNoiseInName = (name: string | undefined | null): boolean => {
      if (!name) return true;
      const normalized = name
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!normalized) return true;
      if (normalized.length < 5) return true;

      // REGEX ÚNICA (definitiva): força ruído em SENHOR/JUIZ/etc. + conectivos/verbos comuns + endereço + verbos
      // NÃO inclui "transportadora", "construtora", "nordeste" etc. que são nomes válidos de empresas
      if (/(senhor|juiz|doutor|vara|comarca|excelent|página|pagina|evento|direito|direitos|processo|eletrônico|eletronico|através|atraves|mediante|procurador|endereço|endereco|conforme|respeitosamente|presença|presenca|subscreve|pessoa|jurídica|juridica|inscrita|bairro|cep|estado|jardim|campo grande|rua bahia|profissional|fundações|fundacoes|comunicações|comunicacoes|estilo|mandato|incluso|abaixo|assinados|propor|presente)/i.test(normalized)) return true;
      
      // Detectar números de documento (nº seguido de dígitos)
      if (/^nº\s*\d+/i.test(normalized)) return true;
      if (/^\d{5,}/i.test(normalized)) return true; // sequência de 5+ dígitos = documento
      
      return false;
    };
    
    // Helper: extrair nome válido de uma linha
    const extractValidName = (line: string): string | null => {
      if (!line || isIgnoredLine(line)) return null;
      // Limpar espaços
      let cleaned = line.replace(/\s+/g, ' ').trim();
      
      // NOVO: Remover prefixo de estado/cidade seguido de ponto (ex: "TOCANTINS. ")
      cleaned = cleaned.replace(/^[A-ZÀ-Ÿ\s]{2,20}\.\s+/i, '');
      
      // NOVO: Ignorar números de documento (nº + dígitos ou sequência longa de dígitos)
      if (/^nº\s*\d+/i.test(cleaned)) return null;
      if (/^\d{5,}/i.test(cleaned)) return null;
      
      // Ignorar linhas que são apenas rótulos, CPFs, CNPJs, ou termos genéricos
      if (/^(AUTOR|R[ÉE]U|CPF|CNPJ|OAB|Advogad|Procurad|Representante)/i.test(cleaned)) return null;
      if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cleaned)) return null; // CPF
      if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(cleaned)) return null; // CNPJ
      if (cleaned.length < 4) return null;
      if (/^(sociedade|empresa|s\.?a\.?$|ltda$|eireli|me$|epp$)/i.test(cleaned)) return null;
      // Ignorar termos de ruído e saudações
      if (/^(PÁGINA|EVENTO|VARA|EXCELENT|WWW|SENHOR|DOUTOR|JUIZ|COMARCA|MERITÍSSIMO|EXMO|ILMO)/i.test(cleaned)) return null;
      // Pegar nome antes de vírgula ou parênteses
      const name = cleaned.split(/[,\(]/)[0].trim();
      // Validar que nome resultante não tem ruído
      if (hasNoiseInName(name)) return null;
      return name.length > 3 ? name : null;
    };
    
    // Estratégia 1: AUTOR e RÉU estão na MESMA linha (formato colunas)
    // Neste caso, os nomes estão na linha ABAIXO (ou próximas linhas não-vazias)
    if (autorLineIdx !== -1 && autorLineIdx === reuLineIdx) {
      console.log("[V2.3] Formato COLUNAS detectado (AUTOR e RÉU na mesma linha)");
      
      // Varrer até 6 linhas abaixo procurando nomes válidos
      // foundNames[0] = autor, foundNames[1..] = réus (multi-polo)
      const foundNames: string[] = [];
      for (let offset = 1; offset <= 6 && foundNames.length < 4; offset++) {
        const lineToCheck = searchLines[autorLineIdx + offset];
        if (!lineToCheck) continue;

        console.log(`[V2.3] Checando linha +${offset}:`, lineToCheck);

        // Tentar dividir por múltiplos espaços (colunas)
        const parts = lineToCheck.split(/\s{3,}/).filter((p) => p.trim().length > 3);

        for (const part of parts) {
          const name = extractValidName(part);
          if (name && !foundNames.includes(name)) {
            foundNames.push(name);
            console.log(`[V2.3] Nome encontrado: "${name}"`);
          }
        }

        // Se linha não tiver múltiplas colunas, tentar como nome único
        if (parts.length === 0) {
          const singleName = extractValidName(lineToCheck);
          if (singleName && !foundNames.includes(singleName)) {
            foundNames.push(singleName);
            console.log(`[V2.3] Nome único encontrado: "${singleName}"`);
          }
        }
      }

      // Atribuir nomes encontrados
      if (foundNames.length >= 1) result.authorName = foundNames[0];
      if (foundNames.length >= 2) {
        result.defendantName = foundNames[1];
        result.defendants = foundNames.slice(1);
      }
    }
    // Estratégia 2: AUTOR e RÉU em linhas DIFERENTES (formato tradicional)
    else {
      console.log("[V2.3] Formato TRADICIONAL detectado (AUTOR e RÉU em linhas diferentes)");
      
      // Para AUTOR: pegar próxima linha não-vazia após a linha do AUTOR
      if (autorLineIdx !== -1) {
        for (let i = autorLineIdx + 1; i < Math.min(autorLineIdx + 4, searchLines.length); i++) {
          const candidateName = extractValidName(searchLines[i]);
          if (candidateName) {
            result.authorName = candidateName;
            break;
          }
        }
      }
      
      // Para RÉU: pegar próximas linhas não-vazias após a linha do RÉU
      if (reuLineIdx !== -1) {
        const defendants: string[] = [];
        for (let i = reuLineIdx + 1; i < Math.min(reuLineIdx + 6, searchLines.length); i++) {
          const candidateName = extractValidName(searchLines[i]);
          if (candidateName && candidateName !== result.authorName && !defendants.includes(candidateName)) {
            defendants.push(candidateName);
          }
        }

        if (defendants.length > 0) {
          result.defendantName = defendants[0];
          result.defendants = defendants;
        }
      }
    }
    // Fallback V2: capturar réu(s) a partir de "Em face de" (petição) quando o bloco de Partes falhar
    // OU quando defendantName parece ser um número/documento (ruído)
    const needsDefendantFallback = !result.defendantName || hasNoiseInName(result.defendantName);
    if (needsDefendantFallback) {
      const emFaceIdx = lines.findIndex((l) => /\bem\s+face\s+de\b/i.test(l));
      if (emFaceIdx !== -1) {
        const defendants: string[] = [];

        // 1) tentar capturar na mesma linha após "Em face de"
        const sameLineAfter = (lines[emFaceIdx] || "").split(/\bem\s+face\s+de\b/i)[1]?.trim();
        if (sameLineAfter) {
          // separar por conectivos comuns e/ou pontuação; ainda assim validar cada pedaço
          const parts = sameLineAfter.split(/\s*;\s*|\s+e\s+|\s*,\s*/i).map((p) => p.trim()).filter(Boolean);
          for (const part of parts) {
            const name = extractValidName(part);
            if (name && name !== result.authorName && !defendants.includes(name)) defendants.push(name);
          }
        }

        // 2) varrer próximas linhas (até 6) e coletar múltiplos réus
        for (let i = emFaceIdx + 1; i < Math.min(emFaceIdx + 8, lines.length); i++) {
          const candidate = extractValidName(lines[i]);
          if (candidate && candidate !== result.authorName && !defendants.includes(candidate)) {
            defendants.push(candidate);
          }
          if (defendants.length >= 4) break;
        }

        if (defendants.length > 0) {
          result.defendantName = defendants[0];
          result.defendants = defendants;
        }
      }
    }

    console.log("[V2.3] Autor detectado:", result.authorName);
    console.log("[V2.3] Réu detectado:", result.defendantName);
  }
  // SEM FALLBACK - modo estrito: só extrai se o bloco existir

  // 3. Vara - Padrão eProc com "Juízo da"
  const varaMatch = cleanText.match(/Juízo da\s*(\d+[ªºa]\s*Vara\s*[^(\n]+)/i) 
    || cleanText.match(/(\d+[ªºa]\s*Vara\s*(?:C[íi]vel|Criminal|do Trabalho|Federal|da Fam[íi]lia|de Exec[uç]ões)?)/i);
  if (varaMatch) {
    result.vara = varaMatch[1].trim();
  }

  // 4. Comarca - Padrão eProc com fallback
  const comarcaMatch = cleanText.match(/Comarca de\s+([A-ZÀ-Ÿa-zà-ÿ\s]+?)(?:\n|$)/i) 
    || cleanText.match(/de\s+([A-Za-zÀ-ÿ]+)\s+Juiz/i)
    || cleanText.match(/(?:Foro)\s+(?:de\s+)?([A-Za-zÀ-ÿ\s]+?)(?:\s*[-\/]\s*[A-Z]{2})?(?:\s|,|$)/i);
  if (comarcaMatch) {
    result.comarca = comarcaMatch[1].trim();
  }

  // 5. Advogado e OAB
  const advMatch = cleanText.match(/(?:advogad[oa]|patrono|procurador)[:\s]+([^,\n]+)/i);
  if (advMatch) {
    result.lawyerName = advMatch[1].trim().replace(/,\s*OAB.*$/i, "");
  }

  const oabMatch = cleanText.match(/OAB[:\s/]*([A-Z]{2})[:\s/]*(\d+)/i);
  if (oabMatch) {
    result.oabNumber = `${oabMatch[1]} ${oabMatch[2]}`;
  }

  // 6. Classe da Ação - Padrão eProc (captura exata do cabeçalho)
  const classeMatch = cleanText.match(/Classe da ação:\s*([^\n]+)/i);
  if (classeMatch) {
    result.actionType = classeMatch[1].trim();
  }

  // 7. Eventos do processo - AGRUPADOS por número de evento
  const events: ProcessEvent[] = [];
  
  // Carregar dicionários de forma assíncrona
  const [tjtoDict, eprocDict] = await Promise.all([
    getTjtoDictionaryCached(),
    getEprocEventDictionaryCached(),
  ]);

  // Padrão 1: Rodapé eProc "Evento X, CÓDIGO, Página Y" (espaços flexíveis)
  // CORREÇÃO: Agrupar peças por evento para evitar duplicatas
  const rodapePattern = /Evento\s*(\d+)\s*,\s*([A-Z0-9_]+)\s*,\s*P[áa]gina\s*(\d+)/gi;
  const pecasByEvento = new Map<number, Array<{ code: string; label?: string; maxPage: number }>>();
  
  let rodapeMatch;
  while ((rodapeMatch = rodapePattern.exec(cleanText)) !== null) {
    const eventNum = parseInt(rodapeMatch[1], 10);
    const code = rodapeMatch[2];
    const page = parseInt(rodapeMatch[3], 10);
    
    // Enriquecer com dicionários
    let enrichedLabel: string | undefined;
    if (code && tjtoDict[code]) {
      enrichedLabel = tjtoDict[code].label;
    }
    if (code && eprocDict[code] && !enrichedLabel) {
      enrichedLabel = eprocDict[code].meaning;
    }
    
    if (!pecasByEvento.has(eventNum)) {
      pecasByEvento.set(eventNum, []);
    }
    
    const pecas = pecasByEvento.get(eventNum)!;
    const existing = pecas.find(p => p.code === code);
    
    if (existing) {
      // Atualizar página máxima (para contar total de páginas)
      existing.maxPage = Math.max(existing.maxPage, page);
    } else {
      // Nova peça
      pecas.push({ code, label: enrichedLabel, maxPage: page });
    }
  }
  
  // Converter Map para array de eventos únicos
  for (const [eventNum, pecas] of pecasByEvento) {
    const primaryPeca = pecas[0];
    // Gerar descrição rica: usar enrichedLabel ou fallback para o código
    const displayLabel = primaryPeca.label || primaryPeca.code;
    // Se temos múltiplas peças, listar todas na descrição
    const allLabels = pecas
      .map(p => p.label || p.code)
      .filter((v, i, arr) => arr.indexOf(v) === i) // unique
      .slice(0, 3); // max 3 para não poluir
    const descriptionText = allLabels.length > 1 
      ? allLabels.join(", ") 
      : displayLabel;
    
    events.push({
      eventNumber: eventNum,
      description: descriptionText,
      code: primaryPeca.code,
      enrichedLabel: primaryPeca.label,
      date: undefined,
      pecas: pecas.map(p => ({ code: p.code, label: p.label, pages: p.maxPage })),
    });
  }

  // Padrão 2: Timeline padrão "DD/MM/AAAA - Evento X - descrição" (fallback)
  if (events.length === 0) {
    const timelinePattern = /(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(?:Evento\s*(\d+)\s*[-–:]?\s*)?([^\n]+)/gi;
    let match;
    while ((match = timelinePattern.exec(cleanText)) !== null) {
      const date = match[1];
      const eventNumber = match[2] ? parseInt(match[2], 10) : undefined;
      const description = match[3].trim();
      const code = extractDocCode(description);
      
      let enrichedLabel: string | undefined;
      if (code && tjtoDict[code]) enrichedLabel = tjtoDict[code].label;
      if (code && eprocDict[code] && !enrichedLabel) enrichedLabel = eprocDict[code].meaning;
      
      events.push({ date, description, code, enrichedLabel, eventNumber });
    }
  }
  
  // Ordenar eventos por número
  events.sort((a, b) => (a.eventNumber ?? 0) - (b.eventNumber ?? 0));

  result.events = events;
  return result;
}

async function generateQuickPreview(text: string): Promise<string | null> {
  try {
    const body = {
      message: text.slice(0, 3000),
      mode: "quick_preview" as const,
    };
    assertLexosChatPayload(body);

    const { data, error } = await supabase.functions.invoke("lexos-chat-assistant", { body });
    
    if (error) {
      console.warn("[NIJA] Erro ao gerar prévia:", error);
      return null;
    }
    
    return data?.response || null;
  } catch (err) {
    console.warn("[NIJA] Falha na prévia IA:", err);
    return null;
  }
}

/**
 * Updates document is_image_pdf status in DB
 */
async function updateDocumentImagePdfStatus(
  documentId: string, 
  isImagePdfValue: boolean, 
  reason?: string | null
): Promise<void> {
  try {
    // NOTE: Using 'as any' temporarily until Supabase types are regenerated
    const { error } = await (supabase as any)
      .from("documents")
      .update({ 
        is_image_pdf: isImagePdfValue,
        // Optionally store reason in extraction_report or metadata
      })
      .eq("id", documentId);
    
    if (error) {
      console.warn("[updateDocumentImagePdfStatus] Erro:", error);
    } else {
      console.log(`[updateDocumentImagePdfStatus] Documento ${documentId} marcado como PDF-imagem: ${isImagePdfValue}`);
    }
  } catch (err) {
    console.warn("[updateDocumentImagePdfStatus] Falha:", err);
  }
}

// ======================================================
// HOOK
// ======================================================

export function useNijaExtraction(options: UseNijaExtractionOptions) {
  const { toast } = useToast();
  
  // Office/user context cache
  const officeContextRef = useRef<{ officeId: string; userId: string } | null>(null);
  const getOfficeContext = useCallback(async () => {
    if (officeContextRef.current) return officeContextRef.current;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error("Usuário não autenticado");

    const { data: memberData, error: memberError } = await supabase
      .from("office_members")
      .select("office_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (memberError || !memberData?.office_id) {
      throw new Error("Não foi possível identificar o escritório ativo");
    }

    officeContextRef.current = { officeId: memberData.office_id, userId };
    return officeContextRef.current;
  }, []);
  
  // Process files state
  const [processFiles, setProcessFiles] = useState<ProcessFile[]>([]);
  const processFilesInputRef = useRef<HTMLInputElement | null>(null);
  
  // Cancellation tokens
  const extractionCancelRef = useRef<Record<string, number>>({});
  
  // Extraction progress
  const extractionProgressRef = useRef<Record<string, ExtractionProgress>>({});
  const [, forceProgressUpdate] = useState(0);
  
  // Manual document
  const [manualDocText, setManualDocText] = useState("");
  const [manualDocLabel, setManualDocLabel] = useState("");
  const manualFileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Preview state
  const [detectedMetadata, setDetectedMetadata] = useState<QuickMetadata | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // Identified docs (TJTO dictionary)
  const [identifiedDocs, setIdentifiedDocs] = useState<EnrichedDoc[]>([]);

  // Cancel token helpers
  function bumpCancelToken(fileId: string) {
    extractionCancelRef.current[fileId] = (extractionCancelRef.current[fileId] ?? 0) + 1;
  }

  function getCancelToken(fileId: string) {
    return extractionCancelRef.current[fileId] ?? 0;
  }

  // Progress helpers
  function setExtractionProgress(fileId: string, currentPage: number, totalPages: number) {
    extractionProgressRef.current[fileId] = {
      currentPage,
      totalPages,
      percent: totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0,
    };
    forceProgressUpdate((n) => n + 1);
  }

  function clearExtractionProgress(fileId: string) {
    delete extractionProgressRef.current[fileId];
    forceProgressUpdate((n) => n + 1);
  }

  const getExtractionProgress = useCallback((fileId: string): ExtractionProgress | null => {
    return extractionProgressRef.current[fileId] ?? null;
  }, []);

  // Enrich documents with TJTO dictionary
  const enrichAllDocuments = useCallback(async (files: ProcessFile[]) => {
    const enriched: EnrichedDoc[] = [];
    for (const f of files) {
      if (f.status === "ready") {
        const doc = await enrichDoc(f.filename);
        enriched.push(doc);
      }
    }
    setIdentifiedDocs(enriched);
  }, []);

  // Extract file text
  async function extractFileText(pf: ProcessFile) {
    const tokenAtStart = getCancelToken(pf.id);

    try {
      const isPdf = pf.file.type === "application/pdf" || pf.filename.toLowerCase().endsWith(".pdf");

      let text = "";
      let extractionResult: ExtractionResult | undefined;
      let bookmarkForState: BookmarkExtractionResult | null = null;
      
      if (isPdf) {
        setExtractionProgress(pf.id, 0, 0);

        // Extract text and bookmarks in parallel for efficiency
        const [textResult, bookmarkResult] = await Promise.all([
          extractTextFromPdfFile(pf.file),
          extractBookmarksFromPdfFile(pf.file).catch((err) => {
            console.warn("[extractFileText] Erro ao extrair bookmarks:", err);
            return null;
          }),
        ]);
        
        extractionResult = textResult;
        text = extractionResult.extracted_text;
        
        // Log bookmark extraction result
        if (bookmarkResult?.hasBookmarks) {
          console.log(`[extractFileText] Bookmarks extraídos: ${bookmarkResult.documentos.length} documentos, CNJ: ${bookmarkResult.cnj}`);
          
          // If CNJ was found in bookmarks, use it to update detected metadata
          if (bookmarkResult.cnj && !pf.extractedText) {
            const formattedCnj = formatCNJ(bookmarkResult.cnj);
            if (formattedCnj) {
              options.setProcessNumber(formattedCnj);
              const year = extractProcessYear(formattedCnj);
              if (year) options.setProcessYear(year);
            }
          }
        }
        
        // Store bookmark result for file state
        bookmarkForState = bookmarkResult;
        
        // Update progress based on result
        const totalPages = extractionResult.extraction_report.pages_processed || 1;
        setExtractionProgress(pf.id, totalPages, totalPages);
        
        // Check if it's an image PDF
        const isImagePdfResult = isImagePdf(extractionResult.extraction_report);
        
        if (isImagePdfResult) {
          const reason = getImagePdfReason(extractionResult.extraction_report);
          console.log(`[extractFileText] PDF-imagem detectado: ${pf.filename}`, reason);
          
          // Update document in DB if linked
          if (pf.documentId) {
            await updateDocumentImagePdfStatus(pf.documentId, true, reason);
          }
          
          // Set status as image_pdf if text is insufficient - try OCR multi-página
          if (text.trim().length < IMAGE_PDF_MIN_CHARS) {
            if (getCancelToken(pf.id) !== tokenAtStart) return;
            
            // === OCR MULTI-PÁGINA com Retry ===
            const ocrTimer = createNijaTimer();
            
            // Obter totalPages diretamente do PDF.js (mais confiável que extractionResult)
            const firstPage = await convertPdfPageToImage(pf.file, 2.0, 1);
            
            if (!firstPage.success || !firstPage.totalPages) {
              // Não conseguiu ler o PDF - manter como image_pdf com erro
              logNijaError("useNijaExtraction", "EXTRACTION_OCR_INIT", 
                { message: firstPage.error || "Falha ao obter páginas do PDF" },
                { payload: { filename: pf.filename } }
              );
              
              setProcessFiles((prev) =>
                prev.map((f) =>
                  f.id === pf.id
                    ? { 
                        ...f, 
                        status: "image_pdf", 
                        isImagePdf: true,
                        extractionResult,
                        errorMessage: firstPage.error || "Não foi possível processar o PDF" 
                      }
                    : f
                )
              );
              return;
            }
            
            // totalPages defensivo (evita corner case totalPages=0/undefined)
            const totalPages = firstPage.totalPages && firstPage.totalPages > 0 ? firstPage.totalPages : 1;
            const maxPages = Math.min(totalPages, OCR_MAX_PAGES);
            
            logNijaStart("useNijaExtraction", "EXTRACTION_OCR", {
              payload: { filename: pf.filename, fileSize: pf.file.size, totalPages: firstPage.totalPages, maxPages }
            });
            
            // Atualizar status para ocr_processing
            setProcessFiles((prev) =>
              prev.map((f) =>
                f.id === pf.id
                  ? { ...f, status: "ocr_processing" as const, isImagePdf: true }
                  : f
              )
            );
            
            const ocrTexts: string[] = [];
            let successPages = 0;
            let lastError: unknown = null;
            
            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
              if (getCancelToken(pf.id) !== tokenAtStart) return;
              
              let attempts = 0;
              let pageSuccess = false;
              
              while (attempts < OCR_RETRIES && !pageSuccess) {
                try {
                  // Reutilizar imagem da página 1 se já temos (otimização)
                  let pageImageBase64: string;
                  if (pageNum === 1 && firstPage.imageBase64) {
                    pageImageBase64 = firstPage.imageBase64;
                  } else {
                    const pageImage = await convertPdfPageToImage(pf.file, 2.0, pageNum);
                    if (!pageImage.success || !pageImage.imageBase64) {
                      throw new Error(pageImage.error || `Falha ao converter página ${pageNum}`);
                    }
                    pageImageBase64 = pageImage.imageBase64;
                  }
                  
                  // Chamar edge function de OCR
                  const { data: ocrData, error: ocrError } = await supabase.functions.invoke(
                    "nija-extract-image",
                    { body: { imageBase64: pageImageBase64, pageNumber: pageNum } }
                  );
                  
                  if (ocrError) {
                    throw new Error(ocrError.message || "Erro no OCR");
                  }
                  
                  if (!ocrData?.success || !ocrData?.extracted_text) {
                    throw new Error(ocrData?.error || "OCR não retornou texto");
                  }
                  
                  // Sucesso nesta página
                  ocrTexts.push(`\n\n--- PÁGINA ${pageNum} ---\n\n${ocrData.extracted_text}`);
                  successPages++;
                  pageSuccess = true;
                  
                  // Atualizar progresso
                  setExtractionProgress(pf.id, pageNum, maxPages);
                  
                } catch (err) {
                  lastError = err;
                  attempts++;
                  
                  if (attempts < OCR_RETRIES) {
                    // Backoff exponencial: 500, 1000, 2000ms
                    const delay = OCR_BACKOFF_MS * Math.pow(2, attempts - 1);
                    await new Promise(r => setTimeout(r, delay));
                  } else {
                    // Falhou após todas tentativas - logar e continuar para próxima página
                    logNijaError("useNijaExtraction", "EXTRACTION_OCR_PAGE", err, {
                      payload: { filename: pf.filename, pageNumber: pageNum, attempts }
                    });
                  }
                }
              }
            }
            
            const ocrText = ocrTexts.join("").trim();
            
            if (getCancelToken(pf.id) !== tokenAtStart) return;
            clearExtractionProgress(pf.id);
            
            if (ocrText.length > 0) {
              // Determinar status final baseado no threshold MIN_CHARS_TOTAL
              const finalStatus: "OK" | "INSUFFICIENT_READING" = ocrText.length >= MIN_CHARS_TOTAL ? "OK" : "INSUFFICIENT_READING";
              const fileStatus: "ready" | "image_pdf" = finalStatus === "OK" ? "ready" : "image_pdf";
              
              // Manter coerência do extractionResult local
              const baseReport = extractionResult?.extraction_report;
              const updatedExtractionResult: ExtractionResult = {
                extracted_text: ocrText,
                reading_status: finalStatus,
                extraction_report: {
                  total_pages: baseReport?.total_pages ?? maxPages,
                  pages_processed: successPages,
                  pages_with_text: successPages,
                  coverage_ratio: maxPages > 0 ? successPages / maxPages : 1,
                  chars_total: ocrText.length,
                  truncated: baseReport?.truncated ?? false,
                  has_text_layer: false,
                  processing_time_ms: ocrTimer.elapsed(),
                  method: "vision_ocr" as const,
                },
              };
              
              // OCR teve sucesso em pelo menos uma página
              logNijaSuccess("useNijaExtraction", "EXTRACTION_OCR", {
                result: { pagesProcessed: successPages, maxPages, charsTotal: ocrText.length, finalStatus },
                durationMs: ocrTimer.elapsed()
              });
              
              // Salvar no banco se tiver documentId
              if (pf.documentId) {
                try {
                  await (supabase as any)
                    .from("documents")
                    .update({
                      extracted_text: ocrText,
                      reading_status: finalStatus,
                      extraction_method: "vision_ocr",
                      extraction_updated_at: new Date().toISOString(),
                      is_image_pdf: true,
                    })
                    .eq("id", pf.documentId);
                } catch (persistErr) {
                  console.warn("[NIJA] Falha ao persistir OCR:", persistErr);
                }
              }
              
              // Sucesso - continuar com o texto do OCR
              text = ocrText;
              
              // Status do arquivo reflete se texto é suficiente (usa extractionResult atualizado)
              setProcessFiles((prev) =>
                prev.map((f) =>
                  f.id === pf.id
                    ? {
                        ...f,
                        status: fileStatus,
                        extractedText: ocrText,
                        isImagePdf: true,
                        extractionResult: updatedExtractionResult,
                        extractionMethod: "vision_ocr" as const,
                        errorMessage: finalStatus === "INSUFFICIENT_READING" 
                          ? `Texto insuficiente (${ocrText.length} < ${MIN_CHARS_TOTAL} caracteres mínimos)`
                          : undefined,
                      }
                    : f
                )
              );
              
              toast({
                title: "OCR concluído",
                description: `${pf.filename}: ${successPages}/${maxPages} páginas processadas (${ocrText.length} caracteres)`,
              });
              
              // Continuar para detecção de metadados abaixo
              
            } else {
              // OCR falhou completamente
              logNijaError("useNijaExtraction", "EXTRACTION_OCR", lastError, {
                payload: { filename: pf.filename, fileSize: pf.file.size, maxPages, successPages: 0 },
                durationMs: ocrTimer.elapsed()
              });
              
              // Fallback: manter como image_pdf com erro
              setProcessFiles((prev) =>
                prev.map((f) =>
                  f.id === pf.id
                    ? { 
                        ...f, 
                        status: "image_pdf", 
                        isImagePdf: true,
                        extractionResult,
                        errorMessage: `OCR falhou após ${OCR_RETRIES} tentativas em todas as páginas` 
                      }
                    : f
                )
              );
              
              toast({
                title: "PDF Imagem",
                description: `${pf.filename}: OCR não conseguiu extrair texto.`,
                variant: "default",
              });
              
              return;
            }
            // === FIM OCR MULTI-PÁGINA ===
          }
        }
      } else {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
          reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
          reader.readAsText(pf.file, "utf-8");
        });
      }

      if (getCancelToken(pf.id) !== tokenAtStart) return;
      clearExtractionProgress(pf.id);

      if (text && text.trim().length > 0) {
        // Persistir extração no banco (quando temos documentId)
        if (pf.documentId) {
          try {
            if (extractionResult) {
              await saveExtractionToDatabase(pf.documentId, extractionResult);
              // Se não for PDF-imagem, também marcar explicitamente como false
              const isImg = isImagePdf(extractionResult.extraction_report);
              await updateDocumentImagePdfStatus(pf.documentId, isImg, isImg ? getImagePdfReason(extractionResult.extraction_report) : null);
            } else {
              // TXT: salvar apenas o texto
              await (supabase as any)
                .from("documents")
                .update({
                  extracted_text: text,
                  reading_status: "OK",
                  extraction_method: "text_file",
                  extraction_updated_at: new Date().toISOString(),
                })
                .eq("id", pf.documentId);
            }
          } catch (persistErr) {
            console.warn("[NIJA] Falha ao persistir extração:", persistErr);
          }
        }

        // Check if it's a partial image PDF (some text but low quality)
        const isPartialImagePdf = extractionResult && isImagePdf(extractionResult.extraction_report);

        setProcessFiles((prev) =>
          prev.map((f) =>
            f.id === pf.id
              ? {
                  ...f,
                  status: "ready",
                  extractedText: text,
                  isImagePdf: isPartialImagePdf,
                  extractionResult,
                  bookmarkResult: bookmarkForState,
                }
              : f
          )
        );

        // === AUTO-DETECT METADATA USANDO EXTRAÇÃO PURA (PRIORIDADE) ===
        // IMPORTANTE: Usar extractEprocDataPure ao invés de V2 truncada para nomes completos
        // Passar bookmarks para extração precisa da timeline
        const { extractEprocDataPure, PLACEHOLDER_NAO_IDENTIFICADO } = await import("@/nija");
        const pureExtraction = extractEprocDataPure(text, bookmarkForState);
        
        // Fallback para V2 apenas para campos que a extração pura não capturou
        const detected = await detectProcessMetadataEprocV2(text);
        
        const PLACEHOLDER = PLACEHOLDER_NAO_IDENTIFICADO;
        const fieldsDetected: string[] = [];

        // Helper: considera campo vazio se undefined, null, string vazia ou placeholder
        const isEmpty = (val: string | undefined | null): boolean => 
          !val || val.trim() === "" || val === PLACEHOLDER;

        // Fill CNJ (priorizar extração pura)
        const bestCnj = pureExtraction.capa.numeroCnj !== PLACEHOLDER 
          ? pureExtraction.capa.numeroCnj 
          : detected.cnjNumber;
        
        if (bestCnj && isEmpty(options.processNumber)) {
          options.setProcessNumber(bestCnj.trim());
          fieldsDetected.push("número do processo");

          const year = extractProcessYear(bestCnj);
          if (year) {
            options.setProcessYear(year);
            fieldsDetected.push(`ano (${year})`);
          }
        }

        // Usar nomes da extração pura (completos) - ignorar V2 para partes
        const pureAuthor = pureExtraction.peticaoInicial.autores.find(a => a && a !== PLACEHOLDER);
        const pureDefendant = pureExtraction.peticaoInicial.reus.find(r => r && r !== PLACEHOLDER);
        
        // Normalize parties by actingSide usando dados da extração pura
        const normalized = normalizePartyPrefill(
          options.actingSide,
          {
            authorName: pureAuthor || detected.authorName,
            defendantName: pureDefendant || detected.defendantName,
            comarca: pureExtraction.capa.comarca !== PLACEHOLDER ? pureExtraction.capa.comarca : detected.comarca,
            vara: pureExtraction.capa.varaJuizo !== PLACEHOLDER ? pureExtraction.capa.varaJuizo : detected.vara,
          },
          { clientName: options.clientName, opponentName: options.opponentName, city: options.city }
        );

        if (normalized.clientName && isEmpty(options.clientName)) {
          options.setClientName(normalized.clientName);
          fieldsDetected.push(options.actingSide === "AUTOR" ? "cliente (autor)" : "cliente (réu/executado)");
        }
        if (normalized.opponentName && isEmpty(options.opponentName)) {
          options.setOpponentName(normalized.opponentName);
          fieldsDetected.push(options.actingSide === "AUTOR" ? "parte contrária (réu)" : "parte contrária (autor/exequente)");
        }
        if (normalized.city && isEmpty(options.city)) {
          options.setCity(normalized.city);
          fieldsDetected.push("comarca do juízo");
        }

        // Vara (priorizar extração pura)
        const bestVara = pureExtraction.capa.varaJuizo !== PLACEHOLDER 
          ? pureExtraction.capa.varaJuizo 
          : detected.vara;
        if (bestVara && isEmpty(options.vara)) {
          options.setVara(bestVara);
          fieldsDetected.push("vara");
        }

        // Advogado (priorizar extração pura)
        const bestLawyer = pureExtraction.advogado.nome !== PLACEHOLDER 
          ? pureExtraction.advogado.nome 
          : detected.lawyerName;
        const bestOab = pureExtraction.advogado.oab !== PLACEHOLDER 
          ? pureExtraction.advogado.oab 
          : detected.oabNumber;
          
        if (bestLawyer && isEmpty(options.lawyerName)) {
          options.setLawyerName(bestLawyer);
          fieldsDetected.push("advogado");
        }
        if (bestOab && isEmpty(options.oabNumber)) {
          options.setOabNumber(bestOab);
          fieldsDetected.push("OAB");
        }

        // Eventos (da extração pura)
        const eventCount = pureExtraction.eventos?.length || detected.events.length;
        if (eventCount > 0) {
          fieldsDetected.push(`${eventCount} evento(s)`);
        }

        if (fieldsDetected.length > 0) {
          toast({
            title: "Dados detectados automaticamente",
            description: `Preenchido: ${fieldsDetected.join(", ")}`,
          });
        }

        // Enrich with TJTO dictionary
        setProcessFiles((prev) => {
          const updatedFiles = prev.map((f) =>
            f.id === pf.id ? { ...f, status: "ready" as const, extractedText: text } : f
          );
          setTimeout(() => enrichAllDocuments(updatedFiles), 100);
          return updatedFiles;
        });

        // Atualizar detectedMetadata com dados corrigidos da extração pura
        setDetectedMetadata({
          ...detected,
          cnjNumber: bestCnj || detected.cnjNumber,
          authorName: pureAuthor || detected.authorName,
          defendantName: pureDefendant || detected.defendantName,
          lawyerName: bestLawyer || detected.lawyerName,
          oabNumber: bestOab || detected.oabNumber,
          vara: bestVara || detected.vara,
          comarca: pureExtraction.capa.comarca !== PLACEHOLDER ? pureExtraction.capa.comarca : detected.comarca,
        });

        // Prévia SEM IA: não chamar lexos-chat-assistant aqui (evita 402 e mantém EXTRACTION_ONLY 100% local)
        setIsLoadingPreview(false);
      } else {
        setProcessFiles((prev) =>
          prev.map((f) =>
            f.id === pf.id
              ? { ...f, status: "error", errorMessage: "Nenhum texto encontrado" }
              : f
          )
        );
      }
    } catch (err) {
      if (getCancelToken(pf.id) !== tokenAtStart) return;
      clearExtractionProgress(pf.id);

      console.error("[extractFileText] Erro na extração:", err);

      const isTimeout = err instanceof Error && err.message === "TIMEOUT_PDF_EXTRACTION";
      const errorMessage = isTimeout ? "Timeout na leitura do PDF (> 45s)" : "Falha na leitura";

      setProcessFiles((prev) =>
        prev.map((f) => (f.id === pf.id ? { ...f, status: "error", errorMessage } : f))
      );

      if (isTimeout) {
        toast({
          title: "Leitura demorou demais",
          description: `${pf.filename}: o PDF pode estar corrompido ou muito complexo.`,
          variant: "destructive",
        });
      }
    }
  }

  // Handle process files change
  const handleProcessFilesChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const MAX_FILE_SIZE = 60 * 1024 * 1024; // 60 MB

    for (const file of Array.from(files)) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isText = file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt");
      const isWord = file.type === "application/msword" || 
                     file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                     file.name.toLowerCase().endsWith(".doc") || 
                     file.name.toLowerCase().endsWith(".docx");
      const isImage = file.type.startsWith("image/") ||
                      [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"].some(ext => 
                        file.name.toLowerCase().endsWith(ext)
                      );

      if (!isPdf && !isText && !isWord && !isImage) {
        toast({
          title: "Formato não suportado",
          description: `${file.name}: apenas PDF, TXT, DOC/DOCX e imagens são aceitos.`,
          variant: "destructive",
        });
        continue;
      }

      // Validar tamanho do arquivo
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} tem ${(file.size / 1024 / 1024).toFixed(1)} MB. Limite: 60 MB.`,
          variant: "destructive",
        });
        continue;
      }

      const clientFileId = crypto.randomUUID();

      // Adicionar arquivo imediatamente com status "uploading" para feedback visual
      const tempFile: ProcessFile = {
        id: clientFileId,
        file,
        filename: file.name,
        size: file.size,
        status: "uploading",
        extractedText: "",
      };
      setProcessFiles((prev) => [...prev, tempFile]);

      // Processar upload em background
      (async () => {
        try {
          const { officeId, userId } = await getOfficeContext();
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const storagePath = `nija/${officeId}/${Date.now()}_${clientFileId}_${sanitizedFileName}`;

          // Upload com retry
          let uploadSuccess = false;
          let lastUploadError: any = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file, {
              contentType: file.type,
              upsert: false,
            });

            if (!uploadError) {
              uploadSuccess = true;
              break;
            }

            lastUploadError = uploadError;
            console.warn(`[NIJA] Upload tentativa ${attempt + 1} falhou:`, uploadError.message);

            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            }
          }

          if (!uploadSuccess) {
            console.error("[NIJA] Upload falhou após 3 tentativas:", lastUploadError);
            setProcessFiles((prev) =>
              prev.map((f) =>
                f.id === clientFileId
                  ? { ...f, status: "error", errorMessage: "Falha no envio. Verifique sua conexão." }
                  : f
              )
            );
            toast({
              title: "Falha ao enviar arquivo",
              description: `${file.name}: Não foi possível enviar. Verifique sua conexão e tente novamente.`,
              variant: "destructive",
            });
            return;
          }

          // Criar registro no banco com metadata de documento temporário
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 dias
          const { data: createdDoc, error: insertError } = await supabase
            .from("documents")
            .insert({
              office_id: officeId,
              case_id: null,
              filename: file.name,
              kind: "PROCESSO_PDF",
              storage_bucket: "documents",
              storage_path: storagePath,
              mime_type: file.type,
              file_size: file.size,
              status: "PENDING",
              metadata: { 
                source: "NIJA_EXTRACTION",
                is_temporary: true,
                expires_at: expiresAt
              },
              uploaded_by: userId,
            } as any)
            .select("id")
            .single();

          if (insertError || !createdDoc?.id) {
            console.error("[NIJA] Erro ao registrar documento:", insertError);
            setProcessFiles((prev) =>
              prev.map((f) =>
                f.id === clientFileId
                  ? { ...f, status: "error", errorMessage: "Falha ao registrar documento." }
                  : f
              )
            );
            toast({
              title: "Falha ao registrar documento",
              description: `${file.name}: não foi possível criar o registro no banco.`,
              variant: "destructive",
            });
            return;
          }

          // Atualizar status para "extracting" e iniciar extração
          setProcessFiles((prev) =>
            prev.map((f) =>
              f.id === clientFileId
                ? { ...f, status: "extracting", documentId: createdDoc.id }
                : f
            )
          );

          // Iniciar extração
          const updatedFile: ProcessFile = {
            id: clientFileId,
            file,
            filename: file.name,
            size: file.size,
            status: "extracting",
            extractedText: "",
            documentId: createdDoc.id,
          };
          extractFileText(updatedFile);
        } catch (err) {
          console.error("[NIJA] Erro ao preparar arquivo:", err);
          setProcessFiles((prev) =>
            prev.map((f) =>
              f.id === clientFileId
                ? { ...f, status: "error", errorMessage: "Erro inesperado ao processar arquivo." }
                : f
            )
          );
          toast({
            title: "Erro ao preparar upload",
            description: `${file.name}: não foi possível preparar o arquivo para extração.`,
            variant: "destructive",
          });
        }
      })();
    }

    e.target.value = "";
  }, [toast, getOfficeContext]);

  // Remove process file
  const removeProcessFile = useCallback((id: string) => {
    setProcessFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Clear all process files
  const clearAllProcessFiles = useCallback(() => {
    setProcessFiles([]);
  }, []);

  // Retry extraction for failed file
  const retryExtraction = useCallback(async (fileId: string) => {
    const file = processFiles.find(f => f.id === fileId);
    if (!file || (file.status !== "error" && file.status !== "image_pdf")) return;
    
    // Reset status to extracting and restart
    setProcessFiles(prev => 
      prev.map(f => f.id === fileId ? { ...f, status: "extracting" as const, errorMessage: undefined } : f)
    );
    
    // Re-execute extraction
    await extractFileText(file);
  }, [processFiles, extractFileText]);

  // Clear manual document
  const clearManualDoc = useCallback(() => {
    setManualDocText("");
    setManualDocLabel("");
  }, []);

  // Handle manual file input
  const handleManualFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isText = file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt");
    const isWord = file.type === "application/msword" || 
                   file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                   file.name.toLowerCase().endsWith(".doc") || 
                   file.name.toLowerCase().endsWith(".docx");
    const isImage = file.type.startsWith("image/") ||
                    [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"].some(ext => 
                      file.name.toLowerCase().endsWith(ext)
                    );

    if (!isPdf && !isText && !isWord && !isImage) {
      toast({
        title: "Formato não suportado",
        description: "Apenas PDF, TXT, DOC/DOCX e imagens são aceitos.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    try {
      let text = "";
      if (isPdf) {
        const result = await extractTextFromPdfFile(file);
        text = result.extracted_text;
      } else {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
          reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
          reader.readAsText(file, "utf-8");
        });
      }

      if (text && text.trim().length > 0) {
        setManualDocText((prev) => (prev ? prev + "\n\n" + text : text));
        setManualDocLabel((prev) => (prev.trim() ? prev : file.name));
        toast({ title: "Texto carregado", description: "Conteúdo inserido com sucesso." });
      } else {
        toast({
          title: "Nenhum texto encontrado",
          description: "O arquivo não contém texto legível.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro ao ler arquivo",
        description: "Tente novamente ou cole o texto manualmente.",
        variant: "destructive",
      });
    } finally {
      e.target.value = "";
    }
  }, [toast]);

  // Get all inputs for analysis
  const getAllNijaInputs = useCallback((): NijaDocumentInput[] => {
    const inputs: NijaDocumentInput[] = [];

    for (const pf of processFiles) {
      if (pf.status === "ready" && pf.extractedText.trim().length > 0) {
        inputs.push({
          id: pf.id,
          filename: pf.filename,
          content: pf.extractedText,
          kind: "ARQUIVO_PROCESSO",
        });
      }
    }

    if (manualDocText.trim().length > 0) {
      inputs.push({
        id: "manual-doc",
        filename: manualDocLabel || "Documento complementar",
        content: manualDocText,
        kind: "DOCUMENTO_COMPLEMENTAR",
      });
    }

    return inputs;
  }, [processFiles, manualDocText, manualDocLabel]);

  // Get document IDs for linking to case (include ALL documents with IDs, not just ready ones)
  const getDocumentIds = useCallback((): string[] => {
    return processFiles
      .filter((f) => f.documentId) // Include any file that has a documentId (was uploaded to DB)
      .map((f) => f.documentId as string);
  }, [processFiles]);

  // Computed values
  const hasContent = useMemo(() => {
    const hasProcessFilesReady = processFiles.some((f) => f.status === "ready");
    const hasManualText = manualDocText.trim().length > 0;
    return hasProcessFilesReady || hasManualText;
  }, [processFiles, manualDocText]);

  const readyFilesCount = processFiles.filter((f) => f.status === "ready").length;
  const extractingCount = processFiles.filter((f) => f.status === "extracting").length;

  // Clear preview
  const clearPreview = useCallback(() => {
    setDocumentPreview(null);
    setDetectedMetadata(null);
  }, []);

  // Clear identified docs
  const clearIdentifiedDocs = useCallback(() => {
    setIdentifiedDocs([]);
  }, []);

  return {
    // Process files
    processFiles,
    setProcessFiles,
    processFilesInputRef,
    handleProcessFilesChange,
    removeProcessFile,
    clearAllProcessFiles,
    retryExtraction,
    getExtractionProgress,
    
    // Manual document
    manualDocText,
    setManualDocText,
    manualDocLabel,
    setManualDocLabel,
    manualFileInputRef,
    handleManualFileInputChange,
    clearManualDoc,
    
    // Preview
    detectedMetadata,
    documentPreview,
    isLoadingPreview,
    clearPreview,
    
    // Identified docs
    identifiedDocs,
    clearIdentifiedDocs,
    
    // Helpers
    getAllNijaInputs,
    getDocumentIds,
    hasContent,
    readyFilesCount,
    extractingCount,
  };
}
