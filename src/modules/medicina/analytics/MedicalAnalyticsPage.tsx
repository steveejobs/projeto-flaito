import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    BarChart3, TrendingUp, TrendingDown, Activity,
    Eye, Brain, Heart, Pill, Users, Sparkles,
    ArrowUp, ArrowDown, Minus
} from "lucide-react";

interface ZoneFrequency {
    zone: string;
    system: string;
    count: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
}

interface SystemEvolution {
    system: string;
    months: { month: string; score: number }[];
    current: number;
    change: number;
}

const MedicalAnalyticsPage: React.FC = () => {
    const [period, setPeriod] = useState('6m');

    return (
        <div className="p-6 max-w-screen-2xl mx-auto space-y-6 animate-in fade-in duration-700">
            <header className="flex items-center justify-between">
                <div className="space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        Analytics & Insights
                    </h1>
                    <p className="text-muted-foreground">Padrões, evolução e métricas da base de pacientes.</p>
                </div>
                <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1m">1 Mês</SelectItem>
                        <SelectItem value="3m">3 Meses</SelectItem>
                        <SelectItem value="6m">6 Meses</SelectItem>
                        <SelectItem value="1y">1 Ano</SelectItem>
                    </SelectContent>
                </Select>
            </header>

            <Card className="flex flex-col items-center justify-center p-20 text-center space-y-6 border-dashed border-2 bg-muted/10">
                <div className="h-20 w-20 bg-teal-500/10 rounded-full flex items-center justify-center">
                    <Activity className="h-10 w-10 text-teal-500 animate-pulse" />
                </div>
                <div className="max-w-md space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">Aguardando Dados Reais</h2>
                    <p className="text-muted-foreground font-medium">
                        Como parte do protocolo de segurança **P0 Remediation**, todos os dados demonstrativos foram removidos.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Os insights e correlações serão gerados automaticamente assim que houver massa crítica de diagnósticos reais e telemetria de atendimento processada com segurança.
                    </p>
                </div>
                <div className="flex gap-4">
                    <Badge variant="outline" className="px-3 py-1">LGPD Compliant</Badge>
                    <Badge variant="outline" className="px-3 py-1">No Mock Data</Badge>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-40 grayscale pointer-events-none">
                 <Card className="p-5 h-32 border-dashed" />
                 <Card className="p-5 h-32 border-dashed" />
                 <Card className="p-5 h-32 border-dashed" />
            </div>
        </div>
    );
};

export default MedicalAnalyticsPage;
