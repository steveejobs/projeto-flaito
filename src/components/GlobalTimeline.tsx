import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
    Stethoscope, 
    Gavel, 
    MessageSquare, 
    Eye, 
    FileText, 
    Calendar,
    Clock,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { timelineService, UnifiedEvent } from '@/services/timelineService';
import { useActiveClient } from '@/contexts/ActiveClientContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const EventIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'consulta': return <Stethoscope className="w-5 h-5 text-teal-600" />;
        case 'processo': return <Gavel className="w-5 h-5 text-amber-600" />;
        case 'whatsapp': return <MessageSquare className="w-5 h-5 text-emerald-600" />;
        case 'analise_iris': return <Eye className="w-5 h-5 text-blue-600" />;
        case 'laudo': return <FileText className="w-5 h-5 text-rose-600" />;
        default: return <Calendar className="w-5 h-5 text-gray-600" />;
    }
};

const ModuleBadge = ({ module }: { module: string }) => {
    switch (module) {
        case 'medical': return <Badge variant="secondary" className="bg-teal-50 text-teal-700 border-teal-100">Saúde</Badge>;
        case 'legal': return <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100">Jurídico</Badge>;
        case 'comm': return <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100">Comunicação</Badge>;
        default: return <Badge variant="outline">Sistema</Badge>;
    }
};

export const GlobalTimeline: React.FC = () => {
    const { activeClientId } = useActiveClient();
    const [events, setEvents] = useState<UnifiedEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            if (!activeClientId) return;
            setLoading(true);
            try {
                const data = await timelineService.getClientTimeline(activeClientId);
                setEvents(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, [activeClientId]);

    if (!activeClientId) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl border-gray-100 bg-gray-50/50">
                <AlertCircle className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900">Nenhum cliente selecionado</h3>
                <p className="text-sm text-gray-500 max-w-xs">Selecione um cliente ou paciente para visualizar o histórico unificado.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4 p-4 border rounded-xl animate-pulse">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-4 w-full" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50/50 rounded-xl border border-gray-100">
                <Calendar className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-gray-500">Nenhum evento registrado para este cliente.</p>
            </div>
        );
    }

    return (
        <div className="relative pl-6 before:absolute before:left-[19px] before:top-2 before:bottom-0 before:w-px before:bg-gray-200">
            <div className="space-y-8">
                {events.map((event, index) => (
                    <div key={event.id} className="relative group animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
                        {/* Dot */}
                        <div className={cn(
                            "absolute -left-[31px] top-1.5 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center z-10 shadow-sm",
                            event.module === 'medical' ? "bg-teal-100" : 
                            event.module === 'legal' ? "bg-amber-100" : 
                            "bg-emerald-100"
                        )}>
                            <div className={cn(
                                "w-2 h-2 rounded-full",
                                event.module === 'medical' ? "bg-teal-600" : 
                                event.module === 'legal' ? "bg-amber-600" : 
                                "bg-emerald-600"
                            )} />
                        </div>

                        {/* Card */}
                        <Card className="hover:shadow-md transition-all duration-300 border-gray-100/80 overflow-hidden">
                            <CardContent className="p-0">
                                <div className="p-4 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                            <EventIcon type={event.event_type} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-slate-800 leading-tight">
                                                    {event.title}
                                                </h4>
                                                <ModuleBadge module={event.module} />
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-medium tracking-wide">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {format(new Date(event.event_date), "HH:mm")}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {format(new Date(event.event_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge 
                                            variant="outline" 
                                            className={cn(
                                                "text-[10px] uppercase font-bold tracking-tighter",
                                                event.status === 'realizada' || event.status === 'SENT' || event.status === 'signed' ? "text-emerald-700 bg-emerald-50 border-emerald-100" :
                                                event.status === 'agendada' || event.status === 'PENDING' ? "text-amber-700 bg-amber-50 border-amber-100" :
                                                "text-slate-600 bg-slate-50 border-slate-100"
                                            )}
                                        >
                                            {event.status}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="p-4 bg-white">
                                    {event.event_type === 'whatsapp' && (
                                        <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100/50 relative">
                                            <p className="text-sm text-emerald-900 leading-relaxed italic">
                                                "{event.metadata.resource_type === 'CONSULTA' ? 'Aviso de Consulta: ' : ''}{event.title.replace('Mensagem WhatsApp: ', '')}"
                                            </p>
                                            <div className="mt-2 flex items-center justify-end">
                                               <span className="text-[10px] text-emerald-600 font-semibold opacity-60">Mensagem via Robô</span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {event.event_type === 'consulta' && (
                                        <div className="space-y-2">
                                            {event.metadata.sintomas && (
                                                <p className="text-sm text-slate-600 line-clamp-2">
                                                    <span className="font-semibold text-teal-700">Sintomas:</span> {event.metadata.sintomas}
                                                </p>
                                            )}
                                            <div className="flex gap-2">
                                                <Badge variant="outline" className="text-[10px] border-teal-100 text-teal-600">ID Profissional: {event.metadata.profissional_id?.slice(0,8)}</Badge>
                                            </div>
                                        </div>
                                    )}

                                    {event.event_type === 'processo' && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-600">
                                                <span className="font-semibold text-amber-700">CNJ:</span> {event.metadata.cnj_number || 'Não informado'}
                                            </p>
                                            <div className="flex gap-2">
                                                <Badge variant="outline" className="text-[10px] border-amber-100 text-amber-600 uppercase">{event.metadata.area}</Badge>
                                                <Badge variant="outline" className="text-[10px] border-amber-100 text-amber-600 uppercase">{event.metadata.side}</Badge>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ))}
            </div>
        </div>
    );
};
