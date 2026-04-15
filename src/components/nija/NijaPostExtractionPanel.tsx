// src/components/nija/NijaPostExtractionPanel.tsx
// Painel que exibe resultados após extração EPROC + criação automática de caso + botão Analisar com IA

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { EprocExtractionResult } from "@/types/nija-contracts";
import type { NijaAnalyzerResponse } from "@/nija/core/analyzer";
import { 
  generateMinutaFromExtraction, 
  exportMinutaToDocx, 
  copyMinutaToClipboard,
} from "@/nija/export/templateGenerator";
import { exportTimelineToDocx } from "@/nija/export/timelineExporter";
import { 
  exportAnalysisToDocx, 
  copyAnalysisToClipboard,
} from "@/nija/export/analysisExporter";
import { 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Download, 
  Copy, 
  ChevronDown, 
  ExternalLink,
  Loader2,
  Shield,
  Swords,
  Target,
  Scale,
  FileCheck,
  Brain,
  Sparkles,
} from "lucide-react";

interface NijaPostExtractionPanelProps {
  extractionResult: EprocExtractionResult;
  analysisResult: NijaAnalyzerResponse | null;
  isAnalyzing: boolean;
  createdCaseId: string | null;
  isCreatingCase: boolean;
  actingSide: "AUTOR" | "REU";
  clientName: string;
  opponentName: string;
  processNumber: string;
  lawyerName: string;
  oabNumber: string;
  // NEW: AI Analysis callback
  onRunAIAnalysis?: () => void;
  aiAnalysisLoading?: boolean;
  aiAnalysisResult?: any; // Full AI analysis result from edge function
  // Maestro Mode
  isMaestroMode?: boolean;
  onMaestroModeChange?: (val: boolean) => void;
}

export function NijaPostExtractionPanel({
  extractionResult,
  analysisResult,
  isAnalyzing,
  createdCaseId,
  isCreatingCase,
  actingSide,
  clientName,
  opponentName,
  processNumber,
  lawyerName,
  oabNumber,
  onRunAIAnalysis,
  aiAnalysisLoading = false,
  aiAnalysisResult,
  isMaestroMode = true,
  onMaestroModeChange,
}: NijaPostExtractionPanelProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isViciosOpen, setIsViciosOpen] = useState(true);
  const [isStrategiesOpen, setIsStrategiesOpen] = useState(true);

  // Use AI analysis result if available, otherwise fallback to local heuristic
  const activeAnalysis = aiAnalysisResult || analysisResult;
  const findings = activeAnalysis?.recommendation?.findings || [];
  const mainStrategies = activeAnalysis?.recommendation?.mainStrategies || [];
  const resumoTatico = activeAnalysis?.recommendation?.resumoTatico || aiAnalysisResult?.resumoTatico || "";

  const handleGenerateMinuta = async () => {
    if (!activeAnalysis) return;
    
    const minuta = generateMinutaFromExtraction(extractionResult, activeAnalysis, {
      actingSide,
      lawyerName,
      oabNumber,
      clientName,
      opponentName,
    });
    
    await exportMinutaToDocx(minuta, processNumber);
    toast({ title: "Minuta exportada", description: "Arquivo DOCX gerado com sucesso." });
  };

  const handleCopyMinuta = async () => {
    if (!activeAnalysis) return;
    
    const minuta = generateMinutaFromExtraction(extractionResult, activeAnalysis, {
      actingSide,
      lawyerName,
      oabNumber,
      clientName,
      opponentName,
    });
    
    const success = await copyMinutaToClipboard(minuta);
    toast({ 
      title: success ? "Copiado!" : "Erro", 
      description: success ? "Minuta copiada para área de transferência." : "Não foi possível copiar.",
      variant: success ? "default" : "destructive"
    });
  };

  const handleExportTimeline = async () => {
    await exportTimelineToDocx(extractionResult, processNumber, clientName);
    toast({ title: "Timeline exportada", description: "Arquivo DOCX gerado com sucesso." });
  };

  const handleExportAnalysis = async () => {
    if (!activeAnalysis) return;
    
    await exportAnalysisToDocx(extractionResult, activeAnalysis, {
      clientName,
      opponentName,
      processNumber,
      actingSide,
      lawyerName,
      oabNumber,
    });
    toast({ title: "Análise exportada", description: "Arquivo DOCX gerado com sucesso." });
  };

  const handleCopyAnalysis = async () => {
    if (!activeAnalysis) return;
    
    const success = await copyAnalysisToClipboard(extractionResult, activeAnalysis, {
      clientName,
      opponentName,
      processNumber,
      actingSide,
      lawyerName,
      oabNumber,
    });
    toast({ 
      title: success ? "Copiado!" : "Erro", 
      description: success ? "Análise copiada para área de transferência." : "Não foi possível copiar.",
      variant: success ? "default" : "destructive"
    });
  };

  if (isAnalyzing || aiAnalysisLoading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-medium">
              {aiAnalysisLoading ? "Executando análise IA completa..." : "Executando análise heurística..."}
            </span>
          </div>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!analysisResult && !aiAnalysisResult) return null;

  return (
    <div className="space-y-4">
      {/* Status do Caso Criado */}
      <Card className={createdCaseId ? "border-green-500/30 bg-green-500/5" : "border-yellow-500/30 bg-yellow-500/5"}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isCreatingCase ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
                  <span className="font-medium">Criando caso no sistema...</span>
                </>
              ) : createdCaseId ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-700 dark:text-green-300">Caso criado com sucesso!</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <span className="font-medium">Aguardando criação do caso...</span>
                </>
              )}
            </div>
            {createdCaseId && (
              <Button size="sm" onClick={() => navigate(`/cases?case=${createdCaseId}`)} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Abrir Caso
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* BOTÃO ANALISAR COM IA - DESTACADO */}
      {onRunAIAnalysis && !aiAnalysisResult && (
        <Card className="border-2 border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">Enriquecer com Análise IA</p>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider py-0 px-1.5 h-4 border-primary/30 text-primary">
                      {isMaestroMode ? "Premium" : "Standard"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isMaestroMode 
                      ? "Pipeline de 9 estágios + Simulação Judicial (Juiz IA)" 
                      : "Geração rápida de minuta e análise de vícios padrão"}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Selector de Modo */}
                <div className="flex items-center bg-background/50 border border-border p-1 rounded-lg">
                  <button
                    onClick={() => onMaestroModeChange?.(false)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${!isMaestroMode ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Rápido
                  </button>
                  <button
                    onClick={() => onMaestroModeChange?.(true)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${isMaestroMode ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Maestro
                  </button>
                </div>

                <Button 
                  onClick={onRunAIAnalysis} 
                  disabled={aiAnalysisLoading}
                  className="gap-2 bg-primary hover:bg-primary/90"
                >
                  {aiAnalysisLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isMaestroMode ? "Rodar Maestro" : "Analisar Agora"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Badge indicando se análise é IA ou heurística */}
      {(analysisResult || aiAnalysisResult) && (
        <div className="flex items-center gap-2">
          <Badge variant={aiAnalysisResult ? "default" : "secondary"} className="text-xs">
            {aiAnalysisResult ? (
              <>
                <Brain className="h-3 w-3 mr-1" />
                Análise IA
              </>
            ) : (
              <>
                <Scale className="h-3 w-3 mr-1" />
                Análise Heurística
              </>
            )}
          </Badge>
        </div>
      )}

      {/* Resumo Tático */}
      {resumoTatico && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Resumo Tático</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{resumoTatico}</p>
          </CardContent>
        </Card>
      )}

      {/* Vícios Detectados */}
      <Card>
        <Collapsible open={isViciosOpen} onOpenChange={setIsViciosOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-base">Vícios Detectados</CardTitle>
                  <Badge variant={findings.length > 0 ? "destructive" : "secondary"}>
                    {findings.length}
                  </Badge>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isViciosOpen ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {findings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {aiAnalysisResult 
                    ? "Nenhum vício detectado pela análise IA." 
                    : "Nenhum vício detectado pela análise heurística."}
                </p>
              ) : (
                <div className="space-y-3">
                  {findings.map((finding: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm">{finding.defect?.label || finding.label || finding}</span>
                        {finding.defect?.severity && (
                          <Badge variant="outline" className="text-xs">{finding.defect.severity}</Badge>
                        )}
                      </div>
                      {(finding.notas || finding.description) && (
                        <p className="text-xs text-muted-foreground mt-1">{finding.notas || finding.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Estratégias */}
      <Card>
        <Collapsible open={isStrategiesOpen} onOpenChange={setIsStrategiesOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {actingSide === "REU" ? <Shield className="h-5 w-5 text-blue-500" /> : <Swords className="h-5 w-5 text-orange-500" />}
                  <CardTitle className="text-base">Estratégias Sugeridas</CardTitle>
                  <Badge variant="secondary">{mainStrategies.length}</Badge>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isStrategiesOpen ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {mainStrategies.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {aiAnalysisResult 
                    ? "Nenhuma estratégia específica identificada pela IA." 
                    : "Nenhuma estratégia específica identificada."}
                </p>
              ) : (
                <div className="space-y-3">
                  {mainStrategies.map((strategy: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <span className="font-medium text-sm">{strategy.label || strategy}</span>
                      {strategy.description && (
                        <p className="text-xs text-muted-foreground mt-1">{strategy.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Ações de Exportação */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Ações</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button variant="outline" size="sm" onClick={handleGenerateMinuta} className="gap-2" disabled={!activeAnalysis}>
              <FileText className="h-4 w-4" />
              Minuta DOCX
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyMinuta} className="gap-2" disabled={!activeAnalysis}>
              <Copy className="h-4 w-4" />
              Copiar Minuta
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportTimeline} className="gap-2">
              <Download className="h-4 w-4" />
              Timeline DOCX
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportAnalysis} className="gap-2" disabled={!activeAnalysis}>
              <Download className="h-4 w-4" />
              Análise DOCX
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
