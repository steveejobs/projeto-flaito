// src/features/cases/CaseForensicAuditPanel.tsx
// Painel de Auditoria Forense para validar qualidade de extração

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  FileText,
  ImageIcon,
  CheckCircle2,
  HelpCircle,
  Edit2,
  Save,
  X,
  FileCheck,
  BarChart3,
  RefreshCw,
  Loader2,
  Search,
  LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCaseSegments,
  updateSegmentNature,
  deleteCaseSegments,
  saveEventSegments,
  mapCategoryToNature,
  NATURE_LABELS,
} from "@/nija/extraction/eventSegments";
import type { 
  EventSegment, 
  DocumentNature, 
  EventSegmentInput 
} from "@/types/nija-contracts";
import { extractEprocDataPure } from "@/nija/connectors/eproc/detector";
import { 
  inferCategoryFromText, 
  getEprocEventDictionaryCached 
} from "@/nija/connectors/eproc/eventDictionary";
import { 
  getTjtoDictionaryCached, 
  extractDocCode 
} from "@/nija/connectors/tjto/dictionary";

interface CaseForensicAuditPanelProps {
  caseId: string;
}

interface DocumentInfo {
  id: string;
  filename: string;
  is_image_pdf: boolean | null;
  status: string;
  created_at: string;
}

interface ConfidenceStats {
  high: number;
  medium: number;
  low: number;
  total: number;
}

// Helper para converter data EPROC (DD/MM/YYYY) para ISO (YYYY-MM-DD)
function parseEprocDateToISO(dateStr: string): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return null;
}

export function CaseForensicAuditPanel({ caseId }: CaseForensicAuditPanelProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [segments, setSegments] = useState<EventSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editNature, setEditNature] = useState<DocumentNature>("sistemico");

  const loadData = useCallback(async () => {
    setLoading(true);

    // Carregar documentos com flag is_image_pdf e extracted_text
    const { data: docs } = await (supabase as any)
      .from("documents")
      .select("id, filename, is_image_pdf, status, created_at, extracted_text")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    // Carregar segmentos de eventos
    const segs = await getCaseSegments(caseId);

    setDocuments((docs as (DocumentInfo & { extracted_text?: string })[]) || []);
    setSegments(segs);
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calcular estatísticas de confiança
  const confidenceStats: ConfidenceStats = segments.reduce(
    (acc, seg) => {
      acc[seg.confidence]++;
      acc.total++;
      return acc;
    },
    { high: 0, medium: 0, low: 0, total: 0 }
  );

  // Handler para salvar edição de nature
  const handleSaveNature = async (segmentId: string) => {
    const result = await updateSegmentNature(segmentId, editNature);
    if (result.success) {
      toast.success("Natureza atualizada com sucesso");
      setEditingSegmentId(null);
      loadData();
    } else {
      toast.error("Erro ao atualizar: " + result.error);
    }
  };

  // Handler para reprocessar extração
  const handleReprocessExtraction = async () => {
    setReprocessing(true);
    
    try {
      // 1. Buscar office_id do caso
      const { data: caseData, error: caseError } = await supabase
        .from("cases")
        .select("office_id")
        .eq("id", caseId)
        .maybeSingle();
      
      if (caseError || !caseData) {
        toast.error("Erro ao buscar dados do caso");
        return;
      }
      
      const officeId = caseData.office_id;
      
      // 2. Buscar texto extraído de todos os documentos
      const { data: docsWithText } = await (supabase as any)
        .from("documents")
        .select("id, extracted_text")
        .eq("case_id", caseId)
        .not("extracted_text", "is", null);
      
      if (!docsWithText || docsWithText.length === 0) {
        toast.error("Nenhum documento com texto extraído encontrado");
        return;
      }
      
      // 3. Concatenar todo o texto
      const allText = docsWithText
        .map((d: { extracted_text?: string }) => d.extracted_text || "")
        .join("\n\n---\n\n");
      
      if (allText.trim().length < 500) {
        toast.error("Texto insuficiente para reprocessamento");
        return;
      }
      
      // 4. Limpar segmentos existentes
      await deleteCaseSegments(caseId);
      
      // 5. Executar extração pura EPROC
      const extractionResult = extractEprocDataPure(allText);
      
      // 6. Buscar eventos existentes do caso (case_events)
      const { data: caseEvents } = await supabase
        .from("case_events")
        .select("id, title, payload, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      
      // 7. Carregar dicionários para enriquecer
      const [tjtoDict, eprocDict] = await Promise.all([
        getTjtoDictionaryCached(),
        getEprocEventDictionaryCached(),
      ]);
      
      // 8. Criar novos segmentos a partir dos eventos extraídos
      const newSegments: EventSegmentInput[] = [];
      
      // Usar eventos do extractionResult
      for (let i = 0; i < extractionResult.eventos.length; i++) {
        const evento = extractionResult.eventos[i];
        
        // Encontrar o case_event correspondente se existir
        const matchingEvent = caseEvents?.find((ce) => {
          const payload = ce.payload as Record<string, unknown>;
          return payload?.descricaoLiteral === evento.descricaoLiteral ||
                 ce.title === evento.tipoEvento;
        });
        
        // Determinar código TJTO e categoria
        const code = evento.codigoTjto || extractDocCode(evento.descricaoLiteral);
        let category = code && eprocDict[code] ? eprocDict[code].category : undefined;
        if (!category) {
          category = inferCategoryFromText(evento.descricaoLiteral);
        }
        
        // Determinar confiança
        const confidence: "high" | "medium" | "low" = 
          code && tjtoDict[code] ? "high" : 
          category ? "medium" : "low";
        
        newSegments.push({
          caseId,
          eventId: matchingEvent?.id || crypto.randomUUID(),
          officeId,
          seqNumber: evento.numeroEvento || i + 1,
          eventDate: evento.data ? parseEprocDateToISO(evento.data) : null,
          rawDescription: evento.descricaoLiteral,
          documentNature: mapCategoryToNature(category),
          label: evento.labelEnriquecido || evento.tipoEvento || evento.descricaoLiteral.slice(0, 100),
          tjtoCode: code || null,
          excerpt: evento.descricaoLiteral.slice(0, 300),
          confidence,
        });
      }
      
      // 9. Salvar novos segmentos
      if (newSegments.length > 0) {
        const result = await saveEventSegments(newSegments);
        if (result.success) {
          toast.success(`Reprocessamento concluído: ${result.count} eventos segmentados`);
        } else {
          toast.error("Erro ao salvar segmentos: " + result.error);
        }
      } else {
        toast.info("Nenhum evento encontrado no texto extraído");
      }
      
      // 10. Recarregar dados
      await loadData();
      
    } catch (err) {
      console.error("[CaseForensicAuditPanel] Erro ao reprocessar:", err);
      toast.error("Erro ao reprocessar extração");
    } finally {
      setReprocessing(false);
    }
  };

  // Handler para sincronizar documentos por número do processo
  const handleSyncDocuments = async () => {
    setSyncing(true);
    
    try {
      // 1. Buscar dados do caso (CNJ e office_id)
      const { data: caseData, error: caseError } = await supabase
        .from("cases")
        .select("cnj_number, office_id")
        .eq("id", caseId)
        .maybeSingle();
      
      if (caseError || !caseData) {
        toast.error("Erro ao buscar dados do caso");
        return;
      }
      
      if (!caseData.cnj_number) {
        toast.error("Número do processo (CNJ) não definido para este caso");
        return;
      }
      
      // 2. Buscar documentos com mesmo padrão CNJ no extracted_text (não vinculados)
      // Limpar o CNJ para buscar variações
      const cnjDigits = caseData.cnj_number.replace(/\D/g, "");
      
      if (cnjDigits.length < 10) {
        toast.error("Número CNJ inválido para sincronização");
        return;
      }
      
      // Buscar documentos do mesmo escritório sem case_id que contenham o CNJ no texto
      const { data: orphanDocs, error: orphanError } = await (supabase as any)
        .from("documents")
        .select("id, filename, extracted_text")
        .eq("office_id", caseData.office_id)
        .is("case_id", null);
      
      if (orphanError) {
        toast.error("Erro ao buscar documentos órfãos");
        return;
      }
      
      if (!orphanDocs || orphanDocs.length === 0) {
        toast.info("Nenhum documento sem vínculo encontrado");
        await loadData();
        return;
      }
      
      // 3. Filtrar documentos que contêm o CNJ no texto extraído
      const matchingDocs = orphanDocs.filter((doc: { extracted_text?: string }) => {
        const text = doc.extracted_text || "";
        // Buscar CNJ em qualquer formato (com ou sem pontuação)
        return text.includes(cnjDigits) || text.includes(caseData.cnj_number!);
      });
      
      if (matchingDocs.length === 0) {
        toast.info("Nenhum documento com este número de processo encontrado");
        await loadData();
        return;
      }
      
      // 4. Vincular documentos encontrados ao caso
      const docIds = matchingDocs.map((d: { id: string }) => d.id);
      
      const { error: updateError } = await supabase
        .from("documents")
        .update({ case_id: caseId })
        .in("id", docIds);
      
      if (updateError) {
        toast.error("Erro ao vincular documentos: " + updateError.message);
        return;
      }
      
      toast.success(`${docIds.length} documento(s) vinculado(s) ao caso`);
      
      // 5. Recarregar dados
      await loadData();
      
    } catch (err) {
      console.error("[CaseForensicAuditPanel] Erro ao sincronizar:", err);
      toast.error("Erro ao sincronizar documentos");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Carregando auditoria forense...
        </CardContent>
      </Card>
    );
  }

  const imagePdfCount = documents.filter((d) => d.is_image_pdf === true).length;
  const textPdfCount = documents.filter((d) => d.is_image_pdf === false).length;
  const unknownCount = documents.filter((d) => d.is_image_pdf === null).length;

  return (
    <div className="space-y-6">
      {/* RESUMO GERAL */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" />
              Resumo de Auditoria Forense
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncDocuments}
                disabled={syncing || reprocessing}
              >
                {syncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Sincronizar Dados
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReprocessExtraction}
                disabled={reprocessing || syncing || documents.length === 0}
              >
                {reprocessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reprocessando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reprocessar Extração
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Documentos */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <div className="text-2xl font-bold">{documents.length}</div>
              <div className="text-xs text-muted-foreground">Documentos</div>
            </div>
            {/* Eventos Extraídos */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <div className="text-2xl font-bold">{segments.length}</div>
              <div className="text-xs text-muted-foreground">Eventos Extraídos</div>
            </div>
            {/* PDFs Imagem */}
            <div className="p-3 rounded-lg bg-destructive/10 space-y-1">
              <div className="text-2xl font-bold text-destructive">{imagePdfCount}</div>
              <div className="text-xs text-muted-foreground">PDFs Imagem</div>
            </div>
            {/* Alta Confiança */}
            <div className="p-3 rounded-lg bg-green-500/10 space-y-1">
              <div className="text-2xl font-bold text-green-600">{confidenceStats.high}</div>
              <div className="text-xs text-muted-foreground">Alta Confiança</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DIFERENÇA TEXTO vs IMAGEM */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileCheck className="h-5 w-5" />
            Análise de Documentos (Texto vs Imagem)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhum documento vinculado a este caso.
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    doc.is_image_pdf === true
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-border bg-muted/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {doc.is_image_pdf === true ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="p-2 rounded-full bg-destructive/20">
                              <ImageIcon className="h-4 w-4 text-destructive" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>PDF baseado em imagem - texto não extraível</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : doc.is_image_pdf === false ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="p-2 rounded-full bg-green-500/20">
                              <FileText className="h-4 w-4 text-green-600" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>PDF com camada de texto - extração OK</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="p-2 rounded-full bg-muted">
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Ainda não analisado</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <div>
                      <div className="font-medium text-sm">{doc.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        Status: {doc.status}
                      </div>
                    </div>
                  </div>
                  {doc.is_image_pdf === true && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Requer OCR
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Legenda */}
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
              <span>Texto ({textPdfCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-destructive/50" />
              <span>Imagem ({imagePdfCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-muted" />
              <span>Não analisado ({unknownCount})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RESUMO DE CONFIANÇA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="h-5 w-5" />
            Resumo de Confiança dos Eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {confidenceStats.total === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhum evento segmentado encontrado.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Barra de progresso visual */}
              <div className="h-4 rounded-full overflow-hidden flex bg-muted">
                {confidenceStats.high > 0 && (
                  <div
                    className="bg-green-500 transition-all"
                    style={{
                      width: `${(confidenceStats.high / confidenceStats.total) * 100}%`,
                    }}
                  />
                )}
                {confidenceStats.medium > 0 && (
                  <div
                    className="bg-yellow-500 transition-all"
                    style={{
                      width: `${(confidenceStats.medium / confidenceStats.total) * 100}%`,
                    }}
                  />
                )}
                {confidenceStats.low > 0 && (
                  <div
                    className="bg-red-500 transition-all"
                    style={{
                      width: `${(confidenceStats.low / confidenceStats.total) * 100}%`,
                    }}
                  />
                )}
              </div>

              {/* Detalhes */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-xl font-bold text-green-600">
                    {confidenceStats.high}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Alta (código TJTO)
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xl font-bold text-yellow-600">
                    {confidenceStats.medium}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Média (padrão inferido)
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xl font-bold text-red-600">
                    {confidenceStats.low}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Baixa (texto genérico)
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MAPEAMENTO DE EVENTOS E EDIÇÃO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Edit2 className="h-5 w-5" />
            Mapeamento de Eventos Extraídos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {segments.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhum evento segmentado encontrado. Execute a extração NIJA para popular esta seção.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  className="p-3 rounded-lg border bg-muted/20 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs font-mono">
                          #{seg.seq}
                        </Badge>
                        {seg.tjto_code && (
                          <Badge variant="secondary" className="text-xs">
                            {seg.tjto_code}
                          </Badge>
                        )}
                        <Badge
                          variant={
                            seg.confidence === "high"
                              ? "default"
                              : seg.confidence === "medium"
                              ? "secondary"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {seg.confidence === "high"
                            ? "Alta"
                            : seg.confidence === "medium"
                            ? "Média"
                            : "Baixa"}
                        </Badge>
                      </div>
                      <div className="font-medium text-sm mt-1 truncate">
                        {seg.label}
                      </div>
                      {seg.event_date && (
                        <div className="text-xs text-muted-foreground">
                          Data: {new Date(seg.event_date).toLocaleDateString("pt-BR")}
                        </div>
                      )}
                    </div>

                    {/* Nature display/edit */}
                    <div className="flex items-center gap-2 shrink-0">
                      {editingSegmentId === seg.id ? (
                        <>
                          <Select
                            value={editNature}
                            onValueChange={(v) => setEditNature(v as DocumentNature)}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(NATURE_LABELS).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleSaveNature(seg.id)}
                          >
                            <Save className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setEditingSegmentId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge variant="outline" className="text-xs">
                            {NATURE_LABELS[seg.document_nature] || seg.document_nature}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingSegmentId(seg.id);
                              setEditNature(seg.document_nature);
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Excerpt preview */}
                  {seg.excerpt && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded line-clamp-2">
                      {seg.excerpt}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
