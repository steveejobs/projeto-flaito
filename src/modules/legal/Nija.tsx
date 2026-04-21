// src/pages/Nija.tsx
// NIJA – Central de Análise Processual (Página Premium com Fluxo em 3 Passos)
// Supports two modes: EXTRACTION_ONLY (pure EPROC data extraction) and NIJA_ANALYSIS (AI-powered legal analysis)

import { lazy, Suspense, useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useNijaExtraction } from "@/hooks/useNijaExtraction";
import { useNijaAnalysis } from "@/hooks/useNijaAnalysis";
import { useNijaOrchestrator } from "@/hooks/useNijaOrchestrator";

import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

import type { 
  NijaPoloDetectResult,
  EprocExtractionResult,
  PoloAtuacao,
  NijaOperationMode
} from "@/types/nija-contracts";

import { detectPoloFromEprocText } from "@/nija/core/poloDetect";
import { type NijaRamo } from "@/nija/core/engine";
import { 
  severityLabelColor, 
  impactLabel, 
  ramoLabel, 
  formatFileSize 
} from "@/nija/utils/displayHelpers";


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
  type NijaSessionRow,
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
import { hasNoiseInName, isSingleWord } from "@/lib/utils/legalUtils";

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

  const extraction = useNijaExtraction();
  const analysis = useNijaAnalysis();

  // === ESTADO DE POLO E DADOS (Mantidos na UI conforme diretriz) ===
  const [actingSide, setActingSide] = useState<"REU" | "AUTOR">("REU");
  const [clientName, setClientName] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [processNumber, setProcessNumber] = useState("");
  const [vara, setVara] = useState("");
  const [city, setCity] = useState("");
  const [lawyerName, setLawyerName] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [caseDescription, setCaseDescription] = useState("");
  const [selectedRamo, setSelectedRamo] = useState("__AUTO__");
  const [actingSideSource, setActingSideSource] = useState<"MANUAL" | "AUTO" | "DEFAULT">("DEFAULT");
  const [useAutoPolo, setUseAutoPolo] = useState(true);
  const [poloDetect, setPoloDetect] = useState<NijaPoloDetectResult | null>(null);

  // === ORQUESTRADOR NIJA ===
  const orchestrator = useNijaOrchestrator({
    actingSide,
    extraction,
    analysis,
    setActingSide,
    setClientName,
    setOpponentName,
    setProcessNumber,
    setVara,
    setCity,
    setLawyerName,
    setOabNumber,
    setCaseDescription,
    setSelectedRamo,
  });

  const {
    operationMode,
    setOperationMode,
    extractionResult,
    isExtracting,
    detectedSystem,
    localAnalysisResult,
    createdCaseId,
    setIsCreatingCase,
    aiAnalysisResult,
    aiAnalysisLoading,
    v2Progress,
    maestroResult,
    isMaestroRunning,
    maestroStage,
    zapSignStatus,
    isMaestroMode,
    setIsMaestroMode,
    runExtractionOnly,
    runAiAnalysisV2,
    handleAutoCreateCase: orchestratorHandleAutoCreateCase,
    handleLoadSession,
    handleClearAll: orchestratorHandleClearAll,
  } = orchestrator;

  // UI States
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [activeTab, setActiveTab] = useState("documentos");
  const [analysisMode, setAnalysisMode] = useState<"AUTOMATIC" | "MANUAL">("AUTOMATIC");
  const [processYear, setProcessYear] = useState("");

  // === DETECÇÃO AUTOMÁTICA DE POLO ===
  useEffect(() => {
    if (!useAutoPolo || !extraction.hasContent || actingSideSource === "MANUAL") return;

    // Usar o texto extraído para detectar o polo
    const rawText = extraction.getAllNijaInputs().map(i => i.content).join("\n");
    const result = detectPoloFromEprocText(rawText);
    
    if (result.poloDetected !== "INDEFINIDO") {
      setActingSide(result.poloDetected);
      setActingSideSource("AUTO");
      setPoloDetect(result);
    }
  }, [extraction.hasContent, useAutoPolo, actingSideSource, extraction]);

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

  // Efeito para auto-trigger da criação de caso
  useEffect(() => {
    if (autoRunExtraction && extractionResult && !createdCaseId) {
      orchestratorHandleAutoCreateCase();
    }
  }, [extractionResult, autoRunExtraction, createdCaseId, orchestratorHandleAutoCreateCase]);

  // === LIMPAR TUDO ===
  const handleClearAll = useCallback(() => {
    orchestratorHandleClearAll();
    
    // Limpar estados locais da UI
    setClientName("");
    setOpponentName("");
    setProcessNumber("");
    setVara("");
    setCity("");
    setLawyerName("");
    setOabNumber("");
    setCaseDescription("");
    setSelectedRamo("__AUTO__");
    setProcessYear("");

    toast({
      title: "Tudo limpo",
      description: "Todos os documentos e resultados foram removidos.",
    });
  }, [orchestratorHandleClearAll, toast]);

  // === CARREGAR SESSÃO ANTERIOR ===
  const handleLoadSessionWrapper = useCallback((session: NijaSessionRow) => {
    handleLoadSession(session);
    // Metadados são atualizados via setters passados ao orquestrador
  }, [handleLoadSession]);

  // === EXTRACTION MODE HANDLERS ===
  const handleRunExtraction = useCallback(async () => {
    await runExtractionOnly();
  }, [runExtractionOnly]);

  const handleRunAnalysis = useCallback(() => {
    if (operationMode === "EXTRACTION_ONLY") {
      handleRunExtraction();
      return;
    }
    runAiAnalysisV2();
  }, [operationMode, handleRunExtraction, runAiAnalysisV2]);

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
          canNavigateToStep3={!!(extractionResult || aiAnalysisResult)}
          isLoading={isExtracting || aiAnalysisLoading || isMaestroRunning}
          loadingStep={isExtracting ? 1 : aiAnalysisLoading || isMaestroRunning ? 2 : null}
          maestroStage={maestroStage}
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
            officeId={orchestrator.officeIdState}
            currentDocumentsHash={orchestrator.currentDocumentsHash}
            onLoadSession={handleLoadSessionWrapper}
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
          mode={analysisMode}
          onModeChange={setAnalysisMode}
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
          analysisLoading={aiAnalysisLoading || isExtracting}
          draftLoading={analysis.draftLoading}
          hasContent={extraction.readyFilesCount > 0 || extraction.manualDocText.trim().length > 0}
          extractingCount={extraction.extractingCount}
          inputsSummary={inputsSummary}
          hasAnalysisResult={!!(extractionResult || aiAnalysisResult)}
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
                  onRunAIAnalysis={runAiAnalysisV2}
                  aiAnalysisLoading={aiAnalysisLoading}
                  aiAnalysisResult={aiAnalysisResult}
                  isMaestroMode={isMaestroMode}
                  onMaestroModeChange={setIsMaestroMode}
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
              // Maestro
              maestroResult={maestroResult}
              isMaestroRunning={isMaestroRunning}
              zapSignStatus={zapSignStatus}
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

      {/* Modal para formato não reconhecido como EPROC - Transformado em Assistente Genérico */}
      <Dialog open={orchestrator.showNonEprocPrompt} onOpenChange={orchestrator.setShowNonEprocPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Documento fora do padrão eProc
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Não detectamos a estrutura oficial do <strong>eProc</strong> neste arquivo, mas não se preocupe: 
              o NIJA pode analisar qualquer documento jurídico (PJE, Projudi ou PDFs escaneados) usando Inteligência Artificial avançada.
            </p>

            <div className="flex flex-col gap-3">
              <Button 
                onClick={orchestrator.handleSkipExtraction} 
                className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
              >
                Analisar como Documento Genérico (IA)
              </Button>

              <Button 
                variant="outline" 
                onClick={orchestrator.handleForceEprocExtraction}
                className="w-full"
              >
                Forçar extração como eProc
              </Button>

              <p className="text-[10px] text-center text-muted-foreground">
                Recomendado para petições, sentenças ou documentos de outros tribunais.
              </p>
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
