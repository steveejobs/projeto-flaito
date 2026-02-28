// src/components/nija/NijaAnalysisConfig.tsx
// Componente presentational para configuração da análise NIJA
// Apenas renderiza UI e dispara callbacks - sem lógica de negócio

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  Loader2,
  Zap,
  FileText,
  AlertCircle,
  ArrowLeftRight,
  FileSearch,
  Settings2,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AnalysisMode = "SUPERVISED" | "AUTOMATIC";
export type OperationMode = "EXTRACTION_ONLY" | "NIJA_ANALYSIS";

export interface NijaAnalysisConfigProps {
  // Modo de análise
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;

  // Modo de operação (extração pura vs análise completa)
  operationMode: OperationMode;

  // Ramo do direito
  selectedRamo: string;
  onRamoChange: (ramo: string) => void;

  // Descrição do caso
  caseDescription: string;
  onCaseDescriptionChange: (description: string) => void;

  // Dados do processo
  clientName: string;
  onClientNameChange: (name: string) => void;
  opponentName: string;
  onOpponentNameChange: (name: string) => void;
  processNumber: string;
  onProcessNumberChange: (number: string) => void;
  processYear: string;
  onProcessYearChange: (year: string) => void;
  vara: string;
  onVaraChange: (vara: string) => void;
  city: string;
  onCityChange: (city: string) => void;
  lawyerName: string;
  onLawyerNameChange: (name: string) => void;
  oabNumber: string;
  onOabNumberChange: (oab: string) => void;

  // Auto-expand collapsible se há dados detectados
  hasDetectedMetadata?: boolean;

  // Inversão de partes
  onSwapParties: () => void;

  // Limpar todos os campos
  onClearProcessData?: () => void;

  // Ações
  onRunAnalysis: () => void;
  onGenerateDraft: () => void;

  // Estados de loading
  analysisLoading: boolean;
  draftLoading: boolean;

  // Validações
  hasContent: boolean;
  extractingCount: number;
  inputsSummary: string;
  hasAnalysisResult: boolean;

  // Desabilitar card visualmente
  disabled?: boolean;
}

export function NijaAnalysisConfig({
  mode,
  onModeChange,
  operationMode,
  selectedRamo,
  onRamoChange,
  caseDescription,
  onCaseDescriptionChange,
  clientName,
  onClientNameChange,
  opponentName,
  onOpponentNameChange,
  processNumber,
  onProcessNumberChange,
  processYear,
  onProcessYearChange,
  vara,
  onVaraChange,
  city,
  onCityChange,
  lawyerName,
  onLawyerNameChange,
  oabNumber,
  onOabNumberChange,
  hasDetectedMetadata = false,
  onSwapParties,
  onClearProcessData,
  onRunAnalysis,
  onGenerateDraft,
  analysisLoading,
  draftLoading,
  hasContent,
  extractingCount,
  inputsSummary,
  hasAnalysisResult,
  disabled = false,
}: NijaAnalysisConfigProps) {
  // Colapsar por padrão - usuário expande se quiser revisar/editar
  const [isProcessDataOpen, setIsProcessDataOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Calcular quantos campos foram detectados automaticamente
  const detectedFieldsCount = useMemo(() => {
    let count = 0;
    if (clientName) count++;
    if (opponentName) count++;
    if (processNumber) count++;
    if (vara) count++;
    if (city) count++;
    if (lawyerName) count++;
    if (oabNumber) count++;
    return count;
  }, [clientName, opponentName, processNumber, vara, city, lawyerName, oabNumber]);

  // NÃO auto-expandir mais - mantém colapsado por padrão

  // Animate loading progress
  useEffect(() => {
    if (analysisLoading) {
      setLoadingProgress(0);
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);
      return () => clearInterval(interval);
    } else {
      setLoadingProgress(100);
      const timeout = setTimeout(() => setLoadingProgress(0), 300);
      return () => clearTimeout(timeout);
    }
  }, [analysisLoading]);

  // Texto e ícone do botão principal baseado no modo de operação
  const isExtractionMode = operationMode === "EXTRACTION_ONLY";
  const mainButtonText = isExtractionMode ? "Extrair dados EPROC" : "Rodar NIJA agora";
  const MainButtonIcon = isExtractionMode ? FileSearch : Zap;

  // Verificar se há dados preenchidos
  const hasProcessData = clientName || opponentName || processNumber || processYear || vara || city || lawyerName || oabNumber;

  return (
    <div className={cn("space-y-4 transition-all", disabled && "opacity-50 pointer-events-none")}>
      <Card className={cn(
        "transition-all duration-300 overflow-hidden",
        analysisLoading && "ring-2 ring-primary/30"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Configurar análise</CardTitle>
            </div>
          </div>
          <CardDescription>
            {isExtractionMode 
              ? "Extração pura EPROC - sem uso de IA"
              : "Ajuste o modo e o ramo do direito antes de rodar o NIJA."}
          </CardDescription>
        </CardHeader>

        {/* Loading progress bar */}
        {analysisLoading && (
          <div className="px-6">
            <Progress value={loadingProgress} className="h-1" />
          </div>
        )}

        <CardContent className="pt-4 space-y-4">
          {/* Modo de análise - só aparece no modo NIJA_ANALYSIS */}
          {!isExtractionMode && (
            <>
              <div className="space-y-2">
                <Label>Modo de Análise</Label>
                <Select value={mode} onValueChange={(v) => onModeChange(v as AnalysisMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTOMATIC">Automático (recomendado)</SelectItem>
                    <SelectItem value="SUPERVISED">Supervisionado</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Automático detecta padrões automaticamente. Supervisionado não inventa vícios.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Ramo do Direito</Label>
                <Select value={selectedRamo} onValueChange={onRamoChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Inferir automaticamente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__AUTO__">Inferir automaticamente</SelectItem>
                    <SelectItem value="CIVIL">Cível</SelectItem>
                    <SelectItem value="PENAL">Penal</SelectItem>
                    <SelectItem value="TRABALHISTA">Trabalhista</SelectItem>
                    <SelectItem value="TRIBUTARIO">Tributário</SelectItem>
                    <SelectItem value="PREVIDENCIARIO">Previdenciário</SelectItem>
                    <SelectItem value="FAMILIA">Família</SelectItem>
                    <SelectItem value="ADMINISTRATIVO">Administrativo</SelectItem>
                    <SelectItem value="FAZENDARIO">Fazendário</SelectItem>
                    <SelectItem value="JUIZADOS">Juizados Especiais</SelectItem>
                    <SelectItem value="EXECUCAO_FISCAL">Execução Fiscal</SelectItem>
                    <SelectItem value="CONSUMIDOR">Consumidor</SelectItem>
                    <SelectItem value="OUTRO">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="caseDescription">Resumo do caso (opcional)</Label>
                <Textarea
                  id="caseDescription"
                  placeholder="Síntese dos fatos, pedidos principais, valores, peculiaridades relevantes..."
                  value={caseDescription}
                  onChange={(e) => onCaseDescriptionChange(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>
            </>
          )}

          {/* Dados do processo para geração da peça - colapsado por padrão */}
          <Collapsible open={isProcessDataOpen} onOpenChange={setIsProcessDataOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="text-sm flex items-center gap-2">
                  Dados do processo
                  {detectedFieldsCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-primary font-normal">
                      <CheckCircle2 className="h-3 w-3" />
                      {detectedFieldsCount} campo(s) detectado(s)
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                  )}
                </span>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  isProcessDataOpen && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Header com descrição e botão limpar */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Preencha para que a peça gerada venha com os dados já preenchidos.
                </p>
                {hasProcessData && onClearProcessData && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={onClearProcessData}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome do cliente</Label>
                  <Input
                    value={clientName}
                    onChange={(e) => onClientNameChange(e.target.value)}
                    placeholder="Ex.: João da Silva"
                    className="text-sm h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Parte contrária</Label>
                  <Input
                    value={opponentName}
                    onChange={(e) => onOpponentNameChange(e.target.value)}
                    placeholder="Ex.: Banco XYZ S/A"
                    className="text-sm h-8"
                  />
                </div>
              </div>

              {/* Botão inverter partes */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground justify-center gap-1"
                onClick={onSwapParties}
              >
                <ArrowLeftRight className="h-3 w-3" />
                Inverter Cliente ↔ Parte contrária
              </Button>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nº do processo</Label>
                  <Input
                    value={processNumber}
                    onChange={(e) => onProcessNumberChange(e.target.value)}
                    placeholder="0000000-00.0000.0.00.0000"
                    className="text-sm h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ano (auto)</Label>
                  <Input
                    value={processYear}
                    onChange={(e) => onProcessYearChange(e.target.value)}
                    placeholder="Ex.: 2016"
                    className="text-sm h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vara / Juízo</Label>
                  <Input
                    value={vara}
                    onChange={(e) => onVaraChange(e.target.value)}
                    placeholder="Ex.: 1ª Vara Cível"
                    className="text-sm h-8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input
                    value={city}
                    onChange={(e) => onCityChange(e.target.value)}
                    placeholder="Ex.: São Paulo"
                    className="text-sm h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Advogado</Label>
                  <Input
                    value={lawyerName}
                    onChange={(e) => onLawyerNameChange(e.target.value)}
                    placeholder="Ex.: Dr. Fulano de Tal"
                    className="text-sm h-8"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">OAB</Label>
                <Input
                  value={oabNumber}
                  onChange={(e) => onOabNumberChange(e.target.value)}
                  placeholder="Ex.: OAB/SP 123.456"
                  className="text-sm h-8"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={onRunAnalysis}
              disabled={analysisLoading || !hasContent || extractingCount > 0}
              className={cn(
                "w-full transition-all",
                analysisLoading && "animate-pulse"
              )}
              size="lg"
            >
              {analysisLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isExtractionMode ? "Extraindo..." : "Analisando..."}
                </>
              ) : (
                <>
                  <MainButtonIcon className="h-4 w-4 mr-2" />
                  {mainButtonText}
                </>
              )}
            </Button>

            {/* Botão de minuta só aparece no modo NIJA_ANALYSIS */}
            {!isExtractionMode && (
              <Button
                variant="outline"
                onClick={onGenerateDraft}
                disabled={!hasAnalysisResult || draftLoading}
                className="w-full"
              >
                {draftLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando minuta...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Gerar minuta desta peça
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Status */}
          <div className="text-center pt-2">
            {hasContent ? (
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-primary" />
                {inputsSummary}
              </p>
            ) : (
              <p className="text-xs text-destructive flex items-center justify-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Adicione ao menos um documento ou texto para permitir a análise.
              </p>
            )}
            {extractingCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Aguarde: {extractingCount} arquivo(s) sendo processado(s)...
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

NijaAnalysisConfig.displayName = "NijaAnalysisConfig";
