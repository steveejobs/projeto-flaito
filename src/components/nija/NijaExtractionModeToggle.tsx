// src/components/nija/NijaExtractionModeToggle.tsx
// NIJA Mode Toggle - Switch between EXTRACTION_ONLY and NIJA_ANALYSIS modes (COMPACT)

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSearch, Brain } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NijaOperationMode } from "@/nija";

export interface NijaExtractionModeToggleProps {
  mode: NijaOperationMode;
  onModeChange: (mode: NijaOperationMode) => void;
  disabled?: boolean;
}

export function NijaExtractionModeToggle({
  mode,
  onModeChange,
  disabled = false,
}: NijaExtractionModeToggleProps) {
  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === "EXTRACTION_ONLY" ? "default" : "outline"}
              size="sm"
              onClick={() => onModeChange("EXTRACTION_ONLY")}
              disabled={disabled}
              className={`gap-2 ${mode === "EXTRACTION_ONLY" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
            >
              <FileSearch className="h-4 w-4" />
              Extração EPROC
              {mode === "EXTRACTION_ONLY" && (
                <Badge variant="secondary" className="ml-1 text-[10px]">ativo</Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">
              <strong>Extração pura:</strong> Organiza dados literais dos autos sem interpretação IA.
            </p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === "NIJA_ANALYSIS" ? "default" : "outline"}
              size="sm"
              onClick={() => onModeChange("NIJA_ANALYSIS")}
              disabled={disabled}
              className="gap-2"
            >
              <Brain className="h-4 w-4" />
              Análise NIJA
              {mode === "NIJA_ANALYSIS" && (
                <Badge variant="secondary" className="ml-1 text-[10px]">ativo</Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">
              <strong>Análise completa:</strong> Diagnóstico jurídico com IA, vícios, estratégias e prescrição.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

NijaExtractionModeToggle.displayName = "NijaExtractionModeToggle";
