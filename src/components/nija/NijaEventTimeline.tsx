// src/components/nija/NijaEventTimeline.tsx
// NIJA Event Timeline - Presentational component for process events display

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProcessEvent } from "@/nija";

// ======================================================
// TYPES
// ======================================================

export interface NijaEventTimelineProps {
  events: ProcessEvent[];
  maxHeight?: string;
}

// ======================================================
// HELPERS
// ======================================================

/**
 * Normalizes timeline text by:
 * - Replacing special whitespace characters with spaces
 * - Collapsing multiple spaces
 * - Removing duplicate numbering at start (e.g., "1  1  16/03/2018" → "1 16/03/2018")
 */
function normalizeTimelineText(s: string): string {
  if (!s) return "";
  
  // Replace special whitespace chars with regular space
  let normalized = s.replace(/[\u2028\u2029\u000b\t]/g, " ");
  
  // Collapse multiple spaces into one
  normalized = normalized.replace(/\s{2,}/g, " ");
  
  // Remove duplicate numbering at start (e.g., "1  1  16/03/2018" → "1 16/03/2018")
  // Pattern: starts with a number, then space, same number again
  normalized = normalized.replace(/^(\d+)\s+\1\s+/, "$1 ");
  
  return normalized.trim();
}

/**
 * Normalizes event number by extracting only the numeric value
 * Handles cases like "1  1" → "1"
 */
function normalizeEventNumber(eventNumber: number | string | undefined, fallback: number): string {
  if (eventNumber === undefined || eventNumber === null) {
    return String(fallback).padStart(2, "0");
  }
  
  const str = String(eventNumber).trim();
  // Extract first number sequence
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
  maxHeight = "max-h-64" 
}: NijaEventTimelineProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Eventos do processo (timeline completa)</p>
        <Badge variant="outline" className="text-[10px]">
          {events.length}
        </Badge>
      </div>

      <ScrollArea className={`mt-2 ${maxHeight}`}>
        <ol className="space-y-2">
          {events.map((event, idx) => {
            const eventNum = normalizeEventNumber(event.eventNumber, idx + 1);
            const normalizedDescription = normalizeTimelineText(event.description);
            const normalizedDate = event.date ? normalizeTimelineText(event.date) : null;
            const normalizedCode = event.code ? normalizeTimelineText(event.code) : null;

            return (
              <li key={idx} className="flex flex-col gap-1 p-2 rounded bg-muted/30 border-l-2 border-primary/30">
                {/* Structured display */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Evento: {eventNum}
                  </span>
                  {normalizedDate && (
                    <span className="text-xs text-muted-foreground">
                      Data: {normalizedDate}
                    </span>
                  )}
                  {normalizedCode && (
                    <Badge variant="secondary" className="text-[9px] h-4">
                      Tipo: {normalizedCode}
                    </Badge>
                  )}
                </div>
                
                {/* Description - show enrichedLabel as main, avoid duplication */}
                <p className="text-xs text-foreground leading-relaxed mt-0.5">
                  {event.enrichedLabel ? (
                    <span className="font-medium">{event.enrichedLabel}</span>
                  ) : (
                    <span>{normalizedDescription}</span>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      </ScrollArea>
    </div>
  );
}

NijaEventTimeline.displayName = "NijaEventTimeline";
