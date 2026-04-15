// src/components/nija/NijaDocumentPreview.tsx
// NIJA Document Preview - Presentational component for detected metadata (sem timeline duplicada)

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Loader2, Trash2 } from "lucide-react";
import type { QuickMetadata } from "@/nija/core/engine";


// ======================================================
// TYPES
// ======================================================

export interface NijaDocumentPreviewProps {
  detectedMetadata: QuickMetadata | null;
  documentPreview: string | null;
  isLoadingPreview: boolean;
  actingSide: "REU" | "AUTOR";
  clientName: string;
  opponentName: string;
  processNumber: string;
  lawyerName: string;
  oabNumber: string;
  onClear: () => void;
}

// ======================================================
// COMPONENT
// ======================================================

export function NijaDocumentPreview({
  detectedMetadata,
  documentPreview,
  isLoadingPreview,
  actingSide,
  clientName,
  opponentName,
  processNumber,
  lawyerName,
  oabNumber,
  onClear,
}: NijaDocumentPreviewProps) {
  // Early return if nothing to show
  if (!detectedMetadata && !documentPreview && !isLoadingPreview) {
    return null;
  }

  return (
    <Card className="border-dashed border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              {isLoadingPreview ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              ) : (
                <Eye className="h-4 w-4 text-primary" />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium text-primary">
                {isLoadingPreview ? "Analisando documento..." : "Prévia do documento"}
              </p>
              <p className="text-xs text-muted-foreground">
                Dados extraídos localmente
              </p>
            </div>
          </div>

          {(detectedMetadata || documentPreview) && !isLoadingPreview && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={onClear}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Dados estruturados */}
        {detectedMetadata && (
          <div className="mt-3 rounded-md border bg-card/40 p-3">
            <dl className="space-y-2">
              {/* Cliente */}
              <div className="flex items-start justify-between gap-3">
                <dt className="text-xs text-muted-foreground">Cliente</dt>
                <dd className="text-sm font-medium text-foreground text-right break-words">
                  {(() => {
                    const clientValue = actingSide === "AUTOR"
                      ? (detectedMetadata.authorName || clientName)
                      : (detectedMetadata.defendantName || clientName);
                    return clientValue || "Não identificado";
                  })()}
                </dd>
              </div>

              {/* Parte contrária */}
              <div className="flex items-start justify-between gap-3">
                <dt className="text-xs text-muted-foreground">Parte contrária</dt>
                <dd className="text-sm font-medium text-foreground text-right break-words">
                  {(() => {
                    const opponentValue = actingSide === "AUTOR"
                      ? (detectedMetadata.defendantName || opponentName)
                      : (detectedMetadata.authorName || opponentName);
                    return opponentValue || "Não identificado";
                  })()}
                </dd>
              </div>

              {/* Nº do processo */}
              <div className="flex items-start justify-between gap-3">
                <dt className="text-xs text-muted-foreground">Nº do processo</dt>
                <dd className="text-xs font-mono text-foreground text-right break-all">
                  {detectedMetadata.cnjNumber || processNumber || "Não identificado"}
                </dd>
              </div>

              {/* Advogado */}
              <div className="flex items-start justify-between gap-3">
                <dt className="text-xs text-muted-foreground">Advogado</dt>
                <dd className="text-sm font-medium text-foreground text-right break-words">
                  {(() => {
                    const lawyer = detectedMetadata.lawyerName || lawyerName;
                    const oab = detectedMetadata.oabNumber || oabNumber;
                    
                    if (!lawyer) {
                      return "Não identificado";
                    }
                    
                    if (oab) {
                      return (
                        <>
                          {lawyer}
                          <span className="ml-1 text-xs text-muted-foreground">
                            — OAB {oab}
                          </span>
                        </>
                      );
                    }
                    
                    return lawyer;
                  })()}
                </dd>
              </div>
            </dl>
            
            {/* Timeline removida - aparece apenas no NijaExtractionResultCard */}
          </div>
        )}

        {/* Resumo IA */}
        {isLoadingPreview ? (
          <p className="mt-3 text-sm text-muted-foreground italic">Gerando resumo automático...</p>
        ) : documentPreview ? (
          <p className="mt-3 text-sm text-foreground leading-relaxed">{documentPreview}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

NijaDocumentPreview.displayName = "NijaDocumentPreview";
