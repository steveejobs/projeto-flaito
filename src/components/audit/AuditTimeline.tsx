import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CheckCircle2, AlertCircle, Clock, Database, 
  Cpu, Mic, Shield, User, Info, ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimelineEvent {
  event_time: string;
  category: string;
  event_type: string;
  title: string;
  details: any;
  importance: number;
}

interface AuditTimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'lifecycle': return <Activity className="h-4 w-4" />;
    case 'processing': return <Cpu className="h-4 w-4" />;
    case 'ai_legal': 
    case 'ai_medical': return <Zap className="h-4 w-4" />;
    case 'human_review': return <Shield className="h-4 w-4" />;
    case 'voice': return <Mic className="h-4 w-4" />;
    default: return <Info className="h-4 w-4" />;
  }
};

const getImportanceStyles = (importance: number) => {
  if (importance >= 3) return "bg-red-500/10 border-red-500/20 text-red-500";
  if (importance === 2) return "bg-primary/5 border-primary/10 text-primary";
  return "bg-muted/30 border-muted/20 text-muted-foreground";
};

import { Zap, Activity } from 'lucide-react';

export const AuditTimeline = ({ events, loading }: AuditTimelineProps) => {
  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted/50 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-sm font-medium">Nenhum evento registrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-1">
      {/* Linha vertical conectora */}
      <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-border/40" />

      {events.map((event, idx) => (
        <div key={idx} className="relative pl-12 pb-6 group">
          {/* Ponto / Ícone */}
          <div className={cn(
            "absolute left-0 top-1 p-2 rounded-full border z-10 transition-transform group-hover:scale-110",
            getImportanceStyles(event.importance)
          )}>
            {getCategoryIcon(event.category)}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground tabular-nums">
                {format(new Date(event.event_time), 'HH:mm:ss', { locale: ptBR })}
              </span>
              <span className="text-[10px] py-0.5 px-1.5 rounded-full bg-muted font-bold text-muted-foreground uppercase">
                {event.category}
              </span>
            </div>

            <h4 className="text-sm font-bold text-foreground/90 leading-tight">
              {event.title}
            </h4>

            {event.details && (
              <div className="mt-1 p-2 rounded-lg bg-muted/30 border border-border/50 text-[11px] leading-relaxed text-muted-foreground">
                {event.details.error && (
                  <p className="text-red-500 font-bold mb-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {event.details.error}
                  </p>
                )}
                {event.details.intent && (
                  <p className="font-semibold text-foreground/70">
                    Ação: {event.details.intent} (Confiança: {Math.round(event.details.confidence * 100)}%)
                  </p>
                )}
                {event.details.notes && (
                  <p className="italic">"{event.details.notes}"</p>
                )}
                {/* Visualizador simplificado de metadados se necessário */}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
