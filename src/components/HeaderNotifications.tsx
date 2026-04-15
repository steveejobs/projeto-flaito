/**
 * HeaderNotifications - Bell icon with dropdown for in-app notifications
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Info, AlertTriangle, AlertCircle, CheckCheck, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  severity: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
  kind: string | null;
  source_table: string | null;
  source_id: string | null;
}

interface HeaderNotificationsProps {
  officeId: string | null;
}

const SEVERITY_CONFIG = {
  INFO: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  WARN: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
  ALERT: {
    icon: AlertCircle,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-900/20",
  },
};

export function HeaderNotifications({ officeId }: HeaderNotificationsProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const loadNotifications = useCallback(async () => {
    if (!officeId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_notifications", {
        p_office_id: officeId,
        p_only_unread: true,
        p_limit: 20,
        p_offset: 0,
      });

      if (error) throw error;
      setNotifications((data as unknown as Notification[]) || []);
    } catch (err) {
      console.error("[HeaderNotifications] Error loading:", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [officeId]);

  // Load when popover opens
  useEffect(() => {
    if (open && officeId) {
      loadNotifications();
    }
  }, [open, officeId, loadNotifications]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    try {
      await supabase.rpc("mark_notification_read", {
        p_id: notification.id,
      });
    } catch (err) {
      console.error("[HeaderNotifications] Error marking read:", err);
    }

    // Update local state
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n
      )
    );

    // Navigate if href exists
    if (notification.href) {
      setOpen(false);
      navigate(notification.href);
    }
  };

  const handleMarkAllRead = async () => {
    if (!officeId) return;
    
    setMarkingAll(true);
    try {
      await supabase.rpc("mark_all_notifications_read", {
        p_office_id: officeId,
      });
      
      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
      );
    } catch (err) {
      console.error("[HeaderNotifications] Error marking all read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return "";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Sem notificações</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const severity = (notification.severity || 'INFO') as keyof typeof SEVERITY_CONFIG;
                const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.INFO;
                const Icon = config.icon;
                const isUnread = !notification.read_at;

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                      isUnread ? "bg-muted/30" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <div
                        className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${config.bg}`}
                      >
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm line-clamp-1 ${
                              isUnread ? "font-medium" : "text-muted-foreground"
                            }`}
                          >
                            {notification.title}
                          </p>
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        {notification.body && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {notification.body}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
