/**
 * CaseStateTimelineInline - Compact inline FSM state history with skeleton + "Recente" badge.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { History, ArrowRight, Clock } from "lucide-react";
import { format } from "date-fns";
import { getStateTimeline, type StateTimelineEntry } from "@/services/caseState";

interface CaseStateTimelineInlineProps {
  caseId: string;
  onViewAll?: () => void;
}

const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

function truncate(text: string | null, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

export function CaseStateTimelineInline({ caseId, onViewAll }: CaseStateTimelineInlineProps) {
  const [entries, setEntries] = useState<StateTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTimeline() {
      setLoading(true);
      try {
        const data = await getStateTimeline(caseId);
        setEntries(data.slice(0, 8));
      } catch (err) {
        console.error("[CaseStateTimelineInline] Error:", err);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }
    if (caseId) loadTimeline();
  }, [caseId]);

  const isRecent = entries.length > 0 && 
    (Date.now() - new Date(entries[0].changed_at).getTime()) <= FORTY_EIGHT_HOURS;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 px-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <History className="h-4 w-4 text-muted-foreground" />
            Histórico de Estados
            {isRecent && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700 border-green-200">
                Recente
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onViewAll?.()}>
            Ver tudo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <ScrollArea className="h-[180px]">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Sem transições registradas
            </p>
          ) : (
            <div className="space-y-2.5">
              {entries.map((entry) => (
                <div key={entry.history_id} className="text-xs border-l-2 border-border pl-2.5 py-0.5">
                  <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                    <Clock className="h-3 w-3" />
                    {format(new Date(entry.changed_at), "dd/MM HH:mm")}
                  </div>
                  <div className="flex items-center gap-1 font-medium">
                    <span className="text-muted-foreground">{entry.from_state_name ?? "Início"}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span>{entry.to_state_name}</span>
                  </div>
                  {entry.note && (
                    <p className="text-muted-foreground mt-0.5 leading-tight">
                      {truncate(entry.note, 120)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
