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
        <div className="p-6 max-w-screen-2xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <header className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl">
                        <Sparkles className="h-8 w-8 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                            Inteligência Clínica
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Plataforma de Apoio à Decisão Clínica Integrativa
                        </p>
                    </div>
                </div>
            </header>

            {/* Disclaimer */}
            <Card className="p-3 border-blue-500/20 bg-blue-500/5">
                <div className="flex gap-3 items-center">
                    <Shield className="h-4 w-4 text-blue-400 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-blue-400">Sistema Assistivo</span> — Todas as análises são suporte à decisão clínica. Não substituem avaliação profissional.
                    </p>
                </div>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bento-card p-5 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl">
                        <Users className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Pacientes</p>
                        <div className="flex items-end gap-2">
                            <h3 className="text-2xl font-bold">128</h3>
                            <span className="text-xs text-emerald-400 flex items-center gap-0.5 mb-1">
                                <TrendingUp className="h-3 w-3" /> +12
                            </span>
                        </div>
                    </div>
                </Card>

                <Card className="bento-card p-5 flex items-center gap-4">
                    <div className="p-3 bg-cyan-500/10 rounded-xl">
                        <Calendar className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Consultas Hoje</p>
                        <div className="flex items-end gap-2">
                            <h3 className="text-2xl font-bold">5</h3>
                            <span className="text-xs text-muted-foreground mb-1">agendadas</span>
                        </div>
                    </div>
                </Card>

                <Card className="bento-card p-5 flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl">
                        <Brain className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Análises</p>
                        <div className="flex items-end gap-2">
                            <h3 className="text-2xl font-bold">47</h3>
                            <span className="text-xs text-emerald-400 flex items-center gap-0.5 mb-1">
                                <TrendingUp className="h-3 w-3" /> +8
                            </span>
                        </div>
                    </div>
                </Card>

                <Card className="bento-card p-5 flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-xl">
                        <BookOpen className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Protocolos</p>
                        <h3 className="text-2xl font-bold">23</h3>
                    </div>
                </Card>
            </div>

            {/* Quick Access Modules */}
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Módulos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quickModules.map((mod) => {
                        const Icon = mod.icon;
                        return (
                            <Card
                                key={mod.title}
                                className={`bento-card p-5 cursor-pointer transition-all ${mod.borderColor} group`}
                                onClick={() => navigate(mod.url)}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl bg-gradient-to-br ${mod.gradient} shrink-0`}>
                                        <Icon className={`h-6 w-6 ${mod.iconColor}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold text-foreground group-hover:text-blue-400 transition-colors">
                                                {mod.title}
                                            </h3>
                                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">{mod.description}</p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <Card className="bento-card p-5 lg:col-span-2">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-blue-400" />
                        Atividade Recente
                    </h3>
                    <div className="space-y-3">
                        {recentActivities.map((act, i) => {
                            const Icon = act.icon;
                            return (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors">
                                    <div className="p-2 bg-white/5 rounded-lg">
                                        <Icon className={`h-4 w-4 ${act.color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-foreground truncate">{act.text}</p>
                                    </div>
                                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> {act.time}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                {/* Quick Actions */}
                <Card className="bento-card p-5">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-400" />
                        Ações Rápidas
                    </h3>
                    <div className="space-y-3">
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-3 h-12"
                            onClick={() => navigate('/medical/patients')}
                        >
                            <Users className="h-4 w-4 text-blue-400" />
                            Cadastrar Paciente
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-3 h-12"
                            onClick={() => navigate('/medical/transcricao')}
                        >
                            <Mic className="h-4 w-4 text-violet-400" />
                            Nova Transcrição
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-3 h-12"
                            onClick={() => navigate('/medical/analise')}
                        >
                            <Brain className="h-4 w-4 text-emerald-400" />
                            Fazer Análise Clínica
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-3 h-12"
                            onClick={() => navigate('/medical/protocolos')}
                        >
                            <BookOpen className="h-4 w-4 text-amber-400" />
                            Consultar Protocolos
                        </Button>
                        <Button
                            variant="default"
                            className="w-full justify-start gap-3 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-0 shadow-lg shadow-indigo-500/20"
                            onClick={() => navigate('/medical/ia')}
                        >
                            <Bot className="h-4 w-4" />
                            Decifrador de Casos (IA)
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default MedicalDashboard;
