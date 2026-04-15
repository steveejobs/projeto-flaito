// src/components/nija/NijaEventTimeline.tsx
// NIJA Event Timeline - Presentational component for process events display

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProcessEvent } from "@/nija/core/engine";

import type { NijaLinhaTempoItem } from "@/types/nija-contracts";
import { 
  FileText, 
  Target, 
  Scale, 
  ShieldCheck, 
  PenTool, 
  Brain,
  History,
  FileSearch
} from "lucide-react";

// ======================================================
// TYPES
// ======================================================

export interface NijaEventTimelineProps {
  events: (ProcessEvent | NijaLinhaTempoItem)[];
  maxHeight?: string;
  isMaestroMode?: boolean;
}

// ======================================================
// HELPERS
// ======================================================

function getMaestroStyle(label: string | undefined, code: string | undefined) {
  const text = (label || code || "").toUpperCase();
  
  if (text.includes("DOSSIÊ") || text.includes("EXTRAÇÃO")) {
    return { icon: <FileSearch className="h-3 w-3" />, color: "border-muted-foreground/30 bg-muted/20 text-muted-foreground" };
  }
  if (text.includes("ESTRATÉGIA") || text.includes("RESUMO")) {
    return { icon: <Target className="h-3 w-3" />, color: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300" };
  }
  if (text.includes("SIMULAÇÃO") || text.includes("JUIZ")) {
    return { icon: <Scale className="h-3 w-3" />, color: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300" };
  }
  if (text.includes("AUDITORIA") || text.includes("REVISÃO")) {
    return { icon: <ShieldCheck className="h-3 w-3" />, color: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" };
  }
  if (text.includes("MINUTA") || text.includes("GERAÇÃO")) {
    return { icon: <PenTool className="h-3 w-3" />, color: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300" };
  }
  
  return { icon: <History className="h-3 w-3" />, color: "border-primary/30 bg-muted/30 text-foreground" };
}

/**
 * Normalizes timeline text
 */
function normalizeTimelineText(s: string): string {
  if (!s) return "";
  let normalized = s.replace(/[\u2028\u2029\u000b\t]/g, " ");
  normalized = normalized.replace(/\s{2,}/g, " ");
  normalized = normalized.replace(/^(\d+)\s+\1\s+/, "$1 ");
  return normalized.trim();
}

/**
 * Normalizes event number
 */
function normalizeEventNumber(eventNumber: number | string | undefined, fallback: number): string {
  if (eventNumber === undefined || eventNumber === null) {
    return String(fallback).padStart(2, "0");
  }
  const str = String(eventNumber).trim();
  const match = str.match(/^\d+/);
  if (match) {
    return match[0].padStart(2, "0");
  }
  return String(fallback).padStart(2, "0");
}

// ======================================================
// COMPONENT
// ======================================================

export function NijaEventTimeline({ 
  events, 
  maxHeight = "max-h-64",
  isMaestroMode = false
}: NijaEventTimelineProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {isMaestroMode ? (
            <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center">
              <Brain className="h-3 w-3 text-primary" />
            </div>
          ) : (
            <History className="h-4 w-4 text-muted-foreground" />
          )}
          <p className="text-xs font-semibold text-foreground">
            {isMaestroMode ? "Pipeline Maestro (Processamento IA)" : "Eventos do processo (Timeline)"}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] h-4">
          {events.length} {events.length === 1 ? "evento" : "eventos"}
        </Badge>
      </div>

      <ScrollArea className={`${maxHeight} pr-3`}>
        <ol className="space-y-2">
          {events.map((event, idx) => {
            const isSharedContract = 'tipoAto' in event;
            const descriptionInput = isSharedContract ? (event as NijaLinhaTempoItem).descricao : (event as ProcessEvent).description;
            const dateInput = isSharedContract ? (event as NijaLinhaTempoItem).dataDetectada : (event as ProcessEvent).date;
            const codeInput = isSharedContract ? (event as NijaLinhaTempoItem).tipoAto : (event as ProcessEvent).code;
            const eventNumRaw = isSharedContract ? (event as NijaLinhaTempoItem).ordem : (event as ProcessEvent).eventNumber;
            const enrichedLabel = isSharedContract ? undefined : (event as ProcessEvent).enrichedLabel;

            const eventNum = normalizeEventNumber(eventNumRaw, idx + 1);
            const normalizedDescription = normalizeTimelineText(descriptionInput);
            const normalizedDate = dateInput ? normalizeTimelineText(dateInput) : null;
            const normalizedCode = codeInput ? normalizeTimelineText(codeInput) : null;

            // Premium styling logic
            const { icon, color } = getMaestroStyle(enrichedLabel || normalizedCode || normalizedDescription, normalizedCode);

            return (
              <li key={idx} className={`group flex flex-col gap-1.5 p-2.5 rounded-lg border-l-4 transition-all hover:translate-x-1 ${color}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 rounded bg-background/50">
                      {icon}
                    </span>
                    <span className="text-[10px] font-mono opacity-70">
                      #{eventNum}
                    </span>
                  </div>
                  {normalizedDate && (
                    <span className="text-[10px] opacity-70 flex items-center gap-1">
                      {normalizedDate}
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col gap-0.5">
                  {(enrichedLabel || normalizedCode) && (
                    <p className="text-[11px] font-bold leading-tight">
                      {enrichedLabel || normalizedCode}
                    </p>
                  )}
                  <p className="text-xs opacity-90 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
                    {normalizedDescription}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </ScrollArea>
    </div>
  );
}

NijaEventTimeline.displayName = "NijaEventTimeline";
