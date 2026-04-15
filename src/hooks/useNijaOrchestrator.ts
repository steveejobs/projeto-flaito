import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type {
  EprocExtractionResult,
  NijaOperationMode,
  DetectedProcessSystem,
  NijaAnalyzerResponse,
  PoloAtuacao,
  NijaDocumentInput,
} from "@/types/nija-contracts";

import { 
  getCurrentOfficeId, 
  getCurrentUserId,
  computeExtractionHash,
  computeDocumentsHashForCache,
  getCachedExtraction,
  saveExtractionToCache
} from "@/nija/extraction/cache";

import { 
  extractEprocDataPure, 
  detectProcessSystemFromText 
} from "@/nija/connectors/eproc/detector";

import { runNijaAnalyzer } from "@/nija/core/analyzer";
import { createCaseFromExtraction } from "@/nija/case/caseCreator";

import { 
  runNijaV2Pipeline, 
  runNijaMaestro 
} from "@/services/nijaV2Service";

import { 
  hasNoiseInName, 
  isSingleWord 
} from "@/lib/utils/legalUtils";


import {
  saveNijaSession,
  computeDocumentsHash,
  findSessionByDocumentsHash,
  type NijaSessionRow,
  saveSessionToLocalStorage,
  clearSessionFromLocalStorage,
} from "@/services/nijaSession";
import { useNijaExtraction } from "./useNijaExtraction";
import { useNijaAnalysis } from "./useNijaAnalysis";

export interface useNijaOrchestratorOptions {
  actingSide: "REU" | "AUTOR";
  extraction: ReturnType<typeof useNijaExtraction>;
  analysis: ReturnType<typeof useNijaAnalysis>;
  
  // Setters needed for restoration
  setActingSide: (v: "REU" | "AUTOR") => void;
  setClientName: (v: string) => void;
  setOpponentName: (v: string) => void;
  setProcessNumber: (v: string) => void;
  setVara: (v: string) => void;
  setCity: (v: string) => void;
  setLawyerName: (v: string) => void;
  setOabNumber: (v: string) => void;
  setCaseDescription: (v: string) => void;
  setSelectedRamo: (v: string) => void;
}

export function useNijaOrchestrator(opts: useNijaOrchestratorOptions) {
  const { toast } = useToast();
  const { extraction, analysis } = opts;

  // === ESTADOS DE OPERAÇÃO ===
  const [operationMode, setOperationMode] = useState<NijaOperationMode>("EXTRACTION_ONLY");
  const [extractionResult, setExtractionResult] = useState<EprocExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [detectedSystem, setDetectedSystem] = useState<DetectedProcessSystem>("EPROC");
  
  // === ESTADOS DE PIPELINE ===
  const [localAnalysisResult, setLocalAnalysisResult] = useState<NijaAnalyzerResponse | null>(null);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const autoCreateTriggeredRef = useRef(false);

  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [v2Progress, setV2Progress] = useState<{ stage: number; message: string }>({ stage: 0, message: "" });
  const [maestroResult, setMaestroResult] = useState<any>(null);
  const [isMaestroRunning, setIsMaestroRunning] = useState(false);
  const [maestroStage, setMaestroStage] = useState<any>(null);
  const [zapSignStatus, setZapSignStatus] = useState<any>(null);
  const [showNonEprocPrompt, setShowNonEprocPrompt] = useState(false);
  const [pendingNonEprocText, setPendingNonEprocText] = useState<string | null>(null);

  // === ESTADO DE SESSÃO ===
  const [currentDocumentsHash, setCurrentDocumentsHash] = useState<string | null>(null);
  const [officeIdState, setOfficeIdState] = useState<string | null>(null);

  // Inicialização
  useEffect(() => {
    getCurrentOfficeId().then(id => setOfficeIdState(id));
  }, []);

  // === MÉTODOS DE SESSÃO ===

  const handleClearAll = useCallback(() => {
    // Memória
    setExtractionResult(null);
    setLocalAnalysisResult(null);
    setCreatedCaseId(null);
    setAiAnalysisResult(null);
    setAiAnalysisLoading(false);
    setMaestroResult(null);
    setIsMaestroRunning(false);
    autoCreateTriggeredRef.current = false;
    setCurrentDocumentsHash(null);
    
    // Hooks subjacentes
    extraction.clearAllProcessFiles();
    extraction.clearManualDoc();
    analysis.setAnalysisResult(null);
    analysis.setGeneratedPiece(null);

    // Persistência
    clearSessionFromLocalStorage();
  }, [extraction, analysis]);

  const handleLoadSession = useCallback((session: NijaSessionRow) => {
    if (!session) return;

    // Idempotência: Se já é a mesma sessão (pelo hash), evita reload pesado
    if (currentDocumentsHash === session.documents_hash && createdCaseId === session.case_id) {
       console.log("[NIJA] Sessão já carregada. Ignorando.");
       return;
    }

    console.log("[NIJA] Carregando sessão:", session.id);

    // Restaurar extração e análise
    if (session.extraction_result) setExtractionResult(session.extraction_result as any);
    if (session.analysis_result) setAiAnalysisResult(session.analysis_result as any);
    if (session.case_id) setCreatedCaseId(session.case_id);
    if (session.documents_hash) setCurrentDocumentsHash(session.documents_hash);

    // Atualizar UI via setters passados por opções
    if (session.acting_side) opts.setActingSide(session.acting_side as "REU" | "AUTOR");
    if (session.client_name) opts.setClientName(session.client_name);
    if (session.opponent_name) opts.setOpponentName(session.opponent_name);
    if (session.cnj_number) opts.setProcessNumber(session.cnj_number);
    
    // Outros metadados se disponíveis no JSON de extração
    const ext = session.extraction_result as any;
    if (ext?.capa?.varaJuizo) opts.setVara(ext.capa.varaJuizo);
    if (ext?.capa?.comarca) opts.setCity(ext.capa.comarca);
    if (ext?.advogado?.nome) opts.setLawyerName(ext.advogado.nome);
    if (ext?.advogado?.oab) opts.setOabNumber(ext.advogado.oab);

    toast({
      title: "Sessão restaurada",
      description: `CNJ: ${session.cnj_number || "Não identificado"}`,
    });
  }, [currentDocumentsHash, createdCaseId, opts, toast]);

  // === HANDLERS DE EXTRAÇÃO ===

  const executeEprocExtraction = useCallback(async (rawText: string, system: DetectedProcessSystem = "EPROC") => {
    try {
      const officeId = await getCurrentOfficeId();
      const userId = await getCurrentUserId();

      const extractionHash = await computeExtractionHash(rawText, system);
      const firstFileBookmarks = extraction.processFiles[0]?.bookmarkResult || null;

      let result: EprocExtractionResult | null = null;
      let fromCache = false;

      if (officeId) {
        const cached = await getCachedExtraction(officeId, extractionHash);
        if (cached) {
          result = cached;
          fromCache = true;
          console.log(`[NIJA] Cache HIT - ${cached.eventos?.length ?? 0} eventos`);
        }
      }

      if (!result) {
        console.log("[NIJA] Executando extração EPROC pura" + (firstFileBookmarks?.hasBookmarks ? ` (com ${firstFileBookmarks.documentos.length} bookmarks)` : ""));
        result = extractEprocDataPure(rawText, firstFileBookmarks);

        if (officeId && result && Array.isArray(result.eventos) && result.eventos.length > 0) {
          const sessionId = `session_${Date.now()}`;
          const documentsHash = await computeDocumentsHashForCache(rawText);
          await saveExtractionToCache({
            officeId,
            sessionId,
            system,
            extractionHash,
            documentsHash,
            result,
            createdBy: userId,
          }).catch((err) => console.warn("[NIJA] Erro ao salvar cache:", err));
        }
      }

      if (!result) throw new Error("Falha ao extrair dados do documento");

      // Normalização defensiva
      const PLACEHOLDER = "Não identificado nos documentos analisados";
      result = {
        ...result,
        capa: {
          numeroCnj: PLACEHOLDER,
          classeAcao: PLACEHOLDER,
          varaJuizo: PLACEHOLDER,
          comarca: PLACEHOLDER,
          situacaoProcessual: PLACEHOLDER,
          dataAutuacao: PLACEHOLDER,
          orgaoJulgador: PLACEHOLDER,
          juiz: PLACEHOLDER,
          assuntos: [],
          tipoAcao: PLACEHOLDER,
          ...result.capa,
        },
        peticaoInicial: {
          autores: [],
          reus: [],
          pedidos: [],
          causaDePedir: "",
          valorDaCausa: "",
          fundamentosLegaisCitados: [],
          datasDeFatosNarrados: [],
          autoresDetalhados: [],
          reusDetalhados: [],
          ...result.peticaoInicial,
        },
        advogado: {
          nome: PLACEHOLDER,
          oab: PLACEHOLDER,
          formatado: PLACEHOLDER,
          oabs: [],
          emCausaPropria: false,
          ...result.advogado,
        },
        eventos: Array.isArray(result.eventos) ? result.eventos : [],
        pecasPosteriores: Array.isArray(result.pecasPosteriores) ? result.pecasPosteriores : [],
        meta: {
          dataExtracao: new Date().toISOString(),
          totalEventos: Array.isArray(result.eventos) ? result.eventos.length : 0,
          totalPecas: 0,
          camposAusentes: [],
          ...result.meta,
        },
      };

      // Consolidação com V2 (IA)
      let v2Author = extraction.detectedMetadata?.authorName;
      let v2Defendant = extraction.detectedMetadata?.defendantName;
      const fallbackAuthor = result.peticaoInicial.autores[0];
      const fallbackDefendant = result.peticaoInicial.reus[0];

      if (hasNoiseInName(v2Author) || (typeof v2Author === "string" && v2Author.length < 8)) v2Author = undefined;
      if (hasNoiseInName(v2Defendant) || (typeof v2Defendant === "string" && v2Defendant.length < 8) || isSingleWord(v2Defendant)) v2Defendant = undefined;

      const finalAuthor = !v2Author ? fallbackAuthor : v2Author;
      const finalDefendant = !v2Defendant ? fallbackDefendant : v2Defendant;

      if (extraction.detectedMetadata) {
        if (extraction.detectedMetadata.cnjNumber && result.capa.numeroCnj === PLACEHOLDER) result.capa.numeroCnj = extraction.detectedMetadata.cnjNumber;
        if (extraction.detectedMetadata.vara && result.capa.varaJuizo === PLACEHOLDER) result.capa.varaJuizo = extraction.detectedMetadata.vara;
        if (extraction.detectedMetadata.comarca && result.capa.comarca === PLACEHOLDER) result.capa.comarca = extraction.detectedMetadata.comarca;

        if (finalAuthor) result.peticaoInicial.autores = [finalAuthor];
        if (finalDefendant) result.peticaoInicial.reus = [finalDefendant];

        extraction.detectedMetadata.authorName = finalAuthor;
        extraction.detectedMetadata.defendantName = finalDefendant;

        if (extraction.detectedMetadata.lawyerName && result.advogado.nome === PLACEHOLDER) result.advogado.nome = extraction.detectedMetadata.lawyerName;
        if (extraction.detectedMetadata.oabNumber && result.advogado.oab === PLACEHOLDER) result.advogado.oab = extraction.detectedMetadata.oabNumber;
      }

      setExtractionResult(result);

      // Hash de documentos e persistência
      const inputs = extraction.getAllNijaInputs();
      const docContents = inputs.map(d => d.content);
      const docHash = await computeDocumentsHash(docContents);
      setCurrentDocumentsHash(docHash);

      const uniqueEventCount = result.eventos?.length || 0;
      toast({
        title: `Extração EPROC concluída${fromCache ? " (cache)" : ""}`,
        description: `${uniqueEventCount} evento(s) extraído(s). Nenhuma IA foi utilizada.`,
      });

    } catch (err) {
      console.error("[NIJA] Erro na extração:", err);
      toast({ title: "Erro na extração", description: "Falha ao processar documentos.", variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  }, [extraction, toast]);

  const runExtractionOnly = useCallback(async () => {
    if (!extraction.hasContent) return;
    setIsExtracting(true);
    setExtractionResult(null);

    const inputs = extraction.getAllNijaInputs();
    const rawText = inputs.map(d => d.content).join("\n\n---\n\n");
    const sys = detectProcessSystemFromText(rawText);
    setDetectedSystem(sys);

    if (sys !== "EPROC") {
      setPendingNonEprocText(rawText);
      setIsExtracting(false);
      setShowNonEprocPrompt(true);
      return "SHOW_PROMPT"; // UI deve lidar com o prompt
    }

    await executeEprocExtraction(rawText, sys);
    return "SUCCESS";
  }, [extraction, executeEprocExtraction]);

  const handleForceEprocExtraction = useCallback(async () => {
    if (!pendingNonEprocText) return;
    setIsExtracting(true);
    setShowNonEprocPrompt(false);
    await executeEprocExtraction(pendingNonEprocText, "EPROC");
    setPendingNonEprocText(null);
  }, [pendingNonEprocText, executeEprocExtraction]);

  const handleSkipExtraction = useCallback(() => {
    setShowNonEprocPrompt(false);
    setPendingNonEprocText(null);
    toast({
      title: "Extração ignorada",
      description: "Você pode prosseguir para a análise manual ou IA.",
    });
  }, [toast]);

  // === HANDLERS DE CRIAÇÃO DE CASO ===

  const handleAutoCreateCase = useCallback(async () => {
    if (!extractionResult) return;
    setIsCreatingCase(true);

    try {
      const inputs = extraction.getAllNijaInputs();
      const nijaDocuments: NijaDocumentInput[] = inputs.map((doc, idx) => ({
        id: doc.id || `doc-${idx}`,
        filename: doc.filename || `documento-${idx + 1}`,
        content: doc.content,
        kind: doc.kind,
      }));

      const analysisResult = runNijaAnalyzer({
        mode: "AUTOMATIC",
        caseContext: { polo: opts.actingSide },
        documents: nijaDocuments,
      });

      setLocalAnalysisResult(analysisResult);

      const result = await createCaseFromExtraction({
        extractionResult,
        analysisResult,
        actingSide: opts.actingSide,
        clientName: opts.clientName || extractionResult.peticaoInicial.autores[0] || "Cliente NIJA",
        opponentName: opts.opponentName || extractionResult.peticaoInicial.reus[0] || "",
        processNumber: opts.processNumber || extractionResult.capa.numeroCnj,
        lawyerName: opts.lawyerName || extractionResult.advogado.nome,
        oabNumber: opts.oabNumber || extractionResult.advogado.oab,
        vara: opts.vara || extractionResult.capa.varaJuizo,
        city: opts.city || extractionResult.capa.comarca,
        documentIds: extraction.getDocumentIds(),
      });

      setCreatedCaseId(result.caseId);
      toast({ title: "Caso criado", description: "Caso registrado no banco com sucesso." });
      return result.caseId;
    } catch (err) {
      console.error("[NIJA] Erro ao criar caso:", err);
      toast({ title: "Erro ao criar caso", variant: "destructive" });
    } finally {
      setIsCreatingCase(false);
    }
  }, [extractionResult, extraction, opts, toast]);

  // === HANDLERS DE ANÁLISE IA ===

  const runAiAnalysisV2 = useCallback(async (isMaestro: boolean = true) => {
    if (!extraction.hasContent) return;

    setAiAnalysisLoading(true);
    setV2Progress({ stage: 1, message: "Iniciando Motor de Dossiê..." });

    try {
      let targetCaseId = createdCaseId;
      if (!targetCaseId) {
        targetCaseId = await handleAutoCreateCase() || null;
      }

      if (!targetCaseId) throw new Error("Não foi possível criar o caso para análise.");

      if (isMaestro) {
        setIsMaestroRunning(true);
        setMaestroStage("INICIANDO");

        await runNijaMaestro({
          caseId: targetCaseId,
          onProgress: (stage, message) => {
            setV2Progress({ stage: stage + 10, message });
          }
        });
      } else {
        const result = await runNijaV2Pipeline({
          caseId: targetCaseId,
          onProgress: (stage, message) => setV2Progress({ stage, message }),
        });
        setAiAnalysisResult(result);
      }
    } catch (err) {
      console.error("[NIJA] Erro na análise IA:", err);
      toast({ title: "Erro na análise", description: "Falha ao processar análise inteligente.", variant: "destructive" });
    } finally {
      setAiAnalysisLoading(false);
    }
  }, [extraction, createdCaseId, handleAutoCreateCase, toast]);

  const [isMaestroMode, setIsMaestroMode] = useState(true);

  // === POLLING PARA MAESTRO EM TEMPO REAL ===
  useEffect(() => {
    if (!createdCaseId || !isMaestroMode) return;

    let intervalId: any;
    let zapIntervalId: any;

    const checkStatus = async () => {
      try {
        const { data: latestRun, error } = await supabase
          .from("nija_pipeline_runs")
          .select("current_stage, status, result")
          .eq("case_id", createdCaseId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (latestRun) {
          setMaestroStage(latestRun.current_stage);
          
          if (latestRun.status === "COMPLETED") {
            setMaestroStage("CONCLUÍDO");
            setIsMaestroRunning(false);
            if (latestRun.result) {
              const maestro = latestRun.result as any;
              setMaestroResult(maestro);
              
              if (maestro.document_id && !zapIntervalId) {
                setZapSignStatus({ id: maestro.document_id, status: 'pending', url: maestro.zapsign_url });
                
                zapIntervalId = setInterval(async () => {
                  const { data: doc } = await supabase.from('documents').select('metadata').eq('id', maestro.document_id).maybeSingle();
                  if ((doc?.metadata as any)?.zapsign_status === 'signed') {
                    setZapSignStatus((prev: any) => ({ ...prev, status: 'signed' }));
                    clearInterval(zapIntervalId);
                    zapIntervalId = null;
                  }
                }, 10000);
              }
            }
            clearInterval(intervalId);
          } else if (latestRun.status === "FAILED") {
            setMaestroStage("ERRO");
            setIsMaestroRunning(false);
            clearInterval(intervalId);
          } else {
            setIsMaestroRunning(true);
          }
        }
      } catch (err) {
        console.warn("[NIJA Polling] Erro:", err);
      }
    };

    intervalId = setInterval(checkStatus, 3000);
    checkStatus();

    return () => {
      clearInterval(intervalId);
      if (zapIntervalId) clearInterval(zapIntervalId);
    };
  }, [createdCaseId, isMaestroMode]);

  // === AUTO-CREATE CASE AFTER EXTRACTION ===
  useEffect(() => {
    const extractionKey = extractionResult?.meta?.totalEventos ?? null;
    if (!extractionResult || !extractionKey) return;
    if (operationMode !== "EXTRACTION_ONLY") return;
    if (createdCaseId || isCreatingCase || autoCreateTriggeredRef.current) return;

    autoCreateTriggeredRef.current = true;
    const timeoutId = setTimeout(() => {
      handleAutoCreateCase();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [extractionResult, operationMode, createdCaseId, isCreatingCase, handleAutoCreateCase]);

  // Persistência local reativa (Debounced)
  useEffect(() => {
    if (!officeIdState || !currentDocumentsHash) return;
    
    const timeoutId = setTimeout(() => {
      getCurrentUserId().then(userId => {
        saveSessionToLocalStorage({
          officeId: officeIdState,
          createdBy: userId,
          documentsHash: currentDocumentsHash,
          documentCount: extraction.processFiles.length,
          documentNames: extraction.processFiles.map(f => f.filename),
          extractionResult,
          analysisResult: aiAnalysisResult,
          cnjNumber: opts.processNumber,
          clientName: opts.clientName,
          opponentName: opts.opponentName,
          actingSide: opts.actingSide,
          caseId: createdCaseId,
          status: "completed",
        });
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    extractionResult, 
    aiAnalysisResult, 
    currentDocumentsHash, 
    officeIdState, 
    createdCaseId,
    opts.clientName,
    opts.opponentName,
    opts.processNumber,
    opts.actingSide,
    extraction.processFiles
  ]);

  return {
    // Estados
    operationMode,
    setOperationMode,
    extractionResult,
    isExtracting,
    detectedSystem,
    localAnalysisResult,
    createdCaseId,
    setCreatedCaseId,
    isCreatingCase,
    aiAnalysisResult,
    aiAnalysisLoading,
    v2Progress,
    maestroResult,
    isMaestroRunning,
    maestroStage,
    zapSignStatus,
    officeIdState,
    currentDocumentsHash,
    isMaestroMode,
    setIsMaestroMode,
    
    // Métodos
    runExtractionOnly,
    runAiAnalysisV2,
    handleAutoCreateCase,
    handleLoadSession,
    handleClearAll,
    handleForceEprocExtraction,
    handleSkipExtraction,
    showNonEprocPrompt,
    setShowNonEprocPrompt,
  };
}
