import { useEffect, useState, useCallback, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LexosTimelineItem = {
  log_id: string;
  kind: "CASE" | "DOCUMENT" | "GENERATED_DOC" | "CASE_STAGE" | "CLIENT";
  item_type: "CASE" | "DOCUMENT" | "GENERATED_DOC" | "CASE_STAGE" | "CLIENT";
  client_id: string | null;
  case_id: string | null;
  case_title: string | null;
  document_id: string | null;
  generated_doc_id: string | null;
  old_status: string | null;
  new_status: string | null;
  changed_at: string;
  changed_by: string | null;
  changed_by_email: string | null;
};

type LexosTimelineProps = {
  caseId?: string;
  clientId?: string;
  limit?: number;
  showFilters?: boolean;
  compact?: boolean;
};

export const LexosTimeline = forwardRef<HTMLDivElement, LexosTimelineProps>(
  function LexosTimeline(
    { caseId, clientId, limit, showFilters = true, compact = false },
    ref
  ) {
  const [items, setItems] = useState<LexosTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [kindFilter, setKindFilter] =
    useState<"ALL" | "CASE" | "CASE_STAGE" | "DOCUMENT" | "GENERATED_DOC" | "CLIENT">(
      "ALL"
    );
  const [emailFilter, setEmailFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("vw_lexos_timeline_plus" as any)
      .select("*")
      .order("changed_at", { ascending: false });

    if (clientId) {
      query = query.eq("client_id", clientId as any);
    }

    if (caseId) {
      query = query.eq("case_id", caseId as any);
    }

    if (kindFilter !== "ALL") {
      query = query.eq("kind", kindFilter as any);
    }

    if (emailFilter.trim()) {
      query = query.ilike(
        "changed_by_email",
        `%${emailFilter.trim()}%` as any
      );
    }

    if (dateFrom) {
      query = query.gte("changed_at", `${dateFrom} 00:00:00` as any);
    }

    if (dateTo) {
      query = query.lte("changed_at", `${dateTo} 23:59:59` as any);
    }

    if (limit && limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = (await query) as any;

    if (!error && data) {
      setItems(data as LexosTimelineItem[]);
    }

    setLoading(false);
  }, [clientId, caseId, kindFilter, emailFilter, dateFrom, dateTo, limit]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("lexos_timeline_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "case_status_logs" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "case_stage_logs" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "document_status_logs" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Carregando timeline...
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Nenhum evento registrado.
        </CardContent>
      </Card>
    );
  }

  const kindLabel = (kind: LexosTimelineItem["kind"]) => {
    if (kind === "CASE") return "Caso";
    if (kind === "CASE_STAGE") return "Fase";
    if (kind === "DOCUMENT") return "Doc";
    if (kind === "CLIENT") return "Cliente";
    return "Gerado";
  };

  const kindDotColor = (kind: LexosTimelineItem["kind"]) => {
    switch (kind) {
      case "CASE":
        return "bg-blue-500";
      case "CASE_STAGE":
        return "bg-purple-500";
      case "DOCUMENT":
        return "bg-green-500";
      case "GENERATED_DOC":
        return "bg-amber-500";
      case "CLIENT":
        return "bg-muted-foreground";
      default:
        return "bg-primary";
    }
  };

  const formatUserDisplay = (email: string | null) => {
    if (!email) return "Sistema";
    const atIndex = email.indexOf("@");
    if (atIndex > 0) {
      return email.substring(0, atIndex);
    }
    return email;
  };

  return (
    <div ref={ref} className="contents">
      <Card>
        <CardContent className={compact ? "p-2" : "p-4"}>
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <Select
                value={kindFilter}
                onValueChange={(v) => setKindFilter(v as any)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="CASE">Caso</SelectItem>
                  <SelectItem value="CASE_STAGE">Fases</SelectItem>
                  <SelectItem value="DOCUMENT">Documentos</SelectItem>
                  <SelectItem value="GENERATED_DOC">Gerados</SelectItem>
                  <SelectItem value="CLIENT">Cliente</SelectItem>
                </SelectContent>
              </Select>

              <Input
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                placeholder="Filtrar e-mail"
                className="h-8 text-xs"
              />

              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-xs"
              />

              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          )}

          <div className="divide-y divide-border/50">
            {items.map((item) => (
              <div key={item.log_id} className="py-2 first:pt-0 last:pb-0">
                <div className="flex items-start gap-2">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${kindDotColor(item.kind)}`} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {new Date(item.changed_at).toLocaleDateString("pt-BR", { 
                          day: "2-digit", 
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        [{kindLabel(item.kind)}]
                      </span>
                      <span className="text-sm truncate">
                        {item.old_status
                          ? `${item.old_status} → ${item.new_status}`
                          : item.new_status}
                      </span>
                    </div>
                    
                    {item.case_title && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.case_title}
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground/70 mt-0.5">
                      por {formatUserDisplay(item.changed_by_email)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

LexosTimeline.displayName = "LexosTimeline";
