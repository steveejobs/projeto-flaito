import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { runNijaFullAnalysis } from "@/services/nijaFullAnalysis";
import type { NijaFullAnalysisResult } from "@/types/nija-contracts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, AlertTriangle, Shield, FileText, Clock, FileWarning, CheckCircle } from "lucide-react";
import { NijaExtractionStatusCard, DocumentWithExtraction } from "@/components/NijaExtractionStatusCard";
import { canAnalyzeDocuments, getBlockingReason } from "@/nija/connectors/pdf/pdfClientExtractor";
import type { ReadingStatus } from "@/nija/connectors/pdf/pdfClientExtractor";

import { useDocumentExtraction, type DocumentForExtraction } from "@/hooks/useDocumentExtraction";
import { toast } from "sonner";
import { AuditSeal } from "@/components/shared/AuditSeal";

interface DocumentWithStatus {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  extracted_text: string | null;
  reading_status: ReadingStatus | null;
  extracted_text_chars: number | null;
  extracted_pages_total: number | null;
  extracted_pages_with_text: number | null;
  extracted_coverage_ratio: number | null;
  extraction_method: string | null;
  extraction_updated_at: string | null;
}

interface Props {
  caseId: string;
  ramoHint?: string | null;
  faseHint?: string | null;
  poloHint?: "AUTOR" | "REU" | "TERCEIRO" | "INDEFINIDO" | null;
  initialData?: NijaFullAnalysisResult | null;
  onSaved?: () => void;
}

const RISCO_COLORS: Record<string, string> = {
  BAIXO: "bg-green-100 text-green-700 border-green-300",
  MEDIO: "bg-yellow-100 text-yellow-700 border-yellow-300",
  ALTO: "bg-red-100 text-red-700 border-red-300",
};

const GRAVIDADE_COLORS = {
  BAIXA: "bg-green-100 text-green-700",
  MEDIA: "bg-yellow-100 text-yellow-700",
  ALTA: "bg-red-100 text-red-700",
};

export function NijaFullAnalysisCard(props: Props) {
  const { caseId, ramoHint, faseHint, poloHint, initialData, onSaved } = props;
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState(false);
  const [loadingLastAnalysis, setLoadingLastAnalysis] = useState(true);
  const [rawText, setRawText] = useState("");
  const [documents, setDocuments] = useState<DocumentWithStatus[]>([]);
  const [result, setResult] = useState<NijaFullAnalysisResult | null>(initialData ?? null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hook para extração real de documentos
  const { extractDocument, isExtracting, progress } = useDocumentExtraction();

  // Check if all documents have valid reading status
  const canAnalyze = canAnalyzeDocuments(documents);
  const blockingReason = getBlockingReason(documents);

  // Fetch documents - TODOS os documentos, não só os com extracted_text
  const fetchDocuments = useCallback(async () => {
    try {
      setLoadingText(true);
      const { data: docs, error: docError } = await supabase
        .from("documents")
        .select("id, filename, storage_path, mime_type, extracted_text, reading_status, extracted_text_chars, extracted_pages_total, extracted_pages_with_text, extracted_coverage_ratio, extraction_method, extraction_updated_at")
        .eq("case_id", caseId)
        .is("deleted_at", null);

      if (docError) throw docError;

      const typedDocs = (docs ?? []) as DocumentWithStatus[];
      setDocuments(typedDocs);

      // Montar rawText apenas com docs que têm texto extraído
      const allText = typedDocs
        .filter(d => d.extracted_text && d.extracted_text.trim().length > 0)
        .map((d) => d.extracted_text || "")
        .join("\n\n---\n\n");

      setRawText(allText);
    } catch (e) {
      console.error("[NijaFullAnalysis] Error fetching documents:", e);
    } finally {
      setLoadingText(false);
    }
  }, [caseId]);

  // Fetch last saved analysis from case
  useEffect(() => {
    async function fetchLastAnalysis() {
      if (initialData) {
        setLoadingLastAnalysis(false);
        return;
      }
      
      try {
        setLoadingLastAnalysis(true);
        const { data: caseData, error: caseError } = await supabase
          .from("cases")
          .select("nija_full_analysis, nija_full_last_run_at")
          .eq("id", caseId)
          .single();

        if (caseError) throw caseError;

        if (caseData?.nija_full_analysis) {
          const analysisData = caseData.nija_full_analysis as unknown;
          setResult(analysisData as NijaFullAnalysisResult);
          setLastRunAt(caseData.nija_full_last_run_at);
        }
      } catch (e) {
        console.error("[NijaFullAnalysis] Error fetching last analysis:", e);
      } finally {
        setLoadingLastAnalysis(false);
      }
    }

    fetchLastAnalysis();
  }, [caseId, initialData]);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Reprocessar um documento específico ou todos os problemáticos
  const handleReprocess = useCallback(async (docId?: string) => {
    try {
      let docsToProcess: DocumentForExtraction[] = [];

      if (docId) {
        // Reprocessar apenas um documento específico
        const doc = documents.find(d => d.id === docId);
        if (doc) {
          docsToProcess = [{
            id: doc.id,
            storage_path: doc.storage_path,
            filename: doc.filename,
            mime_type: doc.mime_type ?? undefined,
            reading_status: doc.reading_status,
          }];
        }
      } else {
        // Reprocessar todos os documentos problemáticos
        docsToProcess = documents
          .filter(d => 
            !d.reading_status || 
            d.reading_status === "PENDING" || 
            d.reading_status === "FALLBACK_CLIENT_PDFJS" || 
            d.reading_status === "ERROR" ||
            d.reading_status === "INSUFFICIENT_READING"
          )
          .map(d => ({
            id: d.id,
            storage_path: d.storage_path,
            filename: d.filename,
            mime_type: d.mime_type ?? undefined,
            reading_status: d.reading_status,
          }));
      }

      if (docsToProcess.length === 0) {
        toast.info("Nenhum documento para reprocessar");
        return;
      }

      toast.info(`Reprocessando ${docsToProcess.length} documento(s)...`);

      // Processar cada documento
      for (const doc of docsToProcess) {
        await extractDocument(doc);
      }

      toast.success("Reprocessamento concluído!");
      
      // Re-fetch documents para atualizar status
      await fetchDocuments();
    } catch (e) {
      console.error("[NijaFullAnalysis] Error reprocessing:", e);
      toast.error("Erro ao reprocessar documentos");
    }
  }, [documents, extractDocument, fetchDocuments]);

  async function handleRun() {
    try {
      setError(null);

      if (!rawText || rawText.trim().length < 50) {
        setError(
          "O texto extraído é insuficiente para análise. Verifique se os documentos foram importados corretamente."
        );
        return;
      }

      setLoading(true);

      const data = await runNijaFullAnalysis({
        caseId,
        rawText,
        ramoHint,
        faseHint,
        poloHint,
      });

      setResult(data);
      setLastRunAt(new Date().toISOString());

      // Confirmar que salvou no banco
      const { data: caseData, error: caseError } = await supabase
        .from("cases")
        .select("nija_full_analysis, nija_full_last_run_at")
        .eq("id", caseId)
        .single();

      if (!caseError && caseData?.nija_full_last_run_at) {
        toast.success("Análise NIJA salva no caso!", {
          icon: <CheckCircle className="h-4 w-4 text-green-600" />,
        });
        onSaved?.();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao executar NIJA.";
      
      // Mensagem amigável para leitura insuficiente
      if (msg.includes("LEITURA_INSUFICIENTE")) {
        setError("A análise não pode ser executada porque alguns documentos ainda não foram lidos corretamente. Clique em 'Reprocessar' para tentar novamente.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // Converter documents para o formato esperado pelo NijaExtractionStatusCard
  const extractionDocs: DocumentWithExtraction[] = documents.map(d => ({
    id: d.id,
    filename: d.filename,
    reading_status: d.reading_status,
    extracted_text_chars: d.extracted_text_chars,
    extracted_pages_total: d.extracted_pages_total,
    extracted_pages_with_text: d.extracted_pages_with_text,
    extracted_coverage_ratio: d.extracted_coverage_ratio,
    extraction_method: d.extraction_method,
  }));

  const disabled = loading || loadingText || !rawText || !canAnalyze || isExtracting;
  const hasDocuments = documents.length > 0;
  const showLastAnalysis = result && !loadingLastAnalysis;

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          <div>
            <CardTitle className="text-base">NIJA – Análise Integrada</CardTitle>
            <CardDescription>
              {showLastAnalysis && lastRunAt ? (
                <>Última análise: {new Date(lastRunAt).toLocaleString("pt-BR")}</>
              ) : (
                <>Detecta ramo, fase, prescrição, vícios e teses automaticamente.</>
              )}
            </CardDescription>
          </div>
        </div>
        <Button onClick={handleRun} disabled={disabled} variant={showLastAnalysis ? "outline" : "default"}>
          {loading ? "Analisando..." : showLastAnalysis ? "Reanalisar" : "Rodar análise"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {/* Loading state for last analysis */}
        {loadingLastAnalysis && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4 animate-pulse" />
            <span>Carregando última análise...</span>
          </div>
        )}

        {/* Extraction Status Card - sempre mostra se há documentos */}
        {hasDocuments && (
          <NijaExtractionStatusCard 
            documents={extractionDocs} 
            onReprocess={handleReprocess}
            isReprocessing={isExtracting}
            progress={progress}
          />
        )}

        {loadingText && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Carregando textos dos documentos...
          </p>
        )}

        {/* Show message only if there's no last analysis AND no documents */}
        {!loadingText && !hasDocuments && !showLastAnalysis && !loadingLastAnalysis && (
          <p className="text-xs text-muted-foreground">
            Nenhum documento encontrado. Faça upload de documentos para habilitar a análise.
          </p>
        )}

        {/* Info when there's a saved analysis but no documents for re-analysis */}
        {showLastAnalysis && !hasDocuments && !loadingText && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
            <FileText className="w-4 h-4" />
            <span>
              Exibindo última análise salva. Faça upload de documentos para executar nova análise.
            </span>
          </div>
        )}

        {!canAnalyze && blockingReason && !loadingText && hasDocuments && (
          <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-md p-2">
            <FileWarning className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1">
              <span>{blockingReason}</span>
              <Button 
                variant="link" 
                size="sm" 
                className="text-amber-700 p-0 h-auto ml-2"
                onClick={() => handleReprocess()}
                disabled={isExtracting}
              >
                {isExtracting ? `Reprocessando ${progress.current}/${progress.total}...` : "Reprocessar todos"}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm mt-2">
            {error}
          </div>
        )}

        {showLastAnalysis && (
          <div className="space-y-3 relative group">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="border rounded-lg p-2">
                <p className="text-xs font-semibold">Ramo</p>
                <p className="text-sm">{result?.meta?.ramo}</p>
                {!result?.meta?.ramoConfiavel && (
                  <p className="text-[11px] text-yellow-700 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Verificar manualmente
                  </p>
                )}
              </div>
              <div className="border rounded-lg p-2">
                <p className="text-xs font-semibold">Fase</p>
                <p className="text-sm">{result?.meta?.faseProcessual}</p>
              </div>
              <div className="border rounded-lg p-2">
                <p className="text-xs font-semibold">Polo</p>
                <p className="text-sm">
                  {result?.meta?.poloAtuacao === "AUTOR"
                    ? "Autor"
                    : result?.meta?.poloAtuacao === "REU"
                    ? "Réu"
                    : "Indefinido"}
                </p>
              </div>
              <div className="border rounded-lg p-2">
                <p className="text-xs font-semibold">Risco Global</p>
                <Badge
                  variant="outline"
                  className={`mt-1 ${result?.meta?.grauRiscoGlobal && RISCO_COLORS[result.meta.grauRiscoGlobal as string] ? RISCO_COLORS[result.meta.grauRiscoGlobal as string] : ""}`}
                >
                  {result?.meta?.grauRiscoGlobal}
                </Badge>
              </div>
            </div>

            <div className="border rounded-lg p-2 space-y-1">
              <p className="text-xs font-semibold flex items-center gap-1">
                <Shield className="w-3 h-3" /> Resumo tático
              </p>
              <p className="text-sm whitespace-pre-line">{result?.meta?.resumoTatico}</p>
            </div>

            {result.prescricao && (
              <div className="border rounded-lg p-2 space-y-1">
                <p className="text-xs font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Prescrição
                </p>
                <Badge
                  variant="outline"
                  className={result.prescricao.risco ? (RISCO_COLORS[result.prescricao.risco as string] ?? "") : ""}
                >
                  {result.prescricao.tipo}
                </Badge>
                <p className="text-xs text-muted-foreground whitespace-pre-line mt-1">
                  {result.prescricao.fundamentacao}
                </p>
              </div>
            )}

            {result.vicios && result.vicios.length > 0 && (
              <div className="border rounded-lg p-2 space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Vícios detectados ({result.vicios.length})
                </p>
                <div className="space-y-2">
                  {result.vicios.slice(0, 5).map((vicio, i) => (
                    <div key={i} className="border rounded-md p-2 bg-muted/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{vicio.label}</span>
                        <div className="flex gap-1">
                          <Badge className={(vicio.gravidade as string) ? (GRAVIDADE_COLORS[vicio.gravidade as keyof typeof GRAVIDADE_COLORS] ?? "") : ""}>
                            {vicio.gravidade}
                          </Badge>
                          <Badge variant="outline">{vicio.natureza}</Badge>
                        </div>
                      </div>
                      {vicio.atoRelacionado && (
                        <p className="text-xs text-muted-foreground">
                          <strong>Ato:</strong> {vicio.atoRelacionado}
                        </p>
                      )}
                      {vicio.observacoes && (
                        <p className="text-xs text-muted-foreground whitespace-pre-line">
                          {vicio.observacoes}
                        </p>
                      )}
                    </div>
                  ))}
                  {result.vicios.length > 5 && (
                    <p className="text-[11px] text-muted-foreground">
                      +{result.vicios.length - 5} vícios adicionais…
                    </p>
                  )}
                </div>
              </div>
            )}

            {result.sugestaoPeca && (
              <div className="border rounded-lg p-2 space-y-1">
                <p className="text-xs font-semibold flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Sugestão de peça
                </p>
                <p className="text-sm font-medium">{result.sugestaoPeca.tituloSugestao}</p>
                <p className="text-xs text-muted-foreground">
                  Foco: {result.sugestaoPeca.focoPrincipal}
                </p>
              </div>
            )}

            {/* Audit Seal for NIJA Analysis */}
            {result._audit && (
              <AuditSeal 
                audit={result._audit} 
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 -bottom-1 -right-1" 
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
