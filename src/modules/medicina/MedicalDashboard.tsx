import React from 'react';
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
    TrendingUp,
    ClipboardList,
    Shield,
    Clock,
    FileText,
    Sparkles,
    Bot,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/dashboard";

const MedicalDashboard = () => {
    const navigate = useNavigate();

    const quickModules = [
        {
            title: 'Pacientes',
            description: 'Cadastro, histórico e acompanhamento de pacientes.',
            icon: Users,
            url: '/medical/patients',
            gradient: 'from-blue-600/20 to-cyan-600/20',
            iconColor: 'text-blue-400',
            borderColor: 'hover:border-blue-500/30',
        },
        {
            title: 'Transcrição Clínica',
            description: 'Upload de áudio e transcrição estruturada de consultas.',
            icon: Mic,
            url: '/medical/transcricao',
            gradient: 'from-violet-600/20 to-purple-600/20',
            iconColor: 'text-violet-400',
            borderColor: 'hover:border-violet-500/30',
        },
        {
            title: 'Análise Clínica',
            description: 'Motor multidisciplinar — Nutrição, Integrativa, Neuro.',
            icon: Brain,
            url: '/medical/analise',
            gradient: 'from-emerald-600/20 to-teal-600/20',
            iconColor: 'text-emerald-400',
            borderColor: 'hover:border-emerald-500/30',
        },
        {
            title: 'Protocolos',
            description: 'Biblioteca de protocolos clínicos com evidência científica.',
            icon: BookOpen,
            url: '/medical/protocolos',
            gradient: 'from-amber-600/20 to-orange-600/20',
            iconColor: 'text-amber-400',
            borderColor: 'hover:border-amber-500/30',
        },
    ];

    const recentActivities = [
        { icon: Stethoscope, text: 'Consulta realizada — Maria Silva Santos', time: '2h atrás', color: 'text-blue-400' },
        { icon: Mic, text: 'Transcrição concluída — Consulta #1042', time: '3h atrás', color: 'text-violet-400' },
        { icon: Brain, text: 'Análise integrativa gerada — João P. Oliveira', time: '5h atrás', color: 'text-emerald-400' },
        { icon: ClipboardList, text: 'Anotação adicionada — Ana Beatriz Costa', time: '1d atrás', color: 'text-amber-400' },
        { icon: FileText, text: 'Exame anexado — Carlos Eduardo Lima', time: '2d atrás', color: 'text-cyan-400' },
    ];

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto min-h-screen bg-background text-foreground">
            {/* 1. Dashboard Header (Hero Typography) */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
                <DashboardHeader type="MEDICAL" />
            </section>

            {/* Disclaimer - Bento Style */}
            <Card className="p-4 border-white/5 bg-blue-500/5 backdrop-blur-md rounded-2xl flex gap-3 items-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                <Shield className="h-5 w-5 text-blue-400 shrink-0" />
                <p className="text-sm text-blue-400/90 font-medium">
                    <span className="font-bold underline decoration-blue-400/30 underline-offset-4">Sistema Assistivo</span> — Todas as análises são suporte à decisão clínica. Não substituem avaliação profissional.
                </p>
            </Card>

            {/* 2. KPI Grid (Tactile Maximalism) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                <Card className="dashboard-card p-6 flex items-center gap-5 bg-background/40 backdrop-blur-xl border-white/5 hover:border-blue-500/20 transition-all group">
                    <div className="p-4 bg-blue-500/10 rounded-2xl group-hover:scale-110 transition-transform">
                        <Users className="w-7 h-7 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pacientes</p>
                        <div className="flex items-end gap-2">
                            <h3 className="text-3xl font-black text-foreground">128</h3>
                            <span className="text-xs text-emerald-400 font-bold flex items-center gap-0.5 mb-1.5">
                                <TrendingUp className="h-3.5 w-3.5" /> +12%
                            </span>
                        </div>
                    </div>
                </Card>

                <Card className="dashboard-card p-6 flex items-center gap-5 bg-background/40 backdrop-blur-xl border-white/5 hover:border-cyan-500/20 transition-all group">
                    <div className="p-4 bg-cyan-500/10 rounded-2xl group-hover:scale-110 transition-transform">
                        <Calendar className="w-7 h-7 text-cyan-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Consultas Hoje</p>
                        <div className="flex items-end gap-2">
                            <h3 className="text-3xl font-black text-foreground">5</h3>
                            <span className="text-xs text-muted-foreground font-medium mb-1.5">confirmadas</span>
                        </div>
                    </div>
                </Card>

                <Card className="dashboard-card p-6 flex items-center gap-5 bg-background/40 backdrop-blur-xl border-white/5 hover:border-emerald-500/20 transition-all group">
                    <div className="p-4 bg-emerald-500/10 rounded-2xl group-hover:scale-110 transition-transform">
                        <Brain className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Análises IA</p>
                        <div className="flex items-end gap-2">
                            <h3 className="text-3xl font-black text-foreground">47</h3>
                            <span className="text-xs text-emerald-400 font-bold flex items-center gap-0.5 mb-1.5">
                                <TrendingUp className="h-3.5 w-3.5" /> +8
                            </span>
                        </div>
                    </div>
                </Card>

                <Card className="dashboard-card p-6 flex items-center gap-5 bg-background/40 backdrop-blur-xl border-white/5 hover:border-purple-500/20 transition-all group">
                    <div className="p-4 bg-purple-500/10 rounded-2xl group-hover:scale-110 transition-transform">
                        <BookOpen className="w-7 h-7 text-purple-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Protocolos</p>
                        <h3 className="text-3xl font-black text-foreground">23</h3>
                    </div>
                </Card>
            </div>

            {/* Quick Access Modules - Bento Layout */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <h2 className="text-xl font-black text-foreground mb-6 uppercase tracking-tighter flex items-center gap-2">
                    <div className="h-1.5 w-6 bg-blue-500 rounded-full" />
                    Módulos Clínicos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {quickModules.map((mod) => {
                        const Icon = mod.icon;
                        return (
                            <Card
                                key={mod.title}
                                className={`dashboard-card p-8 cursor-pointer transition-all duration-300 bg-background/40 backdrop-blur-xl border-white/5 ${mod.borderColor} group relative overflow-hidden`}
                                onClick={() => navigate(mod.url)}
                            >
                                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${mod.gradient} opacity-0 group-hover:opacity-10 transition-opacity rounded-bl-full`} />
                                <div className="flex items-start gap-6 relative z-10">
                                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${mod.gradient} shrink-0 group-hover:scale-110 transition-transform shadow-lg`}>
                                        <Icon className={`h-8 w-8 ${mod.iconColor}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-2xl font-bold text-foreground group-hover:text-blue-400 transition-colors tracking-tight">
                                                {mod.title}
                                            </h3>
                                            <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
                                        </div>
                                        <p className="text-base text-muted-foreground mt-2 font-medium leading-relaxed">{mod.description}</p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Grid - Bento Mixed */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
                {/* Recent Activity */}
                <Card className="dashboard-card p-8 lg:col-span-8 bg-background/40 backdrop-blur-xl border-white/5">
                    <h3 className="text-sm font-black text-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <Activity className="h-5 w-5 text-blue-400" />
                        Fluxo de Atividade
                    </h3>
                    <div className="space-y-4">
                        {recentActivities.map((act, i) => {
                            const Icon = act.icon;
                            return (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5 group">
                                    <div className="p-3 bg-white/5 rounded-xl group-hover:bg-blue-500/10 transition-colors">
                                        <Icon className={`h-5 w-5 ${act.color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-base font-medium text-foreground truncate">{act.text}</p>
                                    </div>
                                    <span className="text-xs font-bold text-muted-foreground/60 shrink-0 flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full">
                                        <Clock className="h-3.5 w-3.5" /> {act.time}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                {/* Quick Actions - Glass Column */}
                <Card className="dashboard-card p-8 lg:col-span-4 bg-background/40 backdrop-blur-xl border-white/5">
                    <h3 className="text-sm font-black text-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <Sparkles className="h-5 w-5 text-amber-400" />
                        Comandos Rápidos
                    </h3>
                    <div className="space-y-4">
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-4 h-14 rounded-2xl border-white/5 bg-white/5 hover:bg-blue-500/10 hover:border-blue-500/20 text-base font-bold transition-all group"
                            onClick={() => navigate('/medical/patients')}
                        >
                            <Users className="h-5 w-5 text-blue-400 group-hover:scale-110 transition-transform" />
                            Cadastrar Paciente
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-4 h-14 rounded-2xl border-white/5 bg-white/5 hover:bg-violet-500/10 hover:border-violet-500/20 text-base font-bold transition-all group"
                            onClick={() => navigate('/medical/transcricao')}
                        >
                            <Mic className="h-5 w-5 text-violet-400 group-hover:scale-110 transition-transform" />
                            Nova Transcrição
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-4 h-14 rounded-2xl border-white/5 bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/20 text-base font-bold transition-all group"
                            onClick={() => navigate('/medical/analise')}
                        >
                            <Brain className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                            Análise Clínica
                        </Button>
                        <Button
                            variant="default"
                            className="w-full justify-start gap-4 h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-0 shadow-xl shadow-blue-500/30 font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
                            onClick={() => navigate('/medical/ia')}
                        >
                            <Bot className="h-6 w-6 group-hover:animate-bounce" />
                            IA Decifradora
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default MedicalDashboard;
