import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type TimelineItem = {
  log_id: string;
  changed_at: string;
  changed_by: string;
  changed_by_email: string | null;
  item_id: string;
  item_type: "DOCUMENT" | "GENERATED_DOC";
  old_status: string | null;
  new_status: string | null;
};

export function DocumentTimeline() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data, error } = await (supabase
        .from("vw_document_timeline" as any)
        .select("*")
        .order("changed_at", { ascending: false }) as any);

      if (!error && data) setItems(data as TimelineItem[]);

      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-muted-foreground">
          Carregando timeline...
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-muted-foreground">
          Nenhuma alteração registrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {items.map((item, index) => (
          <div key={item.log_id}>
            <div className="text-xs text-muted-foreground">
              {new Date(item.changed_at).toLocaleString("pt-BR")}
            </div>

            <div className="font-medium">
              {item.item_type === "DOCUMENT"
                ? "Documento"
                : "Documento Gerado"}{" "}
              ({item.item_id.slice(0, 8)}...)
            </div>

            <div className="text-sm">
              {item.old_status
                ? `${item.old_status} → ${item.new_status}`
                : item.new_status}
            </div>

            <div className="text-xs text-muted-foreground">
              por {item.changed_by_email ?? "usuário desconhecido"}
            </div>

            {index < items.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}