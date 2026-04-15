import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Users,
    Stethoscope,
    Calendar,
    Activity,
    Mic,
    Brain,
    BookOpen,
    ArrowRight,
    Sparkles,
    Bot,
    Clock,
    HeartPulse,
    ClipboardList,
    Pill,
    Eye,
    Leaf,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/dashboard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeSession } from "@/hooks/useOfficeSession";
import { format } from "date-fns";

interface Appointment {
    id: string;
    patient: string;
    time: string;
    type: string;
    status: string | null;
}

interface BioStats {
    totalAnalises: number;
    protocolosAtivos: number;
}

const MedicalDashboard = () => {
    const navigate = useNavigate();

    const quickModules = [
        {
            title: 'Pacientes',
            description: 'Cadastro, prontuários e acompanhamento clínico.',
            icon: Users,
            url: '/medical/patients',
            gradient: 'from-blue-500/10 to-cyan-500/10',
            iconColor: 'text-blue-500',
            bgIcon: 'bg-blue-50'
        },
        {
            title: 'Transcrição Clínica',
            description: 'Upload de áudio e transcrição estruturada de consultas.',
            icon: Mic,
            url: '/medical/transcricao',
            gradient: 'from-violet-500/10 to-purple-500/10',
            iconColor: 'text-violet-500',
            bgIcon: 'bg-violet-50'
        },
        {
            title: 'Análise Clínica',
            description: 'Motor multidisciplinar — Nutrição, Integrativa, Neuro.',
            icon: Brain,
            url: '/medical/analise',
            gradient: 'from-emerald-500/10 to-teal-500/10',
            iconColor: 'text-emerald-500',
            bgIcon: 'bg-emerald-50'
        },
        {
            title: 'Protocolos',
            description: 'Biblioteca de protocolos clínicos com evidência científica.',
            icon: BookOpen,
            url: '/medical/protocolos',
            gradient: 'from-blue-500/10 to-indigo-500/10',
            iconColor: 'text-indigo-500',
            bgIcon: 'bg-indigo-50'
        },
        {
            title: 'Iridologia IA',
            description: 'Análise de íris por IA e correlação bio-orgânica.',
            icon: Eye,
            url: '/medical/iridologia',
            gradient: 'from-emerald-500/10 to-amber-500/10',
            iconColor: 'text-emerald-600',
            bgIcon: 'bg-emerald-50'
        },
    ];

    const { user } = useAuth();
    const { officeId } = useOfficeSession(user?.id);
    const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
    const [bioStats, setBioStats] = useState<BioStats>({ totalAnalises: 0, protocolosAtivos: 0 });
    const [isLoading, setIsLoading] = useState(true);

    const smartAlerts: { id: string; patient: string; title: string; icon: any; color: string; bg: string }[] = [];

    useEffect(() => {
        if (!officeId) return;

        const fetchTodayAgenda = async () => {
            setIsLoading(true);
            try {
                const now = new Date();
                const startOfDay = new Date(now);
                startOfDay.setHours(0, 0, 0, 0);

                const endOfDay = new Date(now);
                endOfDay.setHours(23, 59, 59, 999);

                const [agendaRes, bioRes, protRes] = await Promise.all([
                    (supabase.from('agenda_medica' as any) as any)
                        .select('*, pacientes(nome)')
                        .eq('office_id', officeId)
                        .gte('data_hora', startOfDay.toISOString())
                        .lte('data_hora', endOfDay.toISOString())
                        .order('data_hora', { ascending: true }),
                    supabase.from('iris_analyses').select('id', { count: 'exact' }).eq('office_id', officeId),
                    supabase.from('protocolos_terapeuticos').select('id', { count: 'exact' }).eq('office_id', officeId)
                ]);

                if (agendaRes.data) {
                    const mapped: Appointment[] = agendaRes.data.map((item) => {
                        const paciente = item.pacientes as { nome: string } | null;
                        return {
                            id: item.id,
                            patient: paciente?.nome || item.paciente_nome || "Paciente não identificado",
                            time: format(new Date(item.data_hora), "HH:mm"),
                            type: item.tipo_consulta === 'primeira_vez' ? 'Primeira Vez' :
                                item.tipo_consulta === 'retorno' ? 'Retorno' :
                                    item.tipo_consulta === 'procedimento' ? 'Procedimento' : 'Consulta',
                            status: item.status
                        };
                    });
                    setTodayAppointments(mapped);
                }
                
                setBioStats({
                    totalAnalises: bioRes.count || 0,
                    protocolosAtivos: protRes.count || 0
                });
            } catch (error) {
                console.error("Erro ao buscar dados do dashboard:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTodayAgenda();
    }, [officeId]);

    return (
        <div className="p-2 md:p-3 lg:p-4 space-y-3 dashboard-fade-in max-w-[1400px] mx-auto min-h-screen bg-background text-foreground selection:bg-teal-500/30">
            {/* 1. Dashboard Header */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both" style={{ animationDelay: '50ms' }}>
                <DashboardHeader type="MEDICAL" />
            </section>

            {/* Focus / Next Critical Step - Clean Bento Style */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both" style={{ animationDelay: '100ms' }}>
                <Card className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md group p-4 md:p-5">
                    <div className="relative z-10 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="flex h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                                <span className="text-[9px] font-bold text-teal-600 uppercase tracking-[0.2em]">Consultório Ativo</span>
                            </div>
                            <h2 className="text-lg md:text-xl font-extrabold text-foreground tracking-tight leading-tight max-w-xl">
                                Bom dia, Dr. <br />
                                <span className="text-muted-foreground font-medium">
                                    {isLoading ? 'Carregando agenda...' :
                                        todayAppointments.length === 0 ? 'Você não tem pacientes agendados para hoje.' :
                                            `Você tem ${todayAppointments.length} paciente${todayAppointments.length > 1 ? 's' : ''} agendado${todayAppointments.length > 1 ? 's' : ''} para hoje.`}
                                </span>
                            </h2>
                        </div>

                        <div className="flex-shrink-0">
                            <Button
                                className="flex items-center justify-center gap-1.5 h-9 px-5 rounded-xl text-xs font-bold shadow-sm bg-teal-600 hover:bg-teal-700 transition-all hover:scale-[1.02] active:scale-[0.98] text-white"
                                onClick={() => navigate('/medical/patients')}
                            >
                                <Calendar className="w-4 h-4" />
                                Ver Agenda Diária
                            </Button>
                        </div>
                    </div>
                </Card>
            </section>

            {/* 2. KPI Grid (Clean Metrics) */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both" style={{ animationDelay: '150ms' }}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card className="p-4 flex items-center gap-3 bg-card rounded-2xl border border-border/60 shadow-sm transition-all hover:shadow-md hover:border-blue-200 group">
                        <div className="p-2.5 bg-blue-50/50 rounded-xl group-hover:scale-110 group-hover:bg-blue-100/50 transition-all">
                            <Users className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Pacientes Hoje</p>
                            <h3 className="text-xl font-black text-foreground tracking-tight">{todayAppointments.length}</h3>
                        </div>
                    </Card>

                    <Card className="p-4 flex items-center gap-3 bg-white rounded-2xl border border-slate-200/60 shadow-sm transition-all hover:shadow-md hover:border-teal-200 group">
                        <div className="p-2.5 bg-teal-50 rounded-xl group-hover:scale-110 group-hover:bg-teal-100 transition-all">
                            <Stethoscope className="w-5 h-5 text-teal-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Consultas Mês</p>
                            <h3 className="text-xl font-black text-slate-700 tracking-tight">-</h3>
                        </div>
                    </Card>

                    <Card className="p-4 flex items-center gap-3 bg-white rounded-2xl border border-slate-200/60 shadow-sm transition-all hover:shadow-md hover:border-violet-200 group">
                        <div className="p-2.5 bg-violet-50 rounded-xl group-hover:scale-110 group-hover:bg-violet-100 transition-all">
                            <Mic className="w-5 h-5 text-violet-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Transcrições</p>
                            <h3 className="text-xl font-black text-slate-700 tracking-tight">-</h3>
                        </div>
                    </Card>

                    <Card className="p-4 flex items-center gap-3 bg-white rounded-2xl border border-slate-200/60 shadow-sm transition-all hover:shadow-md hover:border-emerald-200 group">
                        <div className="p-2.5 bg-emerald-50 rounded-xl group-hover:scale-110 group-hover:bg-emerald-100 transition-all">
                            <Leaf className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Bio-Saúde / Íris</p>
                            <h3 className="text-xl font-black text-slate-700 tracking-tight">{bioStats.totalAnalises}</h3>
                        </div>
                    </Card>
                </div>
            </section>

            {/* Bento Grid Layout - Medical Focus */}
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {/* Agenda Hoje */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both md:col-span-1 xl:col-span-1 flex flex-col" style={{ animationDelay: '250ms' }}>
                    <Card className="flex-1 p-5 bg-card border border-border/60 shadow-sm rounded-2xl flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-teal-600" />
                                Agenda Hoje
                            </h3>
                            <span className="text-xs font-semibold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full border border-border/50">{todayAppointments.length} Pacientes</span>
                        </div>
                        <div className="space-y-3 flex-1 flex flex-col justify-center">
                            {todayAppointments.length > 0 ? todayAppointments.map((apt) => (
                                <div key={apt.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all cursor-pointer">
                                    <div className="min-w-[48px] text-center">
                                        <p className="text-sm font-black text-foreground">{apt.time}</p>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-foreground">{apt.patient}</p>
                                        <p className="text-xs text-muted-foreground font-medium">{apt.type}</p>
                                    </div>
                                    <div>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md 
                                            ${apt.status === 'agendado' ? 'bg-blue-50 text-blue-600' :
                                                apt.status === 'espera' ? 'bg-amber-50 text-amber-600' :
                                                    apt.status === 'em_atendimento' ? 'bg-emerald-50 text-emerald-600' :
                                                        apt.status === 'finalizado' ? 'bg-slate-100 text-slate-600' :
                                                            'bg-slate-50 text-slate-600'}`}>
                                            {apt.status}
                                        </span>
                                    </div>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center justify-center p-6 text-center">
                                    <div className="p-3 bg-slate-50 rounded-full mb-3">
                                        <Calendar className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <p className="text-sm font-semibold text-slate-600 mb-1">Nenhum paciente hoje</p>
                                    <p className="text-xs text-slate-400 max-w-[200px]">Você não possui consultas agendadas para o dia de hoje.</p>
                                </div>
                            )}
                        </div>
                        <Button variant="ghost" className="w-full mt-2 text-xs font-bold text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-xl" onClick={() => navigate('/medical/agenda')}>
                            Ver Agenda Completa <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                    </Card>
                </section>

                {/* Alertas Médicos Inteligentes */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both md:col-span-1 xl:col-span-1 flex flex-col" style={{ animationDelay: '350ms' }}>
                    <Card className="flex-1 p-5 bg-white border border-slate-200/60 shadow-sm rounded-2xl flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500" />
                                Alertas Inteligentes
                            </h3>
                        </div>
                        <div className="space-y-3 flex-1 flex flex-col justify-center">
                            {smartAlerts.length > 0 ? smartAlerts.map((alert) => {
                                const Icon = alert.icon;
                                return (
                                    <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:shadow-sm transition-all cursor-pointer bg-white">
                                        <div className={`p-2 rounded-lg ${alert.bg}`}>
                                            <Icon className={`w-4 h-4 ${alert.color}`} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-800">{alert.patient}</p>
                                            <p className="text-xs text-slate-500 font-medium">{alert.title}</p>
                                        </div>
                                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 mt-1" />
                                    </div>
                                )
                            }) : (
                                <div className="flex flex-col items-center justify-center p-6 text-center">
                                    <div className="p-3 bg-slate-50 rounded-full mb-3">
                                        <Sparkles className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <p className="text-sm font-semibold text-slate-600 mb-1">Nenhum alerta ativo</p>
                                    <p className="text-xs text-slate-400 max-w-[200px]">Tudo certo por aqui! Não há alertas clínicos pendentes.</p>
                                </div>
                            )}
                        </div>
                        <Button variant="ghost" className="w-full mt-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl">
                            Visualizar Todos
                        </Button>
                    </Card>
                </section>

                {/* Decifrador IA / Copilot Action */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both md:col-span-2 xl:col-span-1 flex flex-col" style={{ animationDelay: '450ms' }}>
                    <Card className="flex-1 p-5 bg-gradient-to-br from-teal-500 to-emerald-600 border-0 shadow-md rounded-2xl flex flex-col justify-between relative overflow-hidden group">
                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:scale-110 transition-transform duration-700" />

                        <div className="relative z-10">
                            <div className="p-3 bg-white/20 w-fit rounded-xl backdrop-blur-sm mb-4">
                                <Bot className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-black text-white leading-tight mb-2">
                                Copiloto Médico IA
                            </h3>
                            <p className="text-sm text-teal-50 font-medium opacity-90 mb-6">
                                Utilize nossa inteligência artificial para decifrar exames complexos, traçar diagnósticos diferenciais e analisar interações medicamentosas.
                            </p>
                        </div>

                        <div className="relative z-10 gap-2 flex flex-col">
                            <Button
                                className="w-full bg-white text-teal-700 hover:bg-slate-50 font-bold shadow-sm rounded-xl h-10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                onClick={() => navigate('/medical/ia')}
                            >
                                Decifrador de Casos Clínicos
                            </Button>
                            <Button
                                className="w-full bg-teal-600/30 text-white hover:bg-teal-600/50 backdrop-blur-sm font-bold rounded-xl h-10 transition-all"
                                onClick={() => navigate('/medical/analise')}
                            >
                                Segunda Opinião Rápida
                            </Button>
                        </div>
                    </Card>
                </section>

                {/* Módulos Clínicos - Expandido */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both md:col-span-2 xl:col-span-3 flex flex-col" style={{ animationDelay: '550ms' }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {quickModules.map((mod) => {
                            const Icon = mod.icon;
                            return (
                                <Card
                                    key={mod.title}
                                    className="p-4 cursor-pointer transition-all duration-300 bg-card border border-border/60 shadow-sm hover:border-teal-200 hover:shadow-md group relative overflow-hidden rounded-2xl"
                                    onClick={() => navigate(mod.url)}
                                >
                                    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${mod.gradient} opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-full`} />
                                    <div className="flex flex-col gap-3 relative z-10">
                                        <div className={`p-2.5 rounded-xl w-fit ${mod.bgIcon} group-hover:scale-110 transition-transform`}>
                                            <Icon className={`h-4 w-4 ${mod.iconColor}`} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors tracking-tight mb-1">
                                                {mod.title}
                                            </h3>
                                            <p className="text-xs text-muted-foreground font-medium leading-relaxed">{mod.description}</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                                </Card>
                            );
                        })}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default MedicalDashboard;

