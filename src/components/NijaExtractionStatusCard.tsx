/**
 * NIJA Fase 1: Card de status de extração de documentos
 * Exibe métricas, status e botão de reprocessamento
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  RefreshCw,
  FileWarning,
  Clock
} from "lucide-react";
import { type ReadingStatus, type ExtractionReport } from "@/nija";

export interface DocumentWithExtraction {
  id: string;
  filename?: string;
  reading_status: ReadingStatus | null;
  extracted_text_chars?: number | null;
  extracted_pages_total?: number | null;
  extracted_pages_with_text?: number | null;
  extracted_coverage_ratio?: number | null;
  extraction_method?: string | null;
  extraction_report?: ExtractionReport | null;
}

interface NijaExtractionStatusCardProps {
  documents: DocumentWithExtraction[];
  onReprocess?: (docId?: string) => void | Promise<void>;
  isReprocessing?: boolean;
  compact?: boolean;
  progress?: { current: number; total: number };
}

const STATUS_CONFIG: Record<string, { 
  label: string; 
  color: string; 
  icon: typeof CheckCircle;
  bgColor: string;
}> = {
  OK: { 
    label: "Leitura OK", 
    color: "text-green-700", 
    icon: CheckCircle,
    bgColor: "bg-green-50 border-green-200"
  },
  TRUNCATED: { 
    label: "Truncado", 
    color: "text-yellow-700", 
    icon: AlertTriangle,
    bgColor: "bg-yellow-50 border-yellow-200"
  },
  INSUFFICIENT_READING: { 
    label: "Insuficiente", 
    color: "text-red-700", 
    icon: FileWarning,
    bgColor: "bg-red-50 border-red-200"
  },
  FALLBACK_CLIENT_PDFJS: { 
    label: "Aguardando", 
    color: "text-orange-700", 
    icon: RefreshCw,
    bgColor: "bg-orange-50 border-orange-200"
  },
  ERROR: { 
    label: "Erro", 
    color: "text-red-700", 
    icon: XCircle,
    bgColor: "bg-red-50 border-red-200"
  },
  PENDING: { 
    label: "Pendente", 
    color: "text-gray-500", 
    icon: Clock,
    bgColor: "bg-gray-50 border-gray-200"
  },
};

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

function DocumentStatusItem({ 
  doc, 
  onReprocess, 
  isReprocessing 
}: { 
  doc: DocumentWithExtraction; 
  onReprocess?: (docId?: string) => void | Promise<void>;
  isReprocessing?: boolean;
}) {
  const status = doc.reading_status || "PENDING";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = config.icon;
  
  // Build report from individual fields if not provided as object
  const totalPages = doc.extracted_pages_total ?? doc.extraction_report?.total_pages ?? 0;
  const pagesWithText = doc.extracted_pages_with_text ?? doc.extraction_report?.pages_with_text ?? 0;
  const coverageRatio = doc.extracted_coverage_ratio ?? doc.extraction_report?.coverage_ratio ?? 0;

  const canReprocess = status === "INSUFFICIENT_READING" || 
                       status === "FALLBACK_CLIENT_PDFJS" || 
                       status === "ERROR" ||
                       status === "PENDING";

  const displayName = doc.filename || `Documento ${doc.id.slice(0, 8)}`;

  return (
    <div className={`flex items-center justify-between p-2 rounded-md border ${config.bgColor}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Icon className={`h-4 w-4 flex-shrink-0 ${config.color}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" title={displayName}>
            {displayName}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className={`text-[10px] ${config.color}`}>
              {config.label}
            </Badge>
            {(doc.extracted_text_chars ?? 0) > 0 && (
              <span>{formatNumber(doc.extracted_text_chars || 0)} chars</span>
            )}
            {totalPages > 0 && (
              <span>{pagesWithText}/{totalPages} pág.</span>
            )}
            {coverageRatio > 0 && (
              <span>{(coverageRatio * 100).toFixed(0)}% cobertura</span>
            )}
          </div>
        </div>
      </div>
      
      {canReprocess && onReprocess && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => onReprocess(doc.id)}
          disabled={isReprocessing}
        >
          {isReprocessing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  );
}

export function NijaExtractionStatusCard({
  documents,
  onReprocess,
  isReprocessing = false,
  compact = false,
  progress,
}: NijaExtractionStatusCardProps) {
  const [showAll, setShowAll] = useState(false);

  if (!documents || documents.length === 0) {
    return null;
  }

  // Contagem por status
  const statusCounts = documents.reduce((acc, doc) => {
    const status = doc.reading_status || "PENDING";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const okCount = (statusCounts.OK || 0) + (statusCounts.TRUNCATED || 0);
  const problemCount = documents.length - okCount;
  const canAnalyze = problemCount === 0;

  // Métricas totais - use individual fields
  const totalChars = documents.reduce((sum, d) => sum + (d.extracted_text_chars || 0), 0);
  const totalPages = documents.reduce((sum, d) => sum + (d.extracted_pages_total || d.extraction_report?.total_pages || 0), 0);
  const pagesWithText = documents.reduce((sum, d) => sum + (d.extracted_pages_with_text || d.extraction_report?.pages_with_text || 0), 0);

  // Documentos com problemas primeiro
  const sortedDocs = [...documents].sort((a, b) => {
    const aOk = a.reading_status === "OK" || a.reading_status === "TRUNCATED";
    const bOk = b.reading_status === "OK" || b.reading_status === "TRUNCATED";
    if (aOk && !bOk) return 1;
    if (!aOk && bOk) return -1;
    return 0;
  });

  const displayDocs = showAll ? sortedDocs : sortedDocs.slice(0, 3);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {canAnalyze ? (
          <Badge className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            {documents.length} doc(s) OK
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-700 border-red-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {problemCount} doc(s) com problema
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Status de Leitura
          </CardTitle>
          <div className="flex items-center gap-2">
            {canAnalyze ? (
              <Badge className="bg-green-100 text-green-700 border-green-300">
                Pronto para análise
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700 border-red-300">
                {problemCount} problema(s)
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="py-2 px-4 space-y-3">
        {/* Métricas resumidas */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-2 bg-muted/50 rounded">
            <p className="font-semibold">{documents.length}</p>
            <p className="text-muted-foreground">Documentos</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded">
            <p className="font-semibold">{formatNumber(totalChars)}</p>
            <p className="text-muted-foreground">Caracteres</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded">
            <p className="font-semibold">{pagesWithText}/{totalPages}</p>
            <p className="text-muted-foreground">Páginas</p>
          </div>
        </div>

        {/* Progresso geral */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Documentos prontos</span>
            <span>{okCount}/{documents.length}</span>
          </div>
          <Progress value={(okCount / documents.length) * 100} className="h-1.5" />
        </div>

        {/* Lista de documentos */}
        <div className="space-y-1.5">
          {displayDocs.map((doc) => (
            <DocumentStatusItem
              key={doc.id}
              doc={doc}
              onReprocess={onReprocess}
              isReprocessing={isReprocessing}
            />
          ))}
          
          {documents.length > 3 && !showAll && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => setShowAll(true)}
            >
              Ver todos ({documents.length - 3} mais)
            </Button>
          )}
          
          {showAll && documents.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => setShowAll(false)}
            >
              Mostrar menos
            </Button>
          )}
        </div>

        {/* Alerta se há problemas */}
        {!canAnalyze && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-xs text-red-700">
              A análise NIJA está bloqueada. {problemCount} documento(s) precisam de atenção.
              {statusCounts.INSUFFICIENT_READING && (
                <span className="block mt-1">
                  • {statusCounts.INSUFFICIENT_READING} com leitura insuficiente (PDF de imagem?)
                </span>
              )}
              {statusCounts.ERROR && (
                <span className="block">
                  • {statusCounts.ERROR} com erro de processamento
                </span>
              )}
              {(statusCounts.PENDING || statusCounts.FALLBACK_CLIENT_PDFJS) && (
                <span className="block">
                  • {(statusCounts.PENDING || 0) + (statusCounts.FALLBACK_CLIENT_PDFJS || 0)} aguardando processamento
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Alerta informativo para truncados */}
        {statusCounts.TRUNCATED && statusCounts.TRUNCATED > 0 && canAnalyze && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-xs text-yellow-700">
              {statusCounts.TRUNCATED} documento(s) foram truncados por exceder o limite de páginas/caracteres.
              A análise pode ser parcial.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
