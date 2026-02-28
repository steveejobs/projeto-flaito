/**
 * CaseNotificationsInline - Compact inline alerts with skeleton + "Marcar como lidas".
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Clock, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { getNotifications, type CaseNotification } from "@/services/caseState";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CaseNotificationsInlineProps {
  caseId: string;
  onViewAll?: () => void;
}

function truncate(text: string | null, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

export function CaseNotificationsInline({ caseId, onViewAll }: CaseNotificationsInlineProps) {
  const [notifications, setNotifications] = useState<CaseNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications(caseId, false);
      setNotifications(data.slice(0, 8));
    } catch (err) {
      console.error("[CaseNotificationsInline] Error:", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (caseId) loadNotifications();
  }, [caseId, loadNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  async function handleMarkAllRead() {
    if (unreadCount === 0) return;
    setMarkingRead(true);
    try {
      await supabase
        .from("lexos_case_notifications" as any)
        .update({ is_read: true })
        .eq("case_id", caseId)
        .eq("is_read", false);

      toast.success("Alertas marcados como lidos");
      await loadNotifications();
    } catch (err) {
      console.error("[CaseNotificationsInline] Mark read error:", err);
      toast.error("Erro ao marcar alertas como lidos");
    } finally {
      setMarkingRead(false);
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 px-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Alertas do Caso
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleMarkAllRead}
                disabled={markingRead}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Ler
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onViewAll?.()}>
              Ver tudo
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <ScrollArea className="h-[180px]">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Sem alertas
            </p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`text-xs rounded p-2 ${
                    !n.is_read ? "bg-accent/40 border-l-2 border-primary" : "border-l-2 border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-medium leading-tight">{n.title}</span>
                    <span className="text-muted-foreground text-[10px] flex items-center gap-0.5 whitespace-nowrap">
                      <Clock className="h-2.5 w-2.5" />
                      {format(new Date(n.created_at), "dd/MM HH:mm")}
                    </span>
                  </div>
                  {n.body && (
                    <p className="text-muted-foreground leading-tight">
                      {truncate(n.body, 120)}
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
