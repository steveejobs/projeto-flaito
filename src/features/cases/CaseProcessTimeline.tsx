import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  Clock, 
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Scale,
  Gavel,
  FileCheck,
  Send,
  Users,
  MessageSquare,
  Calendar,
  TrendingUp,
  Info,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Json } from '@/integrations/supabase/types';

interface ProcessEvent {
  id: string;
  case_id: string;
  event_type: string;
  title: string;
  payload: Json;
  created_at: string;
}

interface CaseProcessTimelineProps {
  caseId: string;
}

// Mapeamento de códigos de evento para ícones e cores
const EVENT_ICON_MAP: Record<string, { icon: React.ElementType; className: string }> = {
  'INIC': { icon: FileText, className: 'text-blue-600 bg-blue-100' },
  'PETI': { icon: FileText, className: 'text-blue-500 bg-blue-50' },
  'DESP': { icon: Gavel, className: 'text-amber-600 bg-amber-100' },
  'DECI': { icon: Scale, className: 'text-amber-600 bg-amber-100' },
  'SENT': { icon: Scale, className: 'text-purple-600 bg-purple-100' },
  'ACOR': { icon: Scale, className: 'text-purple-700 bg-purple-100' },
  'CERT': { icon: FileCheck, className: 'text-green-600 bg-green-100' },
  'INTM': { icon: Send, className: 'text-cyan-600 bg-cyan-100' },
  'NOTI': { icon: Send, className: 'text-cyan-500 bg-cyan-50' },
  'CITA': { icon: Send, className: 'text-red-600 bg-red-100' },
  'MAND': { icon: FileText, className: 'text-orange-600 bg-orange-100' },
  'AUDI': { icon: Users, className: 'text-indigo-600 bg-indigo-100' },
  'CONT': { icon: MessageSquare, className: 'text-teal-600 bg-teal-100' },
  'REPL': { icon: MessageSquare, className: 'text-teal-500 bg-teal-50' },
  'PROC': { icon: FileCheck, className: 'text-slate-600 bg-slate-100' },
  'JUNT': { icon: FileText, className: 'text-slate-600 bg-slate-100' },
  'DOC': { icon: FileText, className: 'text-slate-500 bg-slate-50' },
  'ANEX': { icon: FileText, className: 'text-slate-500 bg-slate-50' },
  'default': { icon: Clock, className: 'text-gray-500 bg-gray-100' },
};

function getEventIcon(eventType: string, code?: string) {
  // Primeiro tentar pelo código do dicionário TJTO
  if (code) {
    const prefix = code.replace(/\d+/g, '').toUpperCase();
    if (EVENT_ICON_MAP[prefix]) return EVENT_ICON_MAP[prefix];
  }
  
  // Fallback pelo tipo de evento
  const upperType = eventType.toUpperCase();
  for (const [key, value] of Object.entries(EVENT_ICON_MAP)) {
    if (key !== 'default' && upperType.includes(key)) {
      return value;
    }
  }
  
  return EVENT_ICON_MAP.default;
}

function formatDate(dateStr: string): string {
  try {
    // Pode vir no formato DD/MM/YYYY ou ISO
    if (dateStr.includes('/')) {
      return dateStr; // Já está formatado
    }
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function CaseProcessTimeline({ caseId }: CaseProcessTimelineProps) {
  const [events, setEvents] = useState<ProcessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!caseId) return;
    
    const fetchEvents = async () => {
      setLoading(true);
      try {
        // Buscar eventos com source=NIJA_DETECTION
        const { data, error } = await supabase
          .from('case_events')
          .select('*')
          .eq('case_id', caseId)
          .order('created_at', { ascending: true }); // Ordem cronológica (primeiro ao último)

        if (error) throw error;
        
        // Filtrar apenas eventos NIJA_DETECTION
        const nijaEvents = (data || []).filter(ev => {
          if (typeof ev.payload === 'object' && ev.payload !== null) {
            return (ev.payload as Record<string, unknown>).source === 'NIJA_DETECTION';
          }
          return false;
        });
        
        setEvents(nijaEvents);
      } catch (err) {
        console.error('Erro ao carregar andamentos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [caseId]);

  // Ordenar eventos por data detectada (do payload) se disponível
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const payloadA = a.payload as Record<string, unknown> | null;
      const payloadB = b.payload as Record<string, unknown> | null;
      
      // Tentar usar detectedAt ou date do payload
      const dateA = payloadA?.detectedAt || payloadA?.date || a.created_at;
      const dateB = payloadB?.detectedAt || payloadB?.date || b.created_at;
      
      // Converter para comparação
      const parseDate = (d: unknown): Date => {
        if (!d) return new Date(0);
        const str = String(d);
        // Formato DD/MM/YYYY
        if (str.includes('/')) {
          const [day, month, year] = str.split('/').map(Number);
          return new Date(year, month - 1, day);
        }
        return new Date(str);
      };
      
      return parseDate(dateA).getTime() - parseDate(dateB).getTime();
    });
  }, [events]);

  // Calcular qualidade da extração
  const extractionQuality = useMemo(() => {
    if (events.length === 0) return { quality: "BAIXA" as const, percentage: 0, withDate: 0, total: 0 };
    
    const eventsWithDate = events.filter(e => {
      const payload = e.payload as Record<string, unknown> | null;
      const date = payload?.date as string | undefined;
      return date && !date.toLowerCase().includes("não identificado") && /\d{1,2}\/\d{1,2}\/\d{4}/.test(date);
    });
    
    const percentage = Math.round((eventsWithDate.length / events.length) * 100);
    
    let quality: "ALTA" | "MEDIA" | "BAIXA";
    if (percentage >= 70) quality = "ALTA";
    else if (percentage >= 30) quality = "MEDIA";
    else quality = "BAIXA";
    
    return { quality, percentage, withDate: eventsWithDate.length, total: events.length };
  }, [events]);

  const toggleExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Andamentos do Processo
          </CardTitle>
          <CardDescription className="text-xs">
            Carregando movimentações...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Andamentos do Processo
          </CardTitle>
          <CardDescription className="text-xs">
            Histórico de movimentações e eventos do processo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <AlertCircle className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Nenhum andamento detectado</p>
            <p className="text-xs mt-1">
              Execute uma análise NIJA com documentos do processo para detectar os andamentos automaticamente.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Andamentos do Processo
          </CardTitle>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant={extractionQuality.quality === "ALTA" ? "default" : extractionQuality.quality === "MEDIA" ? "secondary" : "outline"}
                    className={`text-[10px] cursor-help ${
                      extractionQuality.quality === "ALTA" ? "bg-green-100 text-green-800 hover:bg-green-100" :
                      extractionQuality.quality === "MEDIA" ? "bg-amber-100 text-amber-800 hover:bg-amber-100" :
                      "bg-red-50 text-red-700"
                    }`}
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {extractionQuality.quality}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <div className="text-xs space-y-1">
                    <p className="font-medium">Qualidade da Extração</p>
                    <p>{extractionQuality.withDate} de {extractionQuality.total} eventos com data identificada ({extractionQuality.percentage}%)</p>
                    {extractionQuality.quality === "BAIXA" && (
                      <p className="text-muted-foreground">Datas não foram encontradas nos documentos. Revise manualmente se necessário.</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Badge variant="secondary" className="text-xs">
              {events.length} evento{events.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
        <CardDescription className="text-xs">
          Histórico de movimentações e eventos do processo (ordem cronológica)
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="relative px-4 pb-4">
            {/* Linha vertical da timeline */}
            <div className="absolute left-7 top-0 bottom-4 w-px bg-border" />
            
            {sortedEvents.map((event, index) => {
              const payload = event.payload as Record<string, unknown> | null;
              const code = payload?.code as string | undefined;
              const enrichedLabel = payload?.enrichedLabel as string | undefined;
              const eventDate = payload?.date as string | undefined;
              const fullDescription = payload?.fullDescription as string | undefined;
              const eventNumber = payload?.eventNumber as number | undefined;
              const isDateMissing = !eventDate || eventDate.toLowerCase().includes("não identificado");
              
              const iconConfig = getEventIcon(event.event_type, code);
              const Icon = iconConfig.icon;
              const isExpanded = expandedEvents.has(event.id);
              const hasDetails = fullDescription && fullDescription !== event.title;
              
              return (
                <div key={event.id} className="relative flex gap-3 py-2">
                  {/* Ícone do evento */}
                  <div className={`
                    z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-background
                    ${iconConfig.className}
                  `}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  
                  {/* Conteúdo do evento */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Número do evento + Data */}
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          {eventNumber && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              #{eventNumber}
                            </Badge>
                          )}
                          {isDateMissing ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-[10px] text-muted-foreground/60 italic flex items-center gap-0.5 cursor-help">
                                    <Info className="h-2.5 w-2.5" />
                                    data não identificada
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  A data deste evento não foi encontrada no documento.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {formatDate(eventDate)}
                            </span>
                          )}
                          {code && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-mono">
                              {code}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Título do evento */}
                        <p className="text-sm font-medium text-foreground leading-tight">
                          {enrichedLabel || event.title}
                        </p>
                        
                        {/* Descrição expandível */}
                        {hasDetails && (
                          <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(event.id)}>
                            <CollapsibleTrigger className="flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                              {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded p-2 whitespace-pre-wrap">
                                {fullDescription}
                              </p>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
