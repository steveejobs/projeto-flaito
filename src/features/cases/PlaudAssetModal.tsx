import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Mic, FileText, Sparkles, Copy, Check, Clock, 
  AlertCircle, Loader2, Calendar, User, Target, 
  ListChecks, MessageSquare, Scale, CheckSquare,
  AlertTriangle, ShieldCheck, ShieldAlert
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PlaudAsset {
  id: string;
  title: string;
  transcript: string | null;
  summary: string | null;
  received_at: string;
  created_at_source: string | null;
  audio_url: string | null;
  duration: number | null;
}

interface NijaAnalysis {
  resumoExecutivo?: string;
  pontosChave?: string[];
  acoes?: string[];
  partesEnvolvidas?: string[];
  datasEPrazos?: { data: string; contexto: string }[];
  relevanciaJuridica?: {
    temRelevancia: boolean;
    elementos: string[];
    nivelUrgencia: string;
  };
  sentimento?: string;
  topicos?: string[];
  citacoesImportantes?: string[];
}

// OMNI-SÊNIOR: Interface para análise estratégica
interface SeniorAnalysis {
  id: string;
  decisao_estrategica: "AGIR" | "REGISTRAR" | "SILENCIAR";
  status_juridico: string;
  risco_preclusao: "NENHUM" | "BAIXO" | "MEDIO" | "ALTO" | "CRITICO" | null;
  tipo_ato: string | null;
  fase_processual: string | null;
  fato_central: string | null;
  consequencia_juridica: string | null;
  peca_sugerida: string | null;
  justificativa_silencio: string | null;
  fundamento_legal: string | null;
  checklist: string[];
}

type AiStatus = "none" | "queued" | "running" | "done" | "failed";

interface PlaudAssetModalProps {
  asset: PlaudAsset;
  analysis?: NijaAnalysis;
  aiStatus: AiStatus;
  seniorAnalysis?: SeniorAnalysis | null;
  open: boolean;
  onClose: () => void;
}

export function PlaudAssetModal({
  asset,
  analysis,
  aiStatus,
  seniorAnalysis,
  open,
  onClose,
}: PlaudAssetModalProps) {
  const { toast } = useToast();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyText = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  };

  // Helpers para OMNI-SÊNIOR
  const getDecisaoBadgeVariant = (decisao: string) => {
    switch (decisao) {
      case "AGIR": return "destructive";
      case "REGISTRAR": return "secondary";
      case "SILENCIAR": return "outline";
      default: return "secondary";
    }
  };

  const getRiscoBadgeVariant = (risco: string | null) => {
    switch (risco) {
      case "CRITICO": return "destructive";
      case "ALTO": return "destructive";
      case "MEDIO": return "default";
      case "BAIXO": return "secondary";
      case "NENHUM": return "outline";
      default: return "outline";
    }
  };


  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            {asset.title}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Recebido: {formatDate(asset.received_at)}
            {asset.created_at_source && (
              <span className="text-xs">
                (Gravado: {formatDate(asset.created_at_source)})
              </span>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="resumo" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="resumo" className="gap-1 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="transcricao" className="gap-1 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              Transcrição
            </TabsTrigger>
            <TabsTrigger value="analise" className="gap-1 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Análise IA
              {aiStatus === "done" && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  ✓
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="estrategia" className="gap-1 text-xs">
              <Scale className="h-3.5 w-3.5" />
              Estratégia
              {seniorAnalysis && (
                <Badge 
                  variant={getDecisaoBadgeVariant(seniorAnalysis.decisao_estrategica)} 
                  className="ml-1 h-4 px-1 text-[10px]"
                >
                  {seniorAnalysis.decisao_estrategica.charAt(0)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="checklist" className="gap-1 text-xs">
              <CheckSquare className="h-3.5 w-3.5" />
              Checklist
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Tab: Resumo */}
            <TabsContent value="resumo" className="m-0 space-y-4">
              {asset.summary ? (
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Resumo</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyText(asset.summary!, "summary")}
                    >
                      {copiedSection === "summary" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{asset.summary}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum resumo disponível.</p>
                </div>
              )}
            </TabsContent>

            {/* Tab: Transcrição */}
            <TabsContent value="transcricao" className="m-0 space-y-4">
              {asset.transcript ? (
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Transcrição Completa</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyText(asset.transcript!, "transcript")}
                    >
                      {copiedSection === "transcript" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap font-mono">
                      {asset.transcript}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma transcrição disponível.</p>
                </div>
              )}
            </TabsContent>

            {/* Tab: Análise IA */}
            <TabsContent value="analise" className="m-0 space-y-4">
              {aiStatus === "queued" && (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Análise na fila de processamento.</p>
                </div>
              )}

              {aiStatus === "running" && (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-10 w-10 mx-auto mb-2 animate-spin opacity-50" />
                  <p className="text-sm">Analisando transcrição...</p>
                </div>
              )}

              {aiStatus === "failed" && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 text-destructive opacity-50" />
                  <p className="text-sm">Erro ao processar análise.</p>
                </div>
              )}

              {aiStatus === "none" && (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Análise IA não disponível.</p>
                  <p className="text-xs mt-1">A transcrição pode ser muito curta.</p>
                </div>
              )}

              {aiStatus === "done" && analysis && (
                <div className="space-y-4">
                  {/* Resumo Executivo */}
                  {analysis.resumoExecutivo && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Resumo Executivo
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{analysis.resumoExecutivo}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Pontos-Chave */}
                  {analysis.pontosChave && analysis.pontosChave.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ListChecks className="h-4 w-4" />
                          Pontos-Chave
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {analysis.pontosChave.map((ponto, i) => (
                            <li key={i}>{ponto}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Ações */}
                  {analysis.acoes && analysis.acoes.length > 0 && (
                    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
                          <ListChecks className="h-4 w-4" />
                          Action Items
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {analysis.acoes.map((acao, i) => (
                            <li key={i}>{acao}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Partes Envolvidas */}
                  {analysis.partesEnvolvidas && analysis.partesEnvolvidas.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Partes Mencionadas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {analysis.partesEnvolvidas.map((parte, i) => (
                            <Badge key={i} variant="secondary">{parte}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Relevância Jurídica */}
                  {analysis.relevanciaJuridica?.temRelevancia && (
                    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400">
                          <Sparkles className="h-4 w-4" />
                          Relevância Jurídica
                          <Badge 
                            variant={
                              analysis.relevanciaJuridica.nivelUrgencia === "alto" 
                                ? "destructive" 
                                : "secondary"
                            }
                            className="ml-2"
                          >
                            {analysis.relevanciaJuridica.nivelUrgencia}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {analysis.relevanciaJuridica.elementos.map((elem, i) => (
                            <li key={i}>{elem}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Citações Importantes */}
                  {analysis.citacoesImportantes && analysis.citacoesImportantes.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Citações Importantes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {analysis.citacoesImportantes.map((citacao, i) => (
                          <blockquote 
                            key={i} 
                            className="border-l-2 border-muted-foreground/30 pl-3 text-sm italic"
                          >
                            "{citacao}"
                          </blockquote>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Tab: Estratégia (OMNI-SÊNIOR) */}
            <TabsContent value="estrategia" className="m-0 space-y-4">
              {!seniorAnalysis ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Scale className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aguardando processamento OMNI-SÊNIOR...</p>
                  <p className="text-xs mt-1">A análise estratégica será gerada automaticamente.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Decisão Estratégica Principal */}
                  <Card className={
                    seniorAnalysis.decisao_estrategica === "AGIR" 
                      ? "border-red-300 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20" 
                      : seniorAnalysis.decisao_estrategica === "REGISTRAR"
                      ? "border-blue-300 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20"
                      : "border-green-300 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20"
                  }>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Scale className="h-5 w-5" />
                          Decisão Estratégica
                        </span>
                        <Badge variant={getDecisaoBadgeVariant(seniorAnalysis.decisao_estrategica)} className="text-sm px-3 py-1">
                          {seniorAnalysis.decisao_estrategica}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Risco de Preclusão */}
                      {seniorAnalysis.risco_preclusao && seniorAnalysis.risco_preclusao !== "NENHUM" && (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium">Risco de Preclusão:</span>
                          <Badge variant={getRiscoBadgeVariant(seniorAnalysis.risco_preclusao)}>
                            {seniorAnalysis.risco_preclusao}
                          </Badge>
                        </div>
                      )}

                      {/* Tipo de Ato */}
                      {seniorAnalysis.tipo_ato && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Tipo de Ato:</span>
                          <p className="text-sm mt-1">{seniorAnalysis.tipo_ato}</p>
                        </div>
                      )}

                      {/* Fase Processual */}
                      {seniorAnalysis.fase_processual && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Fase Processual:</span>
                          <Badge variant="outline" className="ml-2 capitalize">
                            {seniorAnalysis.fase_processual}
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Fato Central */}
                  {seniorAnalysis.fato_central && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Fato Central
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{seniorAnalysis.fato_central}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Consequência Jurídica */}
                  {seniorAnalysis.consequencia_juridica && (
                    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-4 w-4" />
                          Consequência Jurídica
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{seniorAnalysis.consequencia_juridica}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Peça Sugerida (se AGIR) */}
                  {seniorAnalysis.decisao_estrategica === "AGIR" && seniorAnalysis.peca_sugerida && (
                    <Card className="border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
                          <FileText className="h-4 w-4" />
                          Peça Sugerida
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-medium">{seniorAnalysis.peca_sugerida}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Justificativa do Silêncio (se SILENCIAR) */}
                  {seniorAnalysis.decisao_estrategica === "SILENCIAR" && seniorAnalysis.justificativa_silencio && (
                    <Card className="border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                          <ShieldCheck className="h-4 w-4" />
                          Justificativa do Silêncio
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{seniorAnalysis.justificativa_silencio}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Fundamento Legal */}
                  {seniorAnalysis.fundamento_legal && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Scale className="h-4 w-4" />
                          Fundamento Legal
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-mono text-muted-foreground">{seniorAnalysis.fundamento_legal}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Tab: Checklist (OMNI-SÊNIOR) */}
            <TabsContent value="checklist" className="m-0 space-y-4">
              {(() => {
                const checklist = Array.isArray(seniorAnalysis?.checklist) ? seniorAnalysis!.checklist : [];
                
                if (!seniorAnalysis) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aguardando processamento OMNI-SÊNIOR...</p>
                    </div>
                  );
                }
                
                if (checklist.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum checklist disponível.</p>
                      <p className="text-xs mt-1">Não foram identificados itens de verificação.</p>
                    </div>
                  );
                }
                
                return (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ListChecks className="h-4 w-4" />
                        Itens de Verificação
                        <Badge variant="secondary" className="ml-2">
                          {checklist.length} {checklist.length === 1 ? 'item' : 'itens'}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {checklist.map((item, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <Checkbox id={`check-${i}`} className="mt-0.5" />
                            <label 
                              htmlFor={`check-${i}`} 
                              className="text-sm cursor-pointer leading-relaxed"
                            >
                              {item}
                            </label>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })()}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
