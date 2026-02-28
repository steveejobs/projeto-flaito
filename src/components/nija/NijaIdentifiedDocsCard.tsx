// src/components/nija/NijaIdentifiedDocsCard.tsx
// NIJA Identified Docs Card - Presentational component for TJTO-identified documents display

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileCheck, Trash2 } from "lucide-react";
import type { EnrichedDoc } from "@/nija";

// ======================================================
// TYPES
// ======================================================

export interface NijaIdentifiedDocsCardProps {
  identifiedDocs: EnrichedDoc[];
  onClear: () => void;
}

// ======================================================
// COMPONENT
// ======================================================

export function NijaIdentifiedDocsCard({
  identifiedDocs,
  onClear,
}: NijaIdentifiedDocsCardProps) {
  // Early return if no documents
  if (identifiedDocs.length === 0) {
    return null;
  }

  return (
    <Card className="border-dashed border-green-500/30 bg-gradient-to-r from-green-500/5 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
            <FileCheck className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-green-600 mb-2">
              Documentos identificados ({identifiedDocs.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {identifiedDocs.map((doc, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                >
                  {doc.label || "Outros Documentos"}
                  {doc.category && doc.category !== "ANEXO" && (
                    <span className="ml-1 opacity-70">({doc.category})</span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={onClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

NijaIdentifiedDocsCard.displayName = "NijaIdentifiedDocsCard";
