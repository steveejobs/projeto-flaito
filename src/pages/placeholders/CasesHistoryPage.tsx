import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getAllStates, type CaseState } from "@/services/caseState";
import { Clock, History } from "lucide-react";

type RawHistoryRow = {
  id: string;
  case_id: string;
  office_id: string;
  from_state_id: string | null;
  to_state_id: string;
  changed_at: string;
  changed_by: string | null;
  note: string | null;
  cases?: { id: string; title: string; cnj_number: string | null } | null;
};

export default function CasesHistoryPage() {
  const officeId = sessionStorage.getItem("lexos_office_id");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RawHistoryRow[]>([]);
  const [states, setStates] = useState<CaseState[]>([]);

  const statesMap = useMemo(() => {
    const map: Record<string, CaseState> = {};
    states.forEach((s) => (map[s.id] = s));
    return map;
  }, [states]);

  const load = useCallback(async () => {
    if (!officeId) {
      setRows([]);
      setStates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [statesData, historyRes] = await Promise.all([
        getAllStates(),
        supabase
          .from("lexos_case_state_history" as any)
          .select(
            "id, case_id, office_id, from_state_id, to_state_id, changed_at, changed_by, note, cases:cases(id, title, cnj_number)"
          )
          .eq("office_id", officeId)
          .order("changed_at", { ascending: false })
          .limit(200),
      ]);

      setStates(statesData);
      if (historyRes.error) {
        console.error("[casesHistory] Error fetching history:", historyRes.error);
        setRows([]);
        return;
      }

      setRows((historyRes.data || []) as unknown as RawHistoryRow[]);
    } finally {
      setLoading(false);
    }
  }, [officeId]);

  useEffect(() => {
    load();
  }, [load]);

  const empty = !loading && rows.length === 0;

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Casos
          </CardTitle>
          <CardDescription>
            Registro de mudanças de estado (workflow) no seu escritório
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          ) : empty ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há transições registradas. Abra um caso e altere o estado em
              “Selecione o estado”.
            </p>
          ) : (
            <ScrollArea className="h-[520px]">
              <div className="space-y-4">
                {rows.map((r, idx) => {
                  const fromName = r.from_state_id ? statesMap[r.from_state_id]?.name : null;
                  const toName = statesMap[r.to_state_id]?.name;
                  const cnj = r.cases?.cnj_number;
                  const title = r.cases?.title;

                  return (
                    <div key={r.id} className="space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="text-sm font-medium truncate">
                            {cnj ? `${cnj} — ` : ""}
                            {title ?? r.case_id}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {fromName ? (
                              <Badge variant="outline" className="text-xs">
                                {fromName}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                (sem estado anterior)
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">→</span>
                            <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                              {toName ?? r.to_state_id}
                            </Badge>
                          </div>

                          {r.note ? (
                            <div className="text-xs text-muted-foreground">
                              {r.note}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                          <Clock className="h-3 w-3" />
                          {new Date(r.changed_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>

                      {idx < rows.length - 1 ? <Separator /> : null}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
