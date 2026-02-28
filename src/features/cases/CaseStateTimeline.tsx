/**
 * CaseStateTimeline - Displays FSM state history for a case.
 */

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, Clock, MessageSquare, User } from "lucide-react";
import { getStateTimeline, type StateTimelineEntry } from "@/services/caseState";

interface CaseStateTimelineProps {
  caseId: string;
}

export function CaseStateTimeline({ caseId }: CaseStateTimelineProps) {
  const [entries, setEntries] = useState<StateTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStateTimeline(caseId);
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timeline de Estados
          </CardTitle>
          <CardDescription>
            Histórico de transições de estado do processo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma transição de estado registrada.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Timeline de Estados
        </CardTitle>
        <CardDescription>
          Histórico de transições de estado do processo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <div
                key={entry.history_id}
                className={`relative pl-4 pb-3 ${
                  index < entries.length - 1 ? "border-l-2 border-border" : ""
                }`}
              >
                {/* Timeline dot */}
                <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-full bg-primary" />

                <div className="space-y-1">
                  {/* State transition */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.from_state_name && (
                      <>
                        <Badge variant="outline" className="text-xs">
                          {entry.from_state_name}
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </>
                    )}
                    <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                      {entry.to_state_name}
                    </Badge>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(entry.changed_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>

                  {/* Note if exists */}
                  {entry.note && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-1">
                      <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{entry.note}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
