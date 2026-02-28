// src/components/nija/NijaResultsPanel.tsx
// NIJA Results Panel - Presentational component for analysis results display

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  FileUp,
  Settings2,
  Zap,
  CheckCircle2,
  Circle,
  Copy,
  Trash2,
  ChevronDown,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Eye,
  Sparkles,
  Brain,
  Target,
} from "lucide-react";

// Import types from engine (single source of truth)
import type { NijaEngineRecommendation, NijaEngineFinding } from "@/nija";
import type { NijaStrategyTemplate } from "@/nija";

// ======================================================
// TYPES
// ======================================================

export interface ProcessFileDisplay {
  id: string;
  filename: string;
  size: number;
  status: "uploading" | "pending" | "extracting" | "ready" | "error" | "image_pdf" | "ocr_processing";
}

export interface GeneratedPieceEstrutura {
  fatos?: string;
  fundamentos?: string;
  pedidos?: string;
  jurisprudenciaSugerida?: string;
  observacoesEstrategicas?: string;
}

export interface GeneratedPiece {
  tipoPeca?: string;
  focoPrincipal?: string;
  tituloSugestao?: string;
  sugerirNomeArquivo?: string;
  estrutura?: GeneratedPieceEstrutura;
}

// Analysis result structure from Nija.tsx
export interface NijaAnalysisResult {
  recommendation?: NijaEngineRecommendation;
  rawVicios?: unknown[];
  warnings?: string[];
}

export interface NijaResultsPanelProps {
  // Analysis state
  analysisResult: NijaAnalysisResult | null;
  analysisLoading: boolean;
  
  // Tabs
  activeTab: string;
  onTabChange: (tab: string) => void;
  
  // Counts
  defectsCount: number;
  mainStrategiesCount: number;
  secondaryStrategiesCount: number;
  
  // Documents display
  processFiles: ProcessFileDisplay[];
  manualDocText: string;
  manualDocLabel: string;
  
  // Ramo
  ramoFinal: string | null;
  ramoLabel: (ramo: string) => string;
  
  // Auto case
  autoCaseId: string | null;
  onNavigateToCase: (caseId: string) => void;
  
  // Warnings and technical
  warnings: string[];
  showTechnicalDetails: boolean;
  onShowTechnicalDetailsChange: (open: boolean) => void;
  
  // Generated piece
  generatedPiece: GeneratedPiece | null;
  isGeneratingPiece: boolean;
  onGeneratePiece: () => void;
  onCopyPieceText: () => void;
  onClearPiece: () => void;
  
  // Draft
  draftText: string;
  onCopyDraft: () => void;
  onClearDraft: () => void;
  
  // Helpers
  formatFileSize: (bytes: number) => string;
  severityLabelColor: (severity?: string) => string;
  impactLabel: (impact?: string) => string;
}

// ======================================================
// COMPONENT
// ======================================================

export const NijaResultsPanel = React.forwardRef<HTMLDivElement, NijaResultsPanelProps>(
  (
    {
      analysisResult,
      analysisLoading,
      activeTab,
      onTabChange,
      defectsCount,
      mainStrategiesCount,
      secondaryStrategiesCount,
      processFiles,
      manualDocText,
      manualDocLabel,
      ramoFinal,
      ramoLabel,
      autoCaseId,
      onNavigateToCase,
      warnings,
      showTechnicalDetails,
      onShowTechnicalDetailsChange,
      generatedPiece,
      isGeneratingPiece,
      onGeneratePiece,
      onCopyPieceText,
      onClearPiece,
      draftText,
      onCopyDraft,
      onClearDraft,
      formatFileSize,
      severityLabelColor,
      impactLabel,
    },
    ref
  ) => {
    // Type-safe accessors for recommendation data
    const findings = analysisResult?.recommendation?.findings ?? [];
    const mainStrategies = analysisResult?.recommendation?.mainStrategies ?? [];
    const secondaryStrategies = analysisResult?.recommendation?.secondaryStrategies ?? [];
    const resumoTatico = analysisResult?.recommendation?.resumoTatico ?? "Resumo não disponível.";

    return (
      <div ref={ref}>
        {/* ZONA 3: RESULTADOS (Passo 3) */}
        <section className="space-y-4">
        <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
          analysisResult 
            ? "bg-gradient-to-r from-green-500/10 to-transparent border-green-500/20" 
            : "bg-muted/30 border-muted"
        }`}>
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold shadow-lg transition-all ${
              analysisResult
                ? "bg-green-500 text-white shadow-green-500/30"
                : "bg-muted text-muted-foreground shadow-none"
            }`}
          >
            3
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Resultado e minuta</h2>
            <p className="text-xs text-muted-foreground">
              Visualize o diagnóstico do NIJA e gere minutas a partir da análise.
            </p>
          </div>
          {analysisResult && (
            <div className="ml-auto flex items-center gap-2">
              <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Análise concluída
              </Badge>
            </div>
          )}
        </div>

        {/* Loading state */}
        {analysisLoading && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-8">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="animate-spin h-16 w-16 border-4 border-primary border-t-transparent rounded-full" />
                  <Brain className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-semibold text-foreground">O NIJA está analisando os documentos...</p>
                  <p className="text-sm text-muted-foreground">Identificando vícios, nulidades e estruturando a matriz processual.</p>
                </div>
                <Progress value={66} className="w-48 h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {!analysisResult && !analysisLoading && (
          <Card className="border-dashed border-2 border-muted-foreground/20">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                <Eye className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="font-medium text-foreground mb-2">Nenhuma análise executada ainda</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Envie documentos na etapa 1, configure a análise na etapa 2 e clique em "Rodar NIJA agora" para iniciar.
              </p>
            </CardContent>
          </Card>
        )}
        
        {analysisResult && !analysisLoading && (
          <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
            <ScrollArea className="w-full">
              <TabsList className="inline-flex min-w-max gap-1 mb-4 p-1 bg-muted/50">
                <TabsTrigger value="documentos" className="whitespace-nowrap text-xs sm:text-sm gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Documentos
                </TabsTrigger>
                <TabsTrigger value="resumo" className="whitespace-nowrap text-xs sm:text-sm gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Resumo Tático
                </TabsTrigger>
                <TabsTrigger value="vicios" className="whitespace-nowrap text-xs sm:text-sm gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Vícios ({defectsCount})
                </TabsTrigger>
                <TabsTrigger value="estrategias" className="whitespace-nowrap text-xs sm:text-sm gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  Estratégias ({mainStrategiesCount + secondaryStrategiesCount})
                </TabsTrigger>
                <TabsTrigger value="pecas" className="whitespace-nowrap text-xs sm:text-sm gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Peças NIJA
                </TabsTrigger>
                <TabsTrigger value="engine" className="whitespace-nowrap text-xs sm:text-sm gap-1.5">
                  <Settings2 className="h-3.5 w-3.5" />
                  Engine
                </TabsTrigger>
              </TabsList>
            </ScrollArea>

            {/* Documentos & Entrada */}
            <TabsContent value="documentos">
              <Card>
                <CardHeader>
                  <CardTitle>Entrada efetivamente usada na análise</CardTitle>
                  <CardDescription>
                    Lista dos documentos e textos considerados pelo NIJA
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {processFiles.filter((f) => f.status === "ready").length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Arquivos do processo:</p>
                      {processFiles
                        .filter((f) => f.status === "ready")
                        .map((pf) => (
                          <div key={pf.id} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span>{pf.filename}</span>
                            <span className="text-muted-foreground">({formatFileSize(pf.size)})</span>
                            <Badge variant="outline" className="ml-auto text-xs">
                              Texto usado
                            </Badge>
                          </div>
                        ))}
                    </div>
                  )}

                  {manualDocText.trim().length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Documento complementar:</p>
                      <div className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
                        <FileUp className="h-4 w-4 text-muted-foreground" />
                        <span>{manualDocLabel || "Documento complementar"}</span>
                        <span className="text-muted-foreground">
                          ({manualDocText.length} caracteres)
                        </span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          Texto usado
                        </Badge>
                      </div>
                    </div>
                  )}

                  {ramoFinal && (
                    <p className="text-sm">
                      <span className="font-medium">Ramo inferido/selecionado:</span> {ramoLabel(ramoFinal)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Resumo Tático */}
            <TabsContent value="resumo">
              {/* Aviso de caso criado automaticamente */}
              {autoCaseId && (
                <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Caso criado automaticamente</p>
                      <p className="text-xs mt-1">
                        Este caso foi criado automaticamente pela NIJA a partir de uma análise solta.
                        Você pode abrir o caso completo no módulo de Casos para complementar dados,
                        vincular partes e gerar novas peças.
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2 text-yellow-800 border-yellow-400 hover:bg-yellow-100 dark:text-yellow-200 dark:border-yellow-600 dark:hover:bg-yellow-800/30"
                        onClick={() => onNavigateToCase(autoCaseId)}
                      >
                        Ir para o Caso
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Resumo Tático do NIJA</CardTitle>
                  <CardDescription>
                    Síntese jurídica do cenário processual
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ramoFinal && (
                    <Badge variant="outline" className="mb-2">
                      {ramoLabel(ramoFinal)}
                    </Badge>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {resumoTatico}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Vícios & Riscos */}
            <TabsContent value="vicios">
              <Card>
                <CardHeader>
                  <CardTitle>Vícios & Riscos detectados</CardTitle>
                  <CardDescription>
                    Nulidades, prescrição, decadência, riscos e oportunidades
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {defectsCount === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum vício catalogado foi identificado nesta análise.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {findings.map((f: NijaEngineFinding) => (
                        <Card key={f.defect.code} className="p-4 border border-border">
                          {/* Título e Badges */}
                          <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
                            <div>
                              <span className="font-bold text-base">{f.defect.label}</span>
                              <span className="text-xs text-muted-foreground ml-2">({f.defect.code})</span>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Badge className={severityLabelColor(f.severity)}>{f.severity ?? "N/A"}</Badge>
                              <Badge variant="outline">{impactLabel(f.impact)}</Badge>
                            </div>
                          </div>

                          {/* Onde apareceu no processo */}
                          {f.ato && (
                            <div className="bg-muted rounded p-3 space-y-1 mb-3">
                              <div className="font-semibold text-sm">📍 Onde isso apareceu no processo</div>
                              <div className="text-sm flex items-center gap-2">
                                <span>Ato:</span>
                                <Badge variant="outline">{f.ato.tipo}</Badge>
                                {f.ato.data && <span className="text-muted-foreground">– {f.ato.data}</span>}
                              </div>
                              {f.secaoDocumento && <div className="text-sm">Seção: {f.secaoDocumento}</div>}
                              {f.parteEnvolvida && <div className="text-sm">Parte envolvida: {f.parteEnvolvida}</div>}
                            </div>
                          )}

                          {/* Trecho que disparou o alerta */}
                          {f.trecho && (
                            <div className="border-l-4 border-primary bg-muted rounded-r p-3 mb-3">
                              <div className="font-semibold text-sm mb-1">📝 Trecho que disparou o alerta</div>
                              <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{f.trecho}</pre>
                            </div>
                          )}

                          {/* Por que o NIJA marcou isso */}
                          {f.tecnico && (
                            <div className="bg-background rounded border p-3 mb-3">
                              <div className="font-semibold text-sm mb-2">⚙️ Por que o NIJA marcou isso?</div>
                              <div className="text-xs text-muted-foreground mb-2">{f.tecnico.motivoDeteccao}</div>
                              
                              {f.tecnico.criteriosAplicados?.length > 0 && (
                                <div className="mb-2">
                                  <p className="text-xs font-medium">Critérios aplicados:</p>
                                  <ul className="text-xs text-muted-foreground list-disc ml-6">
                                    {f.tecnico.criteriosAplicados.map((c: string, i: number) => <li key={i}>{c}</li>)}
                                  </ul>
                                </div>
                              )}
                              
                              {f.tecnico.fundamentosLegais?.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium">Fundamentos legais:</p>
                                  <ul className="text-xs text-muted-foreground list-disc ml-6">
                                    {f.tecnico.fundamentosLegais.map((fl: string, i: number) => <li key={i}>{fl}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {f.notas && (
                            <div className="text-sm text-muted-foreground">
                              💡 {f.notas}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Estratégias */}
            <TabsContent value="estrategias">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge className="bg-primary">Principais</Badge>
                      Teses e peças cabíveis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {mainStrategiesCount === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma estratégia prioritária identificada.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {mainStrategies.map((s: NijaStrategyTemplate) => (
                          <li key={s.code} className="rounded border p-3 bg-primary/5">
                            <p className="font-medium text-sm">{s.label}</p>
                            <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="outline">Secundárias</Badge>
                      Medidas complementares
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {secondaryStrategiesCount === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma estratégia secundária identificada.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {secondaryStrategies.map((s: NijaStrategyTemplate) => (
                          <li key={s.code} className="rounded border p-3">
                            <p className="font-medium text-sm">{s.label}</p>
                            <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* NIJA-PEÇAS V4 - Peças geradas */}
            <TabsContent value="pecas">
              <Card>
                <CardHeader>
                  <CardTitle>Peças geradas pelo NIJA</CardTitle>
                  <CardDescription>
                    Minutas estruturadas a partir dos vícios detectados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Botão de geração */}
                  <Button
                    variant="default"
                    disabled={defectsCount === 0 || isGeneratingPiece}
                    onClick={onGeneratePiece}
                    className="w-full"
                  >
                    {isGeneratingPiece ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando minuta estruturada...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Gerar minuta estruturada (NIJA-PEÇAS V4)
                      </>
                    )}
                  </Button>

                  {defectsCount === 0 && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      É necessário ter vícios identificados para gerar uma peça estruturada.
                    </p>
                  )}

                  {/* Resultado da peça gerada */}
                  {!generatedPiece ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Circle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm">Nenhuma minuta estruturada gerada ainda.</p>
                      <p className="text-xs mt-1">Clique no botão acima para gerar uma estrutura de peça baseada nos vícios detectados.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Tipo de peça e título */}
                      <div className="bg-primary/10 rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-primary text-primary-foreground">
                            {generatedPiece.tipoPeca?.replace(/_/g, " ") || "PEÇA"}
                          </Badge>
                          {generatedPiece.focoPrincipal && (
                            <Badge variant="outline">
                              Foco: {generatedPiece.focoPrincipal}
                            </Badge>
                          )}
                        </div>
                        {generatedPiece.tituloSugestao && (
                          <p className="font-medium text-sm">{generatedPiece.tituloSugestao}</p>
                        )}
                      </div>

                      {/* FATOS */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          📋 FATOS
                        </h4>
                        <div className="bg-muted rounded p-3 text-sm whitespace-pre-wrap">
                          {generatedPiece.estrutura?.fatos || "Não disponível."}
                        </div>
                      </div>

                      {/* FUNDAMENTOS */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          ⚖️ FUNDAMENTOS JURÍDICOS
                        </h4>
                        <div className="bg-muted rounded p-3 text-sm whitespace-pre-wrap">
                          {generatedPiece.estrutura?.fundamentos || "Não disponível."}
                        </div>
                      </div>

                      {/* PEDIDOS */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          📝 PEDIDOS
                        </h4>
                        <div className="bg-muted rounded p-3 text-sm whitespace-pre-wrap">
                          {generatedPiece.estrutura?.pedidos || "Não disponível."}
                        </div>
                      </div>

                      {/* JURISPRUDÊNCIA SUGERIDA */}
                      {generatedPiece.estrutura?.jurisprudenciaSugerida && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            📚 JURISPRUDÊNCIA SUGERIDA
                          </h4>
                          <div className="bg-muted rounded p-3 text-sm whitespace-pre-wrap">
                            {generatedPiece.estrutura.jurisprudenciaSugerida}
                          </div>
                        </div>
                      )}

                      {/* OBSERVAÇÕES ESTRATÉGICAS */}
                      {generatedPiece.estrutura?.observacoesEstrategicas && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            💡 OBSERVAÇÕES ESTRATÉGICAS
                          </h4>
                          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded p-3 text-sm whitespace-pre-wrap">
                            {generatedPiece.estrutura.observacoesEstrategicas}
                          </div>
                        </div>
                      )}

                      {/* Nome de arquivo sugerido */}
                      {generatedPiece.sugerirNomeArquivo && (
                        <div className="text-xs text-muted-foreground">
                          📁 Nome sugerido: <code className="bg-muted px-1 rounded">{generatedPiece.sugerirNomeArquivo}</code>
                        </div>
                      )}

                      {/* Aviso de revisão */}
                      <div className="bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded p-3 text-xs text-amber-800 dark:text-amber-300">
                        ⚠️ <strong>ATENÇÃO:</strong> Este rascunho foi gerado automaticamente e DEVE ser revisado por advogado habilitado antes de qualquer uso.
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" onClick={onCopyPieceText}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar texto da minuta
                        </Button>
                        <Button variant="ghost" onClick={onClearPiece}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Limpar
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Técnico (Engine) */}
            <TabsContent value="engine">
              <Card>
                <CardHeader>
                  <CardTitle>Camada técnica (Engine)</CardTitle>
                  <CardDescription>
                    Dados brutos e avisos do NIJA
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {warnings.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Avisos:</p>
                      {warnings.map((w, idx) => (
                        <p key={idx} className="text-xs text-amber-600">• {w}</p>
                      ))}
                    </div>
                  )}

                  <Collapsible open={showTechnicalDetails} onOpenChange={onShowTechnicalDetailsChange}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between">
                        <span>{showTechnicalDetails ? "Ocultar" : "Ver"} detalhes técnicos (Engine)</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            showTechnicalDetails ? "rotate-180" : ""
                          }`}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4">
                      <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
                        {JSON.stringify(analysisResult, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </section>

      {/* MINUTA GERADA */}
      {draftText && (
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Minuta gerada com base no diagnóstico do NIJA</CardTitle>
              <CardDescription>
                Revise e ajuste o texto antes de utilizar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={draftText}
                readOnly
                rows={16}
                className="text-sm font-mono"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={onCopyDraft}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar peça
                </Button>
                <Button variant="ghost" onClick={onClearDraft}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar minuta
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
      </div>
    );
  }
);

NijaResultsPanel.displayName = "NijaResultsPanel";
