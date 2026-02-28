/**
 * CaseNotificationsFeed - Displays case notifications.
 */

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, Clock } from "lucide-react";
import {
  getNotifications,
  markNotificationRead,
  type CaseNotification,
} from "@/services/caseState";

interface CaseNotificationsFeedProps {
  caseId?: string;
  maxItems?: number;
}

export function CaseNotificationsFeed({ caseId, maxItems = 10 }: CaseNotificationsFeedProps) {
  const [notifications, setNotifications] = useState<CaseNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications(caseId, false);
      setNotifications(data.slice(0, maxItems));
    } finally {
      setLoading(false);
    }
  }, [caseId, maxItems]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkRead = async (notificationId: string) => {
    const success = await markNotificationRead(notificationId);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    }
  };

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

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notificações
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs h-5 px-1.5">
                  {unreadCount}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Alertas e avisos do processo
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma notificação encontrada.
          </p>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    notification.is_read
                      ? "bg-background border-border"
                      : "bg-primary/5 border-primary/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          notification.is_read ? "text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.body}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        {new Date(notification.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => handleMarkRead(notification.id)}
                        title="Marcar como lida"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
