// src/nija/core/fullAnalysis.ts
// NIJA Timeline-First Architecture - Central Orchestrator
// Integrates extraction, automatic detectors, prescription calculator, and AI analysis

import { 
  extractEprocDataPure, 
  type EprocExtractionResult,
  type EprocEventoExtraido,
} from "@/nija/extraction/mode";

import {
  extrairDadosContrato,
  calcularPrescricao,
  calcularPrescricaoIntercorrente,
  inferirTipoTitulo,
  detectTacIndevida,
  detectTaxaJurosAbusiva,
  detectPenhoraExcessiva,
  detectNotaPromissoriaVinculada,
  detectJurosCapitalizados,
  detectVencimentoAntecipadoAbusivo,
  detectImpenhorabilidade,
  // Novos detectores V2
  detectNulidadeCitacao,
  detectCerceamentoDefesa,
  detectInepciaPeticaoInicial,
  detectAusenciaFundamentacao,
  detectCDAIrregular,
  detectMultaConfiscatoria,
  detectErroCalculo,
  detectLitispendenciaCoisa,
  detectIncompetencia,
  detectSentencaExtraUltraCitra,
  type DadosContratoExtraido,
  type AnalisePrescricao,
} from "@/nija/analysis";

import type { NijaPolo } from "@/nija/core/poloDetect";
import type { NijaRamo } from "@/nija/core/engine";

// =====================================================
// Types
// =====================================================

export interface FullNijaInput {
  rawText: string;
  caseContext: {
    polo: NijaPolo;
    ramo?: string;
    caseId?: string;
  };
}

export interface PreDetectedDefect {
  code: string;
  notas?: string;
  evidence?: string;
  confidence?: "ALTA" | "MEDIA" | "BAIXA";
  source?: "HEURISTIC" | "CONTRACT" | "PRESCRIPTION" | "TIMELINE";
}

export interface UnifiedTimelineEvent {
  eventNumber: number | null;
  date: string;
  description: string;
  code?: string | null;
  enrichedLabel?: string | null;
  source: "LOCAL" | "AI" | "MERGED";
}

export interface FullNijaResult {
  // Extracted data
  extraction: EprocExtractionResult;
  
  // Contract data (banking/CCB)
  dadosContrato?: DadosContratoExtraido;
  
  // Prescription analysis
  analisePrescricao?: AnalisePrescricao;
  
  // Auto-detected defects
  preDetectedDefects: PreDetectedDefect[];
  
  // Unified timeline
  timeline: UnifiedTimelineEvent[];
  
  // Processing metadata
  meta: {
    extractionQuality: "ALTA" | "MEDIA" | "BAIXA";
    totalEvents: number;
    defectsDetected: number;
    contractDataExtracted: boolean;
    prescriptionCalculated: boolean;
    processingTimeMs: number;
  };
}

// =====================================================
// Timeline Merger
// =====================================================

/**
 * Merges local extracted timeline with AI-enriched timeline
 * Priority: Local events (more accurate) + AI enrichment
 */
export function mergeTimelines(
  localEvents: EprocEventoExtraido[],
  aiTimeline?: Array<{
    ordem: number;
    dataDetectada?: string;
    tipoAto: string;
    descricao: string;
    trecho?: string;
  }>
): UnifiedTimelineEvent[] {
  const merged: UnifiedTimelineEvent[] = [];
  const usedAiIndexes = new Set<number>();

  // First pass: Add all local events
  for (const local of localEvents) {
    // Try to find matching AI event
    const aiMatch = aiTimeline?.find((ia, idx) => {
      if (usedAiIndexes.has(idx)) return false;
      
      // Match by event number or date
      const matchByNumber = ia.ordem === local.numeroEvento;
      const matchByDate = ia.dataDetectada === local.data;
      
      if (matchByNumber || matchByDate) {
        usedAiIndexes.add(idx);
        return true;
      }
      return false;
    });

    merged.push({
      eventNumber: local.numeroEvento,
      date: local.data,
      description: aiMatch?.descricao || local.descricaoLiteral,
      code: local.codigoTjto,
      enrichedLabel: local.labelEnriquecido || aiMatch?.tipoAto,
      source: aiMatch ? "MERGED" : "LOCAL",
    });
  }

  // Second pass: Add AI events not matched locally
  if (aiTimeline) {
    for (let idx = 0; idx < aiTimeline.length; idx++) {
      if (usedAiIndexes.has(idx)) continue;
      
      const ia = aiTimeline[idx];
      merged.push({
        eventNumber: ia.ordem,
        date: ia.dataDetectada || "Não identificado",
        description: ia.descricao,
        enrichedLabel: ia.tipoAto,
        source: "AI",
      });
    }
  }

  // Sort by event number or date
  return merged.sort((a, b) => {
    if (a.eventNumber !== null && b.eventNumber !== null) {
      return a.eventNumber - b.eventNumber;
    }
    return 0;
  });
}

// =====================================================
// Timeline-Aware Detectors
// =====================================================

/**
 * Runs detectors that need timeline data for context
 */
function runTimelineAwareDetectors(
  events: EprocEventoExtraido[],
  rawText: string,
  dadosContrato?: DadosContratoExtraido
): PreDetectedDefect[] {
  const defects: PreDetectedDefect[] = [];
  const detectedCodes = new Set<string>();

  // 1. Detect intercurrent prescription (no movement for 1+ year)
  if (events.length > 0) {
    const sortedEvents = [...events].sort((a, b) => {
      const dateA = parseDate(a.data);
      const dateB = parseDate(b.data);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    });

    const lastEvent = sortedEvents[0];
    if (lastEvent?.data) {
      const lastEventDate = parseDate(lastEvent.data);
      if (lastEventDate) {
        const now = new Date();
        const daysSinceLastEvent = Math.floor(
          (now.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastEvent > 365) {
          // Check for intercurrent prescription
          const tipoTitulo = inferirTipoTitulo(rawText);
          if (tipoTitulo) {
            try {
              const analise = calcularPrescricaoIntercorrente({
                tipoTitulo,
                dataArquivamento: lastEventDate,
              });

              if (analise.status === "PRESCRITO") {
                defects.push({
                  code: "PRESCRICAO_INTERCORRENTE",
                  notas: `Processo sem movimentação há ${daysSinceLastEvent} dias. ${analise.alertas.join(". ")}`,
                  confidence: "ALTA",
                  source: "TIMELINE",
                });
                detectedCodes.add("PRESCRICAO_INTERCORRENTE");
              } else if (analise.status === "PROXIMO_PRESCREVER") {
                defects.push({
                  code: "PRESCRICAO_INTERCORRENTE",
                  notas: `Atenção: processo parado há ${daysSinceLastEvent} dias. ${analise.alertas.join(". ")}`,
                  confidence: "MEDIA",
                  source: "TIMELINE",
                });
                detectedCodes.add("PRESCRICAO_INTERCORRENTE");
              }
            } catch (e) {
              console.warn("[runTimelineAwareDetectors] Erro ao calcular prescrição intercorrente:", e);
            }
          }
        }
      }
    }
  }

  // 2. TAC indevida with contract date
  if (dadosContrato?.dataOperacao && !detectedCodes.has("TAC_TEC_INDEVIDA")) {
    const tacResult = detectTacIndevida(rawText, dadosContrato.dataOperacao);
    if (tacResult.detected) {
      defects.push({
        code: tacResult.suggestedCode,
        notas: tacResult.evidence || "TAC/TEC cobrada em contrato posterior a 30/04/2008",
        confidence: mapConfidence(tacResult.confidence),
        source: "CONTRACT",
      });
      detectedCodes.add(tacResult.suggestedCode);
    }
  }

  // 3. Abusive interest rate with extracted rate
  if (dadosContrato?.taxaJurosMensal && !detectedCodes.has("TAXA_JUROS_ABUSIVA")) {
    const jurosResult = detectTaxaJurosAbusiva(dadosContrato.taxaJurosMensal);
    if (jurosResult.detected) {
      defects.push({
        code: jurosResult.suggestedCode,
        notas: jurosResult.evidence || `Taxa mensal ${dadosContrato.taxaJurosMensal}% superior à média de mercado`,
        confidence: mapConfidence(jurosResult.confidence),
        source: "CONTRACT",
      });
      detectedCodes.add(jurosResult.suggestedCode);
    }
  }

  // 4. Excessive garnishment with extracted values
  if (dadosContrato?.valorOriginal && !detectedCodes.has("PENHORA_EXCESSIVA")) {
    // Check for garnishment patterns in text
    const penhoraMatch = rawText.match(/penhor[ao]d?[ao]?\s*(?:de)?\s*R?\$?\s*([\d.,]+)/i);
    if (penhoraMatch) {
      const valorPenhorado = parseValorBR(penhoraMatch[1]);
      if (valorPenhorado && valorPenhorado > dadosContrato.valorOriginal * 1.5) {
        const penhoraResult = detectPenhoraExcessiva(valorPenhorado, dadosContrato.valorOriginal);
        if (penhoraResult.detected) {
          defects.push({
            code: penhoraResult.suggestedCode,
            notas: penhoraResult.evidence || "Penhora superior ao valor do débito",
            confidence: "MEDIA",
            source: "CONTRACT",
          });
          detectedCodes.add(penhoraResult.suggestedCode);
        }
      }
    }
  }

  return defects;
}

// =====================================================
// Text-Only Detectors
// =====================================================

/**
 * Runs heuristic detectors that only need text
 */
function runTextOnlyDetectors(rawText: string): PreDetectedDefect[] {
  const defects: PreDetectedDefect[] = [];
  const detectedCodes = new Set<string>();

  const textOnlyDetectors = [
    // Detectores originais (títulos executivos e bancários)
    { detector: detectNotaPromissoriaVinculada, pattern: "nota promissória vinculada" },
    { detector: detectJurosCapitalizados, pattern: "capitalização de juros" },
    { detector: detectVencimentoAntecipadoAbusivo, pattern: "vencimento antecipado abusivo" },
    { detector: detectImpenhorabilidade, pattern: "impenhorabilidade" },
    // Novos detectores V2 (processuais)
    { detector: detectNulidadeCitacao, pattern: "nulidade de citação" },
    { detector: detectCerceamentoDefesa, pattern: "cerceamento de defesa" },
    { detector: detectInepciaPeticaoInicial, pattern: "inépcia da inicial" },
    { detector: detectAusenciaFundamentacao, pattern: "ausência de fundamentação" },
    { detector: detectCDAIrregular, pattern: "CDA irregular" },
    { detector: detectMultaConfiscatoria, pattern: "multa confiscatória" },
    { detector: detectErroCalculo, pattern: "erro de cálculo" },
    { detector: detectLitispendenciaCoisa, pattern: "litispendência/coisa julgada" },
    { detector: detectIncompetencia, pattern: "incompetência" },
    { detector: detectSentencaExtraUltraCitra, pattern: "sentença extra/ultra/citra petita" },
  ];

  for (const { detector, pattern } of textOnlyDetectors) {
    const result = detector(rawText);
    if (result?.detected && !detectedCodes.has(result.suggestedCode)) {
      detectedCodes.add(result.suggestedCode);
      defects.push({
        code: result.suggestedCode,
        notas: result.evidence || `Detectado padrão: ${pattern}`,
        confidence: mapConfidence(result.confidence),
        source: "HEURISTIC",
      });
    }
  }

  return defects;
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Maps detector confidence to Portuguese format
 */
function mapConfidence(confidence?: string): "ALTA" | "MEDIA" | "BAIXA" {
  if (!confidence) return "MEDIA";
  const lower = confidence.toLowerCase();
  if (lower === "high" || lower === "alta") return "ALTA";
  if (lower === "medium" || lower === "media" || lower === "média") return "MEDIA";
  return "BAIXA";
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === "Não identificado") return null;
  
  // Try DD/MM/YYYY
  const brMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return new Date(parseInt(brMatch[3]), parseInt(brMatch[2]) - 1, parseInt(brMatch[1]));
  }
  
  // Try YYYY-MM-DD
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }
  
  return null;
}

function parseValorBR(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// =====================================================
// Main Orchestrator
// =====================================================

/**
 * Runs the complete NIJA analysis pipeline:
 * 1. Extract structured data from raw text
 * 2. Extract contract data (for banking cases)
 * 3. Calculate prescription
 * 4. Run timeline-aware detectors
 * 5. Run text-only detectors
 * 6. Merge results into unified output
 */
export async function runFullNijaAnalysis(
  input: FullNijaInput
): Promise<FullNijaResult> {
  const startTime = Date.now();
  const { rawText, caseContext } = input;

  // 1. Run EPROC extraction
  console.log("[runFullNijaAnalysis] Starting extraction...");
  const extraction = extractEprocDataPure(rawText);

  // 2. Extract contract data (for banking/CCB cases)
  console.log("[runFullNijaAnalysis] Extracting contract data...");
  const dadosContrato = extrairDadosContrato(rawText);
  const contractDataExtracted = dadosContrato.camposExtraidos.length > 0;

  if (contractDataExtracted) {
    console.log(`[runFullNijaAnalysis] Contract data extracted: ${dadosContrato.camposExtraidos.join(", ")}`);
  }

  // 3. Calculate prescription
  console.log("[runFullNijaAnalysis] Calculating prescription...");
  let analisePrescricao: AnalisePrescricao | undefined;
  let prescriptionCalculated = false;

  const tipoTitulo = inferirTipoTitulo(rawText);
  if (tipoTitulo) {
    // Use contract date if available, otherwise use first event date
    const dataInicio = dadosContrato.dataMora || 
                       dadosContrato.dataOperacao || 
                       (extraction.eventos[0] ? parseDate(extraction.eventos[0].data) : null);
    
    if (dataInicio) {
      try {
        analisePrescricao = calcularPrescricao({
          tipoTitulo,
          dataInicioContagem: dataInicio,
        });
        prescriptionCalculated = true;
        console.log(`[runFullNijaAnalysis] Prescription calculated: ${analisePrescricao.status}`);
      } catch (e) {
        console.warn("[runFullNijaAnalysis] Error calculating prescription:", e);
      }
    }
  }

  // 4. Run all detectors
  console.log("[runFullNijaAnalysis] Running detectors...");
  const preDetectedDefects: PreDetectedDefect[] = [];

  // Timeline-aware detectors
  const timelineDefects = runTimelineAwareDetectors(extraction.eventos, rawText, dadosContrato);
  preDetectedDefects.push(...timelineDefects);

  // Text-only detectors
  const textDefects = runTextOnlyDetectors(rawText);
  preDetectedDefects.push(...textDefects);

  // Add prescription-based defects
  if (analisePrescricao) {
    const codeExists = preDetectedDefects.some(d => d.code === "PRESCRICAO_MATERIAL");
    
    if (analisePrescricao.status === "PRESCRITO" && !codeExists) {
      preDetectedDefects.push({
        code: "PRESCRICAO_MATERIAL",
        notas: analisePrescricao.alertas.join(". "),
        confidence: "ALTA",
        source: "PRESCRIPTION",
      });
    } else if (analisePrescricao.status === "PROXIMO_PRESCREVER" && !codeExists) {
      preDetectedDefects.push({
        code: "PRESCRICAO_MATERIAL",
        notas: `Atenção: ${analisePrescricao.alertas.join(". ")}`,
        confidence: "MEDIA",
        source: "PRESCRIPTION",
      });
    }
  }

  // 5. Build unified timeline
  const timeline = mergeTimelines(extraction.eventos);

  // 6. Calculate processing time and quality
  const processingTimeMs = Date.now() - startTime;
  const extractionQuality = extraction.meta.extractionQuality || 
    (extraction.meta.datePercentage && extraction.meta.datePercentage > 70 ? "ALTA" :
     extraction.meta.datePercentage && extraction.meta.datePercentage > 40 ? "MEDIA" : "BAIXA");

  console.log(`[runFullNijaAnalysis] Complete in ${processingTimeMs}ms. Quality: ${extractionQuality}, Defects: ${preDetectedDefects.length}`);

  return {
    extraction,
    dadosContrato: contractDataExtracted ? dadosContrato : undefined,
    analisePrescricao,
    preDetectedDefects,
    timeline,
    meta: {
      extractionQuality,
      totalEvents: extraction.eventos.length,
      defectsDetected: preDetectedDefects.length,
      contractDataExtracted,
      prescriptionCalculated,
      processingTimeMs,
    },
  };
}

// =====================================================
// Quick Analysis (for cases without full AI call)
// =====================================================

/**
 * Runs a quick local-only analysis without calling the AI service.
 * Useful for initial triage or when AI credits are limited.
 */
export function runQuickNijaAnalysis(rawText: string): {
  extraction: EprocExtractionResult;
  dadosContrato?: DadosContratoExtraido;
  analisePrescricao?: AnalisePrescricao;
  preDetectedDefects: PreDetectedDefect[];
  timeline: UnifiedTimelineEvent[];
} {
  // Sync extraction
  const extraction = extractEprocDataPure(rawText);
  const dadosContrato = extrairDadosContrato(rawText);
  const contractDataExtracted = dadosContrato.camposExtraidos.length > 0;

  // Prescription
  let analisePrescricao: AnalisePrescricao | undefined;
  const tipoTitulo = inferirTipoTitulo(rawText);
  if (tipoTitulo) {
    const dataInicio = dadosContrato.dataMora || dadosContrato.dataOperacao;
    if (dataInicio) {
      try {
        analisePrescricao = calcularPrescricao({
          tipoTitulo,
          dataInicioContagem: dataInicio,
        });
      } catch (e) {
        console.warn("[runQuickNijaAnalysis] Error calculating prescription:", e);
      }
    }
  }

  // Detectors
  const preDetectedDefects: PreDetectedDefect[] = [];
  preDetectedDefects.push(...runTimelineAwareDetectors(extraction.eventos, rawText, dadosContrato));
  preDetectedDefects.push(...runTextOnlyDetectors(rawText));

  // Prescription defects
  if (analisePrescricao?.status === "PRESCRITO") {
    preDetectedDefects.push({
      code: "PRESCRICAO_MATERIAL",
      notas: analisePrescricao.alertas.join(". "),
      confidence: "ALTA",
      source: "PRESCRIPTION",
    });
  }

  const timeline = mergeTimelines(extraction.eventos);

  return {
    extraction,
    dadosContrato: contractDataExtracted ? dadosContrato : undefined,
    analisePrescricao,
    preDetectedDefects,
    timeline,
  };
}
