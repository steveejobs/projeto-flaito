import React from "react";
import { useTimeline, TimelineEvent } from "@/hooks/useTimeline";
import { 
  Briefcase, 
  Stethoscope, 
  MessageSquare, 
  FileText, 
  Eye, 
  Clock,
  ChevronRight,
  AlertCircle,
  Brain,
  Zap,
  ShieldCheck,
  Search,
  Target,
  Scale,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface UnifiedTimelineProps {
  clientId: string;
}

const MODULE_CONFIG = {
  medical: {
    icon: Stethoscope,
    color: "text-teal-600 bg-teal-50 dark:bg-teal-950/30 dark:text-teal-400",
    label: "Saúde"
  },
  legal: {
    icon: Briefcase,
    color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
    label: "Jurídico"
  },
  comm: {
    icon: MessageSquare,
    color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400",
    label: "Comunicação"
  }
};

const EVENT_TYPE_ICONS: Record<string, any> = {
  consulta: Stethoscope,
  processo: Briefcase,
  whatsapp: MessageSquare,
  analise_iris: Eye,
  laudo: FileText,
  "nija-maestro-start": Brain,
  "nija-maestro-piece-gen": Zap,
  "nija-maestro-review": ShieldCheck,
  "nija-maestro-judge": Scale,
  "nija-maestro-complete": CheckCircle2,
  "nija-dossier": Search,
  "nija-strategy": Target
};

export const UnifiedTimeline: React.FC<UnifiedTimelineProps> = ({ clientId }) => {
  const { events, isLoading, error } = useTimeline(clientId);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Carregando histórico unificado...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-lg">
        <AlertCircle className="h-5 w-5" />
        <p className="text-sm font-medium">Erro ao carregar timeline: {error.message}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Clock className="h-6 w-6 text-muted-foreground opacity-40" />
        </div>
        <h3 className="text-lg font-medium">Nenhum evento registrado</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Ainda não há registros de consultas, processos ou mensagens para este cliente.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent dark:before:via-slate-800">
        {events.map((event, idx) => {
          const config = MODULE_CONFIG[event.module] || MODULE_CONFIG.comm;
          const Icon = EVENT_TYPE_ICONS[event.event_type] || FileText;
          const date = new Date(event.event_date);

          return (
            <div key={event.id} className="relative flex items-start gap-6 group">
              {/* Dot Icon */}
              <div className={cn(
                "absolute left-0 flex h-10 w-10 items-center justify-center rounded-full ring-4 ring-background z-10 transition-transform group-hover:scale-110 shadow-sm",
                event.event_type.startsWith('nija-maestro') 
                  ? "text-purple-600 bg-purple-100 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200" 
                  : config.color
              )}>
                <Icon className="h-5 w-5" />
              </div>

              {/* Content Card */}
              <div className="flex-1 ml-12 pt-0.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold capitalize tracking-tight group-hover:text-primary transition-colors">
                      {event.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tighter h-5 px-1.5 bg-muted/30">
                      {config.label}
                    </Badge>
                  </div>
                  <time className="text-[11px] font-medium text-muted-foreground tabular-nums flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(date, "d MMM yyyy 'às' HH:mm", { locale: ptBR })}
                  </time>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-card/50 hover:bg-card hover:shadow-sm transition-all cursor-pointer group/card border-slate-100 dark:border-slate-800">
                   <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {event.status ? `Status: ${event.status}` : 'Evento registrado no sistema'}
                      </span>
                      {/* Metadata quick preview */}
                      {event.metadata && (
                        <div className="flex gap-2 mt-1">
                          {Object.entries(event.metadata).slice(0, 2).map(([key, val]: [string, any]) => (
                            <span key={key} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                              {key}: {String(val)}
                            </span>
                          ))}
                        </div>
                      )}
                   </div>
                   <ChevronRight className="h-4 w-4 text-muted-foreground opacity-30 group-hover/card:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};
