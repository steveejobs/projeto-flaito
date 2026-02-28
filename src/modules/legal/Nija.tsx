// src/pages/Nija.tsx
// NIJA – Central de Análise Processual (Página Premium com Fluxo em 3 Passos)
// Supports two modes: EXTRACTION_ONLY (pure EPROC data extraction) and NIJA_ANALYSIS (AI-powered legal analysis)

import { lazy, Suspense, useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useNijaExtraction } from "@/hooks/useNijaExtraction";
import { useNijaAnalysis } from "@/hooks/useNijaAnalysis";

import { useNavigate } from "react-router-dom";

import { AppLayout } from "@/components/AppLayout";
import { NijaDocumentUpload } from "@/components/nija/NijaDocumentUpload";
import { NijaComplementaryDoc } from "@/components/nija/NijaComplementaryDoc";
import { NijaAnalysisConfig } from "@/components/nija/NijaAnalysisConfig";
import { NijaDocumentPreview } from "@/components/nija/NijaDocumentPreview";
import { NijaIdentifiedDocsCard } from "@/components/nija/NijaIdentifiedDocsCard";
import { NijaStepper } from "@/components/nija/NijaStepper";
import { NijaExtractionModeToggle } from "@/components/nija/NijaExtractionModeToggle";
import { NijaExtractionResultCard } from "@/components/nija/NijaExtractionResultCard";
import { NijaPostExtractionPanel } from "@/components/nija/NijaPostExtractionPanel";
import { NijaPreviousSessions } from "@/components/nija/NijaPreviousSessions";

// Polo detection utility
import { detectPoloFromEprocText, type NijaPoloDetectResult } from "@/nija";

// Lazy load do painel de resultados (componente pesado)
const NijaResultsPanel = lazy(() => import("@/components/nija/NijaResultsPanel").then(m => ({ default: m.NijaResultsPanel })));

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NijaTooltip } from "@/components/ui/NijaTooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { useToast } from "@/hooks/use-toast";

import {
  NijaRamo,
  severityLabelColor,
  impactLabel,
  ramoLabel,
  formatFileSize,
  type NijaOperationMode,
  type EprocExtractionResult,
  extractEprocDataPure,
  computeExtractionHash,
  computeDocumentsHashForCache,
  getCachedExtraction,
  saveExtractionWithDocument,
  saveExtractionToCache,
  getCurrentOfficeId,
  getCurrentUserId,
  deleteCachedExtraction,
  updateExtractionCaseId,
  detectProcessSystemFromText,
  type DetectedProcessSystem,
  runNijaAnalyzer,
  type NijaAnalyzerResponse,
  type NijaDocumentInput,
  createCaseFromExtraction,
} from "@/nija";
import { runNijaFullAnalysisQuick } from "@/services/nijaFullAnalysis";
import {
  saveNijaSession,
  computeDocumentsHash,
  findSessionByDocumentsHash,
  type NijaSessionRow,
  saveSessionToLocalStorage,
  getSessionFromLocalStorage,
  clearSessionFromLocalStorage,
} from "@/services/nijaSession";

import {
  Upload, 
  FileUp,
  Settings2,
  CheckCircle2, 
  FileCheck,
  Shield,
  Swords,
  Brain,
  Target,
  Info,
  ArrowLeft,
  Trash2,
  FileSearch,
  Zap,
  ArrowLeftRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

// Fallback de loading para componentes lazy
function ResultsPanelSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function NijaPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // DEV render count
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  if (import.meta.env.DEV) console.debug("[NIJA] render", renderCountRef.current);

  // Ref para auto-scroll aos resultados
  const resultsRef = useRef<HTMLDivElement>(null);

  // Toggle para extração automática (padrão: ativo)
  const [autoRunExtraction, setAutoRunExtraction] = useState(true);

  // === MODO DE OPERAÇÃO ===
  // EXTRACTION_ONLY: Extração pura EPROC sem IA (PADRÃO)
  // NIJA_ANALYSIS: Análise jurídica completa com IA
  const [operationMode, setOperationMode] = useState<NijaOperationMode>("EXTRACTION_ONLY");
  
  // Estado para resultado da extração pura
  const [extractionResult, setExtractionResult] = useState<EprocExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  
  // Estado para detecção de sistema processual
  const [detectedSystem, setDetectedSystem] = useState<DetectedProcessSystem>("EPROC");
  const [showNonEprocPrompt, setShowNonEprocPrompt] = useState(false);
  
  // === ESTADOS PARA GERAÇÃO AUTOMÁTICA DE CASO ===
  const [localAnalysisResult, setLocalAnalysisResult] = useState<NijaAnalyzerResponse | null>(null);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const autoCreateTriggeredRef = useRef(false);
  
  // === ESTADOS PARA ANÁLISE IA PÓS-EXTRAÇÃO ===
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [lastExtractionHash, setLastExtractionHash] = useState<string | null>(null);
  
  // === ESTADO PARA PERSISTÊNCIA DE SESSÃO ===
  const [currentDocumentsHash, setCurrentDocumentsHash] = useState<string | null>(null);
  const [officeIdState, setOfficeIdState] = useState<string | null>(null);
  
  // Carregar office_id ao montar
  useEffect(() => {
    getCurrentOfficeId().then(id => setOfficeIdState(id));
  }, []);
  
  // === SESSION ID PARA ANÁLISES SOLTAS (SEM CASE_ID) ===
  const sessionIdRef = useRef<string | null>(null);
  const getOrCreateSessionId = () => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = crypto.randomUUID();
    }
    return sessionIdRef.current;
  };
  // Estado principal - MODO AUTOMÁTICO POR PADRÃO
  const [mode, setMode] = useState<"SUPERVISED" | "AUTOMATIC">("AUTOMATIC");
  const [selectedRamo, setSelectedRamo] = useState("__AUTO__");
  const [caseDescription, setCaseDescription] = useState("");
  
  // Perspectiva processual - RÉU por padrão
  const [actingSide, setActingSide] = useState<"REU" | "AUTOR">("REU");
  const [actingSideSource, setActingSideSource] = useState<"DEFAULT" | "AUTO" | "MANUAL">("DEFAULT");
  const [useAutoPolo, setUseAutoPolo] = useState(true);
  const [poloDetect, setPoloDetect] = useState<NijaPoloDetectResult | null>(null);
  const [lastPoloDetectKey, setLastPoloDetectKey] = useState<string>("");

  // Dados do processo para geração da peça (opcionais)
  const [clientName, setClientName] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [processNumber, setProcessNumber] = useState("");
  const [vara, setVara] = useState("");
  const [city, setCity] = useState("");
  const [lawyerName, setLawyerName] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [processYear, setProcessYear] = useState(""); // Ano extraído do CNJ

  // === MEMOIZED OPTIONS FOR HOOKS (avoid object identity changes) ===
  const extractionOptions = useMemo(() => ({
    actingSide,
    clientName,
    opponentName,
    processNumber,
    vara,
    city,
    lawyerName,
    oabNumber,
    setClientName,
    setOpponentName,
    setProcessNumber,
    setProcessYear,
    setVara,
    setCity,
    setLawyerName,
    setOabNumber,
  }), [
    actingSide,
    clientName,
    opponentName,
    processNumber,
    vara,
    city,
    lawyerName,
    oabNumber,
  ]);

  const analysisOptions = useMemo(() => ({
    mode,
    actingSide,
    selectedRamo,
    caseDescription,
    clientName,
    opponentName,
    processNumber,
    processYear,
    vara,
    city,
    lawyerName,
    oabNumber,
    setActingSide,
    setClientName,
    setOpponentName,
    setProcessNumber,
    setProcessYear,
    setVara,
    setCity,
  }), [
    mode,
    actingSide,
    selectedRamo,
    caseDescription,
    clientName,
    opponentName,
    processNumber,
    processYear,
    vara,
    city,
    lawyerName,
    oabNumber,
  ]);

  // Hook de extração de documentos
  const extraction = useNijaExtraction(extractionOptions);

  // Hook de análise NIJA (híbrida: IA + Motor Local)
  const analysis = useNijaAnalysis(analysisOptions);

  // UI
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [activeTab, setActiveTab] = useState("documentos");

  // Determinar passo atual
  const currentStep = useMemo(() => {
    if (operationMode === "EXTRACTION_ONLY" && extractionResult) return 3;
    if (analysis.analysisResult) return 3;
    return 1;
  }, [operationMode, extractionResult, analysis.analysisResult]) as 1 | 2 | 3;

  // Navegação do stepper
  const handleStepClick = useCallback((step: 1 | 2 | 3) => {
    // Step 1: Scroll para upload (topo)
    if (step === 1) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    // Step 2: Já está visível, não faz nada
    // Step 3: Scroll para resultados
    if (step === 3 && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Auto-scroll para resultados quando extração ou análise completa
  useEffect(() => {
    if ((extractionResult || analysis.analysisResult) && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [extractionResult, analysis.analysisResult]);

  // === LIMPAR TUDO ===
  const handleClearAll = useCallback(() => {
    // Limpar extração
    setExtractionResult(null);
    setIsExtracting(false);
    
    // Limpar estados de geração automática
    setLocalAnalysisResult(null);
    setCreatedCaseId(null);
    setIsCreatingCase(false);
    autoCreateTriggeredRef.current = false;
    
    // Limpar análise IA
    setAiAnalysisResult(null);
    setAiAnalysisLoading(false);
    setLastExtractionHash(null);
    setCurrentDocumentsHash(null);
    
    // Limpar análise (via hook - se disponível)
    // Limpar dados do formulário
    setClientName("");
    setOpponentName("");
    setProcessNumber("");
    setVara("");
    setCity("");
    setLawyerName("");
    setOabNumber("");
    setProcessYear("");
    setCaseDescription("");
    setSelectedRamo("__AUTO__");
    
    // Limpar documentos do hook de extração
    extraction.setProcessFiles([]);
    extraction.setManualDocText("");
    extraction.setManualDocLabel("");
    extraction.clearPreview?.();
    extraction.clearIdentifiedDocs?.();
    
    toast({
      title: "Tudo limpo",
      description: "Todos os documentos e resultados foram removidos.",
    });
  }, [extraction, toast]);

  // === CARREGAR SESSÃO ANTERIOR ===
  const handleLoadSession = useCallback((session: NijaSessionRow) => {
    // Restaurar extraction result
    if (session.extraction_result) {
      setExtractionResult(session.extraction_result as unknown as EprocExtractionResult);
    }
    
    // Restaurar analysis result
    if (session.analysis_result) {
      setAiAnalysisResult(session.analysis_result);
    }
    
    // Restaurar metadados
    if (session.cnj_number) setProcessNumber(session.cnj_number);
    if (session.client_name) setClientName(session.client_name);
    if (session.opponent_name) setOpponentName(session.opponent_name);
    if (session.acting_side) setActingSide(session.acting_side as "REU" | "AUTOR");
    if (session.case_id) setCreatedCaseId(session.case_id);
    
    // Atualizar hash atual
    setCurrentDocumentsHash(session.documents_hash);
    
    toast({
      title: "Sessão carregada",
      description: "A análise anterior foi restaurada com sucesso.",
    });
  }, [toast]);

  // === EXTRACTION MODE HANDLERS ===
  
  // Função interna para executar extração EPROC pura (com cache)
  const executeEprocExtraction = useCallback(async (rawText: string, system: DetectedProcessSystem = "EPROC") => {
    try {
      // PASSO 1: Obter office_id para cache
      const officeId = await getCurrentOfficeId();
      const userId = await getCurrentUserId();
      
      // PASSO 2: Calcular extraction_hash
      const extractionHash = await computeExtractionHash(rawText, system);
      
      // PASSO 3: Obter bookmarks do primeiro arquivo processado (se disponível)
      const firstFileBookmarks = extraction.processFiles[0]?.bookmarkResult || null;
      
      // PASSO 4: Verificar cache (se tiver office_id)
      let result: EprocExtractionResult | null = null;
      let fromCache = false;
      
      // PASSO 5: Verificar cache (agora valida automaticamente - caches sem eventos são deletados)
      if (officeId) {
        const cached = await getCachedExtraction(officeId, extractionHash);
        if (cached) {
          result = cached;
          fromCache = true;
          console.log(`[NIJA] Cache HIT - ${cached.eventos?.length ?? 0} eventos`);
        }
      }

      // PASSO 6: Se cache miss, executar extração COM BOOKMARKS
      if (!result) {
        console.log("[NIJA] Executando extração EPROC pura" + (firstFileBookmarks?.hasBookmarks ? ` (com ${firstFileBookmarks.documentos.length} bookmarks)` : ""));
        result = extractEprocDataPure(rawText, firstFileBookmarks);
        console.log(`[NIJA] Extração: ${result?.eventos?.length ?? 0} eventos, ${result?.pecasPosteriores?.length ?? 0} peças`);
        
        // Salvar no cache apenas se tiver eventos válidos
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

      // PASSO 6: Se ainda não tiver resultado, criar estrutura vazia
      if (!result) {
        console.error("[NIJA] Falha na extração - resultado nulo");
        throw new Error("Falha ao extrair dados do documento");
      }

      // Normalização defensiva: cache antigo ou extração parcial pode vir com blocos nulos
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
          ...(result as any).capa,
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
          ...(result as any).peticaoInicial,
        },
        advogado: {
          nome: PLACEHOLDER,
          oab: PLACEHOLDER,
          formatado: PLACEHOLDER,
          oabs: [],
          emCausaPropria: false,
          ...(result as any).advogado,
        },
        eventos: Array.isArray((result as any).eventos) ? (result as any).eventos : [],
        pecasPosteriores: Array.isArray((result as any).pecasPosteriores) ? (result as any).pecasPosteriores : [],
        meta: {
          dataExtracao: new Date().toISOString(),
          totalEventos: Array.isArray((result as any).eventos) ? (result as any).eventos.length : 0,
          totalPecas: 0,
          camposAusentes: [],
          ...(result as any).meta,
        },
      };
      
      // Helper UNIFICADO: verificar se nome contém ruídos que invalidam a extração
      const hasNoiseInName = (name: string | undefined | null): boolean => {
        if (!name) return true;
        const normalized = (name || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
        if (!normalized) return true;
        // Regra de ouro: se for curto demais, é ruído
        if (normalized.length < 8) return true;
        return /(senhor|juiz|doutor|vara|comarca|excelent|página|pagina|evento|direito|direitos|processo|eletrônico|eletronico|através|atraves|mediante|procurador|endereço|endereco|conforme|respeitosamente|presença|presenca|subscreve|pessoa|jurídica|juridica|inscrita|bairro|cep|estado|jardim|campo grande|rua bahia|profissional|fundações|fundacoes|comunicações|comunicacoes|estilo|mandato|incluso|abaixo|assinados|propor|presente)/i.test(normalized);
      };
      
      // Enrich with detected metadata if available

      // CONSOLIDAÇÃO V2.4: Se V2 tem ruído ou está vazio, priorizar fallback 100%
      let v2Author = extraction.detectedMetadata?.authorName;
      let v2Defendant = extraction.detectedMetadata?.defendantName;
      const fallbackAuthor = result.peticaoInicial.autores[0];
      const fallbackDefendant = result.peticaoInicial.reus[0];

      // Regra de Ouro da Consolidação:
      // - se V2 for curto (<8) OU contiver termos proibidos OU for palavra única, apaga para obrigar fallback
      const isSingleWord = (val: string | undefined | null): boolean => {
        if (!val) return true;
        const words = val.replace(/\s+/g, " ").trim().split(" ").filter(w => w.length > 2);
        return words.length <= 1;
      };

      const v2AuthorHasNoise = hasNoiseInName(v2Author) || (typeof v2Author === "string" && v2Author.replace(/\s+/g, " ").trim().length < 8);
      const v2DefendantHasNoise = hasNoiseInName(v2Defendant) || (typeof v2Defendant === "string" && v2Defendant.replace(/\s+/g, " ").trim().length < 8) || isSingleWord(v2Defendant);

      if (v2AuthorHasNoise) v2Author = undefined;
      if (v2DefendantHasNoise) v2Defendant = undefined;

      console.log("[NIJA Consolidação] V2 Author:", v2Author, "| hasNoise:", v2AuthorHasNoise);
      console.log("[NIJA Consolidação] V2 Defendant:", v2Defendant, "| hasNoise:", v2DefendantHasNoise);
      console.log("[NIJA Consolidação] Fallback Author:", fallbackAuthor, "| Fallback Defendant:", fallbackDefendant);

      // Priorizar fallback se V2 foi apagado
      const finalAuthor = !v2Author ? fallbackAuthor : v2Author;
      const finalDefendant = !v2Defendant ? fallbackDefendant : v2Defendant;

      // BYPASS DE CACHE (pós-consolidação): se o autor final ainda for ruidoso/curto, apaga cache e força re-extração no próximo run
      const finalAuthorNormalized = String(finalAuthor || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
      const finalAuthorIsBad = !finalAuthorNormalized || finalAuthorNormalized.length < 8 || hasNoiseInName(finalAuthorNormalized);
      if (finalAuthorIsBad && officeId) {
        console.log("[NIJA] Autor final ruidoso, apagando cache:", finalAuthorNormalized);
        deleteCachedExtraction(officeId, extractionHash).catch(() => {});
      }

      console.log("[NIJA Consolidação] Final Author:", finalAuthor, "| Final Defendant:", finalDefendant);
      if (extraction.detectedMetadata) {
        if (extraction.detectedMetadata.cnjNumber && result.capa.numeroCnj === PLACEHOLDER) {
          result.capa.numeroCnj = extraction.detectedMetadata.cnjNumber;
        }
        if (extraction.detectedMetadata.vara && result.capa.varaJuizo === PLACEHOLDER) {
          result.capa.varaJuizo = extraction.detectedMetadata.vara;
        }
        if (extraction.detectedMetadata.comarca && result.capa.comarca === PLACEHOLDER) {
          result.capa.comarca = extraction.detectedMetadata.comarca;
        }
        
        // Usar nome consolidado (fallback prioritário se V2 tem ruído)
        if (finalAuthor) {
          const current = result.peticaoInicial.autores[0];
          if (result.peticaoInicial.autores.length === 0 || hasNoiseInName(current)) {
            result.peticaoInicial.autores = [finalAuthor];
          }
        }
        if (finalDefendant) {
          const current = result.peticaoInicial.reus[0];
          if (result.peticaoInicial.reus.length === 0 || hasNoiseInName(current)) {
            result.peticaoInicial.reus = [finalDefendant];
          }
        }
        
        // IMPORTANTE: Sobrescrever detectedMetadata com nomes consolidados para o caseCreator
        extraction.detectedMetadata.authorName = finalAuthor;
        extraction.detectedMetadata.defendantName = finalDefendant;
        
        // Enrich advogado
        if (extraction.detectedMetadata.lawyerName && result.advogado.nome === PLACEHOLDER) {
          result.advogado.nome = extraction.detectedMetadata.lawyerName;
        }
        if (extraction.detectedMetadata.oabNumber && result.advogado.oab === PLACEHOLDER) {
          result.advogado.oab = extraction.detectedMetadata.oabNumber;
        }
        // Rebuild formatted string
        if (result.advogado.nome !== PLACEHOLDER || result.advogado.oab !== PLACEHOLDER) {
          result.advogado.formatado = result.advogado.nome !== PLACEHOLDER && result.advogado.oab !== PLACEHOLDER
            ? `${result.advogado.nome} — OAB ${result.advogado.oab}`
            : result.advogado.nome !== PLACEHOLDER
              ? result.advogado.nome
              : `OAB ${result.advogado.oab}`;
        }
        
        // Add events from detected metadata V2 (somente se NÃO houver eventos extraídos do texto)
        // Verifica se V2 tem peças agrupadas (melhor estruturado)
        const v2HasGroupedPecas = extraction.detectedMetadata.events?.some(e => e.pecas && e.pecas.length > 0);
        const v1HasData = result.eventos && result.eventos.length > 0;
        
        if (
          extraction.detectedMetadata.events &&
          extraction.detectedMetadata.events.length > 0 &&
          (!v1HasData || v2HasGroupedPecas)
        ) {
          result.eventos = extraction.detectedMetadata.events.map((e, idx) => ({
            numeroEvento: e.eventNumber ?? idx + 1,
            data: e.date,
            hora: null,
            tipoEvento: e.code || "EVENTO",
            descricaoLiteral: e.description,
            documentoVinculado: null,
            codigoTjto: e.code || null,
            labelEnriquecido: e.enrichedLabel || null,
            // NOVO: incluir peças agrupadas se disponíveis
            pecasAnexas: e.pecas?.map(p => ({
              codigo: p.code,
              paginas: p.pages,
              label: p.label,
            })) || undefined,
          }));
          result.meta.totalEventos = result.eventos.length;
          
          // Calcular total de peças para exibição correta
          const totalPecas = result.eventos.reduce((sum, ev) => sum + (ev.pecasAnexas?.length || 1), 0);
          (result.meta as any).totalPecas = totalPecas;
        }
      }

      setExtractionResult(result);

      // === AUTO-DETECT POLO FROM EXTRACTION ===
      const poloKey = String(rawText?.length ?? 0) + ":" + (rawText?.slice(0, 200) ?? "");
      if (poloKey !== lastPoloDetectKey) {
        setLastPoloDetectKey(poloKey);
        
        const detectedClientName = clientName || finalAuthor || extraction.detectedMetadata?.authorName;
        // clientDoc may not exist on all metadata types
        const detectedClientDoc = (extraction.detectedMetadata as any)?.clientDoc;
        
        const poloResult = detectPoloFromEprocText({
          rawText,
          lines: rawText.split("\n"),
          clientName: detectedClientName,
          clientDoc: detectedClientDoc,
          clientMetaRole: null,
        });
        
        console.log("[NIJA] Polo detection:", poloResult);
        setPoloDetect(poloResult);
        
        // Apply auto-polo if enabled and not manually set
        if (useAutoPolo && actingSideSource !== "MANUAL" && poloResult.poloDetected !== "INDEFINIDO") {
          setActingSide(poloResult.poloDetected);
          setActingSideSource("AUTO");
        }
      }

      const cacheMsg = fromCache ? " (cache)" : "";
      
      // Setar hash para uso posterior
      setLastExtractionHash(extractionHash);
      
      // Calcular e setar hash dos documentos para detecção de duplicatas
      const inputs = extraction.getAllNijaInputs();
      const docContents = inputs.map(d => d.content);
      const docNames = inputs.map(d => d.filename);
      const docHash = await computeDocumentsHash(docContents);
      setCurrentDocumentsHash(docHash);
      
      // Salvar sessão no banco para histórico
      if (officeId && userId) {
        try {
          await saveNijaSession({
            officeId,
            createdBy: userId,
            documentsHash: docHash,
            documentCount: inputs.length,
            documentNames: docNames,
            documentIds: extraction.getDocumentIds(),
            extractionResult: result,
            analysisResult: localAnalysisResult,
            cnjNumber: result.capa.numeroCnj !== "Não identificado nos documentos analisados" ? result.capa.numeroCnj : null,
            clientName: clientName || null,
            opponentName: opponentName || null,
            actingSide,
            caseId: createdCaseId,
            status: "completed",
          });
          console.log("[NIJA] Sessão salva no banco");
        } catch (saveErr) {
          console.warn("[NIJA] Erro ao salvar sessão:", saveErr);
        }
      }
      
      // Contar eventos ÚNICOS e total de peças
      const uniqueEventCount = result.eventos?.length || 0;
      const totalPecas = result.eventos?.reduce((sum, ev) => sum + (ev.pecasAnexas?.length || 1), 0) || uniqueEventCount;
      
      toast({
        title: `Extração EPROC concluída${cacheMsg}`,
        description: totalPecas > uniqueEventCount 
          ? `${uniqueEventCount} evento(s) com ${totalPecas} peça(s) extraída(s). Nenhuma IA foi utilizada.`
          : `${uniqueEventCount} evento(s) extraído(s). Nenhuma IA foi utilizada.`,
      });
    } catch (err) {
      console.error("[NIJA] Erro na extração:", err);
      toast({
        title: "Erro na extração",
        description: "Não foi possível extrair os dados dos documentos.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  }, [extraction.detectedMetadata, extraction.getDocumentIds, extraction.processFiles, createdCaseId, toast, lastPoloDetectKey, useAutoPolo, actingSideSource, clientName]);

  // Run pure EPROC extraction (no AI) - with cache support
  const handleRunExtraction = useCallback(async () => {
    if (!extraction.hasContent) {
      toast({
        title: "Nenhum conteúdo",
        description: "Adicione ao menos um documento ou texto para extração.",
        variant: "destructive",
      });
      return;
    }

    setIsExtracting(true);
    setExtractionResult(null);

    try {
      // Get all document content
      const inputs = extraction.getAllNijaInputs();
      const rawText = inputs.map(d => d.content).join("\n\n---\n\n");

      // Detectar sistema processual
      const sys = detectProcessSystemFromText(rawText);
      setDetectedSystem(sys);

      // Se NÃO for EPROC, perguntar o que fazer
      if (sys !== "EPROC") {
        setShowNonEprocPrompt(true);
        setIsExtracting(false);
        return;
      }

      // É EPROC: segue extração pura SEM IA e sem perguntar
      await executeEprocExtraction(rawText, sys);
    } catch (err) {
      console.error("[NIJA] Erro na extração:", err);
      toast({
        title: "Erro na extração",
        description: "Não foi possível extrair os dados dos documentos.",
        variant: "destructive",
      });
      setIsExtracting(false);
    }
  }, [extraction.hasContent, extraction.getAllNijaInputs, toast, executeEprocExtraction, extraction.processFiles]);

  // Handler para forçar extração EPROC mesmo quando sistema não reconhecido
  const handleForceEprocExtraction = useCallback(async () => {
    setShowNonEprocPrompt(false);
    setIsExtracting(true);
    
    const inputs = extraction.getAllNijaInputs();
    const rawText = inputs.map(d => d.content).join("\n\n---\n\n");
    
    // Usa o detectedSystem atual (que foi detectado antes do prompt)
    await executeEprocExtraction(rawText, detectedSystem);
  }, [extraction.getAllNijaInputs, executeEprocExtraction, detectedSystem]);

  // Handler para continuar sem extração (usuário vai usar análise depois)
  const handleSkipExtraction = useCallback(() => {
    setShowNonEprocPrompt(false);
    toast({
      title: "Aviso",
      description: "Formato não-EPROC: extração automática literal pode ficar incompleta.",
    });
  }, [toast]);

  // Clear extraction result when switching modes
  useEffect(() => {
    if (operationMode === "NIJA_ANALYSIS") {
      setExtractionResult(null);
      setLocalAnalysisResult(null);
      setCreatedCaseId(null);
      autoCreateTriggeredRef.current = false;
    }
  }, [operationMode]);

  // === AUTO-CREATE CASE AFTER EXTRACTION ===
  // When extraction completes, automatically run local analysis and create case
  // Use extractionResult.meta.totalEventos as stable key to avoid re-triggering
  const extractionKey = extractionResult?.meta?.totalEventos ?? null;
  
  useEffect(() => {
    if (!extractionResult || !extractionKey) return;
    if (operationMode !== "EXTRACTION_ONLY") return;
    if (createdCaseId) return;
    if (isCreatingCase) return;
    if (autoCreateTriggeredRef.current) return;
    
    autoCreateTriggeredRef.current = true;
    
    const timeoutId = setTimeout(() => {
      handleAutoCreateCase();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [
    extractionKey,
    operationMode,
    createdCaseId,
    isCreatingCase,
    extractionResult,
  ]);

  // Handler for automatic case creation after extraction
  const handleAutoCreateCase = async () => {
    if (!extractionResult) return;
    
    console.log(`[NIJA] handleAutoCreateCase: ${extractionResult.meta.totalEventos} eventos extraídos`);
    console.log(`[NIJA] Autores:`, extractionResult.peticaoInicial.autores);
    console.log(`[NIJA] Réus:`, extractionResult.peticaoInicial.reus);
    console.log(`[NIJA] CNJ:`, extractionResult.capa.numeroCnj);
    
    setIsCreatingCase(true);
    
    try {
      // 1. Build documents for analyzer
      const inputs = extraction.getAllNijaInputs();
      const nijaDocuments: NijaDocumentInput[] = inputs.map((doc, idx) => ({
        id: doc.id || `doc-${idx}`,
        filename: doc.filename || `documento-${idx + 1}`,
        content: doc.content,
        kind: doc.kind,
      }));
      
      // 2. Run local heuristic analysis (NO AI)
      const analysisResult = runNijaAnalyzer({
        mode: "AUTOMATIC",
        caseContext: {
          polo: actingSide === "REU" ? "REU" : "AUTOR",
        },
        documents: nijaDocuments,
      });
      
      setLocalAnalysisResult(analysisResult);
      
      // 3. Determine client name (never use "não identificado" if we have party data)
      const PLACEHOLDER = "Não identificado nos documentos analisados";
      const autores = extractionResult.peticaoInicial.autores.filter(a => a && a !== PLACEHOLDER);
      const reus = extractionResult.peticaoInicial.reus.filter(r => r && r !== PLACEHOLDER);
      
      let finalClientName = clientName;
      let finalOpponentName = opponentName;
      
      if (!finalClientName || finalClientName === "Cliente não identificado") {
        if (actingSide === "REU") {
          finalClientName = reus[0] || autores[0] || "Cliente NIJA";
        } else {
          finalClientName = autores[0] || reus[0] || "Cliente NIJA";
        }
      }
      
      if (!finalOpponentName) {
        if (actingSide === "REU") {
          finalOpponentName = autores[0] || "";
        } else {
          finalOpponentName = reus[0] || "";
        }
      }
      
      // 4. Get document IDs to link
      const documentIds = extraction.getDocumentIds();
      
      // 5. Create case in database (NO AI)
      const rawCnj = processNumber || extractionResult.capa.numeroCnj;
      const cleanCnj = (rawCnj || "").replace(/[^\d.-]/g, "");

      const result = await createCaseFromExtraction({
        extractionResult,
        analysisResult,
        actingSide,
        clientName: finalClientName,
        opponentName: finalOpponentName,
        processNumber: cleanCnj,
        lawyerName: lawyerName || extractionResult.advogado.nome,
        oabNumber: oabNumber || extractionResult.advogado.oab,
        vara: vara || extractionResult.capa.varaJuizo,
        city: city || extractionResult.capa.comarca,
        documentIds,
      });
      
      setCreatedCaseId(result.caseId);
      
      toast({
        title: "Caso criado automaticamente",
        description: `Caso criado com ${extractionResult.meta.totalEventos} evento(s) e ${analysisResult.usedDefects.length} vício(s) detectado(s).`,
      });
    } catch (err) {
      console.error("[NIJA] Erro ao criar caso automaticamente:", err);
      toast({
        title: "Erro ao criar caso",
        description: err instanceof Error ? err.message : "Não foi possível criar o caso automaticamente.",
        variant: "destructive",
      });
      autoCreateTriggeredRef.current = false; // Allow retry
    } finally {
      setIsCreatingCase(false);
    }
  };

  // === HANDLER PARA ANÁLISE IA PÓS-EXTRAÇÃO ===
  const handleRunPostExtractionAIAnalysis = useCallback(async () => {
    if (!extractionResult) return;
    
    setAiAnalysisLoading(true);
    
    try {
      // Get all document content
      const inputs = extraction.getAllNijaInputs();
      const rawText = inputs.map(d => d.content).join("\n\n---\n\n");
      
      // Run full AI analysis via edge function
      const result = await runNijaFullAnalysisQuick({
        rawText,
        poloHint: actingSide === "REU" ? "REU" : "AUTOR",
        caseId: createdCaseId || null,
        ramoHint: selectedRamo !== "__AUTO__" ? selectedRamo : null,
        poloDetected: poloDetect?.poloDetected ?? null,
        poloSource: poloDetect?.poloSource ?? null,
        poloConfidence: poloDetect?.confidence ?? null,
        poloEvidences: poloDetect?.evidences ?? null,
      });
      
      setAiAnalysisResult(result);
      
      // Link case_id to extraction cache
      if (result.caseId && lastExtractionHash) {
        const officeId = await getCurrentOfficeId();
        if (officeId) {
          await updateExtractionCaseId({
            officeId,
            extractionHash: lastExtractionHash,
            caseId: result.caseId,
          });
        }
      }
      
      toast({
        title: "Análise IA concluída",
        description: `${result?.vicios?.length || 0} vício(s) e ${result?.estrategias?.principais?.length || 0} estratégia(s) identificada(s).`,
      });
    } catch (err) {
      console.error("[NIJA] Erro na análise IA:", err);
      toast({
        title: "Erro na análise IA",
        description: err instanceof Error ? err.message : "Não foi possível executar a análise.",
        variant: "destructive",
      });
    } finally {
      setAiAnalysisLoading(false);
    }
  }, [extractionResult, extraction.getAllNijaInputs, actingSide, createdCaseId, selectedRamo, lastExtractionHash, toast]);

  // Auto-fill form fields: REMOVIDO - lógica centralizada em useNijaExtraction.ts
  // Isso evita duplicação e conflitos de estado entre o hook e a página

  // Auto-run EPROC extraction when documents become ready (EXTRACTION_ONLY mode)
  // Só roda automaticamente se toggle autoRunExtraction estiver ativo
  const prevHasContentRef = useRef(false);
  useEffect(() => {
    const becameReady =
      operationMode === "EXTRACTION_ONLY" &&
      extraction.hasContent &&
      !prevHasContentRef.current;
    if (becameReady && autoRunExtraction && !extractionResult && !isExtracting && extraction.extractingCount === 0) {
      handleRunExtraction();
    }
    prevHasContentRef.current = extraction.hasContent;
  }, [
    operationMode,
    extraction.hasContent,
    extraction.extractingCount,
    extractionResult,
    isExtracting,
    handleRunExtraction,
    autoRunExtraction,
  ]);

  // Handlers para usar os hooks
  const handleRunAnalysis = useCallback(() => {
    if (operationMode === "EXTRACTION_ONLY") {
      handleRunExtraction();
      return;
    }
    
    analysis.runAnalysis(extraction.getAllNijaInputs(), {
      identifiedDocs: extraction.identifiedDocs,
      detectedMetadata: extraction.detectedMetadata,
      manualDocText: extraction.manualDocText,
    });
  }, [operationMode, handleRunExtraction, analysis, extraction]);

  const handleGenerateDraft = useCallback(() => {
    analysis.generateDraft(extraction.getAllNijaInputs(), extraction.manualDocText);
  }, [analysis, extraction]);

  const handleGeneratePiece = useCallback(() => {
    analysis.generatePiece(extraction.getAllNijaInputs());
  }, [analysis, extraction]);

  // Métricas derivadas
  const defectsCount = analysis.analysisResult?.recommendation?.findings?.length ?? 0;
  const mainStrategiesCount = analysis.analysisResult?.recommendation?.mainStrategies?.length ?? 0;
  const secondaryStrategiesCount = analysis.analysisResult?.recommendation?.secondaryStrategies?.length ?? 0;
  const ramoFinal: NijaRamo | undefined =
    analysis.analysisResult?.ramoFinal || (selectedRamo !== "__AUTO__" ? (selectedRamo as NijaRamo) : undefined);
  const warnings: string[] = analysis.analysisResult?.warnings ?? [];

  // Status de documentos considerados
  const inputsSummary = useMemo(() => {
    const parts: string[] = [];
    if (extraction.readyFilesCount > 0) {
      parts.push(`${extraction.readyFilesCount} arquivo(s)`);
    }
    if (extraction.manualDocText.trim().length > 0) {
      parts.push("texto complementar");
    }
    return parts.length > 0 ? `Documentos considerados: ${parts.join(" + ")}` : "";
  }, [extraction.readyFilesCount, extraction.manualDocText]);

  // Indicador de progresso de arquivos
  const progressIndicator = useMemo(() => {
    const total = extraction.processFiles.length;
    const ready = extraction.readyFilesCount;
    if (total === 0) return null;
    if (ready === total) return null; // Todos prontos, não precisa mostrar
    return `${ready} de ${total} arquivo(s) processado(s)`;
  }, [extraction.processFiles.length, extraction.readyFilesCount]);

  // Verifica se há metadados detectados para auto-expandir collapsible
  const hasDetectedMetadata = useMemo(() => {
    return !!(
      processNumber ||
      clientName ||
      opponentName ||
      vara ||
      city ||
      lawyerName ||
      oabNumber
    );
  }, [processNumber, clientName, opponentName, vara, city, lawyerName, oabNumber]);


  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        {/* HEADER PREMIUM */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-6 md:p-8">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Botão Voltar */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate(-1)} 
                  className="h-10 w-10 rounded-xl hover:bg-primary/10"
                  title="Voltar"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30">
                  <Brain className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
                    NIJA
                    <NijaTooltip />
                    {/* Badge de modo ativo */}
                    <Badge 
                      variant="secondary" 
                      className="ml-2 text-xs font-normal flex items-center gap-1"
                    >
                      {operationMode === "EXTRACTION_ONLY" ? (
                        <>
                          <FileSearch className="h-3 w-3" />
                          Extração EPROC
                        </>
                      ) : (
                        <>
                          <Zap className="h-3 w-3" />
                          Análise NIJA
                        </>
                      )}
                    </Badge>
                  </h1>
                  <p className="text-sm text-muted-foreground">Central de Análise Processual</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start">
                {/* Botão Limpar Tudo */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleClearAll}
                  className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpar tudo
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowInfoModal(true)} className="gap-2">
                  <Info className="h-4 w-4" />
                  O que é o NIJA?
                </Button>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground max-w-2xl">
              Analise documentos jurídicos e identifique vícios, nulidades, riscos e estratégias de ataque/defesa.
              <span className="block mt-1 text-xs opacity-75">
                Nada é salvo no sistema sem sua confirmação. Todo processamento é feito em memória.
              </span>
            </p>
          </div>
        </section>

        {/* SELETOR DE PERSPECTIVA PROCESSUAL - PREMIUM */}
        <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Perspectiva processual</p>
                  <p className="text-xs text-muted-foreground">Defina se o NIJA atua pelo RÉU ou AUTOR</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 md:ml-auto">
                <Button
                  variant={actingSide === "REU" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setActingSide("REU"); setActingSideSource("MANUAL"); }}
                  className="gap-2"
                >
                  <Shield className="h-4 w-4" />
                  RÉU
                  {actingSideSource === "AUTO" && actingSide === "REU" && <Badge variant="secondary" className="ml-1 text-[10px]">auto</Badge>}
                  {actingSideSource === "DEFAULT" && actingSide === "REU" && <Badge variant="outline" className="ml-1 text-[10px]">padrão</Badge>}
                </Button>
                <Button
                  variant={actingSide === "AUTOR" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setActingSide("AUTOR"); setActingSideSource("MANUAL"); }}
                  className="gap-2"
                >
                  <Swords className="h-4 w-4" />
                  AUTOR
                  {actingSideSource === "AUTO" && actingSide === "AUTOR" && <Badge variant="secondary" className="ml-1 text-[10px]">auto</Badge>}
                </Button>
                
                {/* Botão Inverter */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setActingSide(prev => prev === "REU" ? "AUTOR" : "REU"); setActingSideSource("MANUAL"); }}
                  className="gap-1 text-muted-foreground hover:text-foreground"
                  title="Inverter polo"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
                
                {/* Toggle Auto-detectar */}
                <div className="flex items-center gap-2 ml-2 pl-2 border-l">
                  <Switch
                    checked={useAutoPolo}
                    onCheckedChange={(enabled) => {
                      setUseAutoPolo(enabled);
                      if (enabled && poloDetect?.poloDetected !== "INDEFINIDO" && actingSideSource !== "MANUAL") {
                        setActingSide(poloDetect!.poloDetected);
                        setActingSideSource("AUTO");
                      }
                    }}
                    id="auto-polo"
                  />
                  <label htmlFor="auto-polo" className="text-xs text-muted-foreground cursor-pointer">Auto</label>
                </div>
              </div>
            </div>
            
            {/* Polo detection info (when available) */}
            {poloDetect && poloDetect.poloDetected !== "INDEFINIDO" && (
              <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                <span className="font-medium">Detectado: </span>
                <Badge variant="outline" className="text-[10px] mr-1">{poloDetect.poloDetected}</Badge>
                <span className="opacity-75">
                  ({poloDetect.poloSource}, {Math.round(poloDetect.confidence * 100)}%)
                </span>
                {poloDetect.evidences.length > 0 && (
                  <span className="ml-2 opacity-60">• {poloDetect.evidences[0]}</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SELETOR DE MODO DE OPERAÇÃO */}
        <NijaExtractionModeToggle
          mode={operationMode}
          onModeChange={setOperationMode}
          disabled={analysis.analysisLoading || isExtracting}
        />

        {/* Toggle de extração automática - só visível no modo EXTRACTION_ONLY */}
        {operationMode === "EXTRACTION_ONLY" && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <Switch
              checked={autoRunExtraction}
              onCheckedChange={setAutoRunExtraction}
              id="auto-extraction"
            />
            <label htmlFor="auto-extraction" className="text-sm cursor-pointer flex-1">
              <span className="font-medium">Extração automática</span>
              <span className="block text-xs text-muted-foreground">
                {autoRunExtraction 
                  ? "Processa documentos assim que carregados" 
                  : "Aguarda clique no botão para processar"}
              </span>
            </label>
            {!autoRunExtraction && extraction.hasContent && !extractionResult && !isExtracting && (
              <Button size="sm" onClick={handleRunExtraction} disabled={isExtracting}>
                <Zap className="h-4 w-4 mr-1" />
                Extrair
              </Button>
            )}
          </div>
        )}

        {/* STEPPER - CLICÁVEL E RESPONSIVO */}
        <div className="py-4">
          <NijaStepper 
            currentStep={currentStep} 
            onStepClick={handleStepClick}
            canNavigateToStep2={extraction.hasContent}
            canNavigateToStep3={!!(extractionResult || analysis.analysisResult)}
            isLoading={isExtracting || analysis.analysisLoading}
            loadingStep={isExtracting ? 1 : analysis.analysisLoading ? 2 : null}
          />
        </div>

        {/* INDICADOR DE PROGRESSO GERAL */}
        {progressIndicator && (
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">{progressIndicator}</span>
          </div>
        )}

        {/* LAYOUT PRINCIPAL - DUAS COLUNAS */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* COLUNA ESQUERDA - ENTRADAS (Passo 1) */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/30">
                1
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Enviar documentos para análise</h2>
                <p className="text-xs text-muted-foreground">
                  Anexe PDFs/TXT ou cole o texto. Nada será salvo no sistema.
                </p>
              </div>
            </div>

            {/* Card de sessões anteriores */}
            <NijaPreviousSessions
              officeId={officeIdState}
              currentDocumentsHash={currentDocumentsHash}
              onLoadSession={handleLoadSession}
              onSessionDeleted={() => {
                toast({
                  title: "Sessão excluída",
                  description: "A análise foi removida do histórico.",
                });
              }}
            />

            {/* Card 1 - Arquivos do processo */}
            <NijaDocumentUpload
              processFiles={extraction.processFiles}
              onSelectFiles={() => extraction.processFilesInputRef.current?.click()}
              onRemoveFile={extraction.removeProcessFile}
              onClearAll={extraction.clearAllProcessFiles}
              onCancelExtraction={(fileId) => {
                extraction.setProcessFiles((prev) =>
                  prev.map((f) =>
                    f.id === fileId
                      ? { ...f, status: "error", errorMessage: "Leitura cancelada pelo usuário" }
                      : f
                  )
                );
                toast({
                  title: "Leitura cancelada",
                  description: "O arquivo foi marcado como erro para liberar o fluxo.",
                });
              }}
              onRetryExtraction={(fileId) => {
                extraction.retryExtraction(fileId);
              }}
              getExtractionProgress={extraction.getExtractionProgress}
              readyCount={extraction.readyFilesCount}
              totalCount={extraction.processFiles.length}
              inputRef={extraction.processFilesInputRef}
              onFileInputChange={extraction.handleProcessFilesChange}
            />

            {/* Card de prévia do documento (após extração) - ESTRUTURADO */}
            {/* PRIORIDADE: extractionResult (dados corretos) > detectedMetadata (V2 truncado) */}
            <NijaDocumentPreview
              detectedMetadata={extractionResult ? {
                // Usar dados do extractionResult quando disponível
                cnjNumber: extractionResult.capa.numeroCnj !== "Não identificado nos documentos analisados" 
                  ? extractionResult.capa.numeroCnj 
                  : extraction.detectedMetadata?.cnjNumber,
                authorName: extractionResult.peticaoInicial.autores[0] !== "Não identificado nos documentos analisados"
                  ? extractionResult.peticaoInicial.autores[0]
                  : extraction.detectedMetadata?.authorName,
                defendantName: extractionResult.peticaoInicial.reus[0] !== "Não identificado nos documentos analisados"
                  ? extractionResult.peticaoInicial.reus[0]
                  : extraction.detectedMetadata?.defendantName,
                lawyerName: extractionResult.advogado.nome !== "Não identificado nos documentos analisados"
                  ? extractionResult.advogado.nome
                  : extraction.detectedMetadata?.lawyerName,
                oabNumber: extractionResult.advogado.oab !== "Não identificado nos documentos analisados"
                  ? extractionResult.advogado.oab
                  : extraction.detectedMetadata?.oabNumber,
                vara: extractionResult.capa.varaJuizo !== "Não identificado nos documentos analisados"
                  ? extractionResult.capa.varaJuizo
                  : extraction.detectedMetadata?.vara,
                comarca: extractionResult.capa.comarca !== "Não identificado nos documentos analisados"
                  ? extractionResult.capa.comarca
                  : extraction.detectedMetadata?.comarca,
                events: extraction.detectedMetadata?.events,
                defendants: extraction.detectedMetadata?.defendants,
              } : extraction.detectedMetadata}
              documentPreview={extraction.documentPreview}
              isLoadingPreview={extraction.isLoadingPreview}
              actingSide={actingSide}
              clientName={clientName}
              opponentName={opponentName}
              processNumber={processNumber}
              lawyerName={lawyerName}
              oabNumber={oabNumber}
              onClear={extraction.clearPreview}
            />

            {/* Card de documentos identificados pelo dicionário TJTO */}
            <NijaIdentifiedDocsCard
              identifiedDocs={extraction.identifiedDocs}
              onClear={extraction.clearIdentifiedDocs}
            />

            {/* Card 2 - Documento complementar */}
            {/* Card 2 - Documento complementar */}
            <NijaComplementaryDoc
              label={extraction.manualDocLabel}
              onLabelChange={extraction.setManualDocLabel}
              text={extraction.manualDocText}
              onTextChange={extraction.setManualDocText}
              onClear={extraction.clearManualDoc}
              inputRef={extraction.manualFileInputRef}
              onFileInputChange={extraction.handleManualFileInputChange}
            />
          </div>

          {/* COLUNA DIREITA - CONFIGURAÇÃO (Passo 2) */}
          <NijaAnalysisConfig
            mode={mode}
            onModeChange={setMode}
            operationMode={operationMode}
            selectedRamo={selectedRamo}
            onRamoChange={setSelectedRamo}
            caseDescription={caseDescription}
            onCaseDescriptionChange={setCaseDescription}
            clientName={clientName}
            onClientNameChange={setClientName}
            opponentName={opponentName}
            onOpponentNameChange={setOpponentName}
            processNumber={processNumber}
            onProcessNumberChange={setProcessNumber}
            processYear={processYear}
            onProcessYearChange={setProcessYear}
            vara={vara}
            onVaraChange={setVara}
            city={city}
            onCityChange={setCity}
            lawyerName={lawyerName}
            onLawyerNameChange={setLawyerName}
            oabNumber={oabNumber}
            onOabNumberChange={setOabNumber}
            hasDetectedMetadata={hasDetectedMetadata}
            onSwapParties={() => {
              const temp = clientName;
              setClientName(opponentName);
              setOpponentName(temp);
              toast({
                title: "Partes invertidas",
                description: "Cliente e Parte contrária foram trocados.",
              });
            }}
            onClearProcessData={() => {
              setClientName("");
              setOpponentName("");
              setProcessNumber("");
              setProcessYear("");
              setVara("");
              setCity("");
              setLawyerName("");
              setOabNumber("");
              toast({
                title: "Dados limpos",
                description: "Todos os campos do processo foram resetados.",
              });
            }}
            onRunAnalysis={handleRunAnalysis}
            onGenerateDraft={handleGenerateDraft}
            analysisLoading={analysis.analysisLoading || isExtracting}
            draftLoading={analysis.draftLoading}
            hasContent={extraction.hasContent}
            extractingCount={extraction.extractingCount}
            inputsSummary={inputsSummary}
            hasAnalysisResult={!!analysis.analysisResult}
            disabled={!extraction.hasContent}
          />
        </div>

        {/* ZONA 3: RESULTADOS (Passo 3) - COM REF PARA AUTO-SCROLL */}
        <div ref={resultsRef}>
          {/* EXTRACTION MODE: Show extraction result card + Post-extraction panel */}
          {operationMode === "EXTRACTION_ONLY" && (
            <>
              <NijaExtractionResultCard
                extractionResult={extractionResult}
                bookmarkResult={extraction.processFiles[0]?.bookmarkResult}
                isLoading={isExtracting}
              />
              
              {/* Post-extraction panel with analysis, case creation, and actions */}
              {extractionResult && (
                <div className="mt-6">
                  <NijaPostExtractionPanel
                    extractionResult={extractionResult}
                    analysisResult={localAnalysisResult}
                    isAnalyzing={false}
                    createdCaseId={createdCaseId}
                    isCreatingCase={isCreatingCase}
                    actingSide={actingSide}
                    clientName={clientName}
                    opponentName={opponentName}
                    processNumber={processNumber}
                    lawyerName={lawyerName}
                    oabNumber={oabNumber}
                    onRunAIAnalysis={handleRunPostExtractionAIAnalysis}
                    aiAnalysisLoading={aiAnalysisLoading}
                    aiAnalysisResult={aiAnalysisResult}
                  />
                </div>
              )}
            </>
          )}

          {/* NIJA ANALYSIS MODE: Show full results panel */}
          {operationMode === "NIJA_ANALYSIS" && (
          <Suspense fallback={<ResultsPanelSkeleton />}>
            <NijaResultsPanel
              analysisResult={analysis.analysisResult}
              analysisLoading={analysis.analysisLoading}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              defectsCount={defectsCount}
              mainStrategiesCount={mainStrategiesCount}
              secondaryStrategiesCount={secondaryStrategiesCount}
              processFiles={extraction.processFiles.map((pf) => ({
                id: pf.id,
                filename: pf.filename,
                size: pf.size,
                status: pf.status,
              }))}
              manualDocText={extraction.manualDocText}
              manualDocLabel={extraction.manualDocLabel}
              ramoFinal={ramoFinal}
              ramoLabel={ramoLabel}
              autoCaseId={analysis.autoCaseId}
              onNavigateToCase={(caseId) => navigate(`/cases?case=${caseId}`)}
              warnings={warnings}
              showTechnicalDetails={showTechnicalDetails}
              onShowTechnicalDetailsChange={setShowTechnicalDetails}
              generatedPiece={analysis.generatedPiece}
              isGeneratingPiece={analysis.isGeneratingPiece}
              onGeneratePiece={handleGeneratePiece}
              onCopyPieceText={analysis.copyPieceText}
              onClearPiece={() => analysis.setGeneratedPiece(null)}
              draftText={analysis.draftText}
              onCopyDraft={analysis.copyDraft}
              onClearDraft={analysis.clearDraft}
              formatFileSize={formatFileSize}
              severityLabelColor={severityLabelColor}
              impactLabel={impactLabel}
            />
          </Suspense>
          )}
        </div>

        {/* Modal de informações */}
        <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>NIJA – Descrição Completa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <p>
                O NIJA é o núcleo inteligente do LEXOS responsável por analisar, interpretar e diagnosticar
                automaticamente documentos jurídicos, petições, peças processuais, sentenças, contratos e
                quaisquer arquivos anexados pelo advogado.
              </p>
              <p>
                Ele identifica nulidades absolutas e relativas, erros de citação, intimação e ciência, vícios
                formais e materiais, ilegalidades, contradições, prescrição, decadência, marcos interruptivos,
                requisitos processuais descumpridos, teses existentes e ocultas, pontos fracos da parte
                contrária, riscos e prognósticos jurídicos.
              </p>
              <p>
                Funciona em dois modos: (1) análise vinculada ao caso, carregando todos os documentos do
                processo; (2) análise solta, aceitando PDFs ou texto colado diretamente.
              </p>
              <p>
                Entradas aceitas: documentos do caso, arquivos enviados diretamente, texto colado ou tudo
                combinado. O NIJA processa, extrai, valida e cruza todas as informações para formar um
                diagnóstico jurídico completo.
              </p>
              <p>
                O relatório é entregue em quatro níveis: Resumo Tático, Vícios & Riscos, Estratégias e
                Engine Técnico (JSON com fontes, falhas e classificações).
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal para formato não reconhecido como EPROC */}
        <Dialog open={showNonEprocPrompt} onOpenChange={setShowNonEprocPrompt}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Formato não reconhecido como EPROC</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <p>
                O padrão do sistema é EPROC. Este arquivo não bateu com a assinatura esperada.
                Como deseja continuar?
              </p>

              <div className="flex flex-col gap-2">
                <Button onClick={handleForceEprocExtraction}>
                  Tratar como EPROC (extração pura)
                </Button>

                <Button variant="outline" onClick={handleSkipExtraction}>
                  Continuar sem extração (vou usar análise depois)
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}

export function Nija() {
  return <NijaPage />;
}
