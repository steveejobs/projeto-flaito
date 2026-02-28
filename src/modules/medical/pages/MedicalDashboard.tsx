import React from 'react';
import { Card } from "@/components/ui/card";
import { Stethoscope, Users, Calendar, Activity } from "lucide-react";

const MedicalDashboard = () => {
    return (
        <div className="p-6 max-w-screen-2xl mx-auto space-y-8 animate-in fade-in duration-700">
            <header className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    Dashboard Médico
                </h1>
                <p className="text-muted-foreground">Bem-vindo à sua central de gestão clínica.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bento-card p-6 flex items-center space-x-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl">
                        <Users className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Pacientes</p>
                        <h3 className="text-2xl font-bold">128</h3>
                    </div>
                </Card>

                <Card className="bento-card p-6 flex items-center space-x-4">
                    <div className="p-3 bg-cyan-500/10 rounded-xl">
                        <Calendar className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Agendamentos</p>
                        <h3 className="text-2xl font-bold">12</h3>
                    </div>
                </Card>

                <Card className="bento-card p-6 flex items-center space-x-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl">
                        <Activity className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Prontuários</p>
                        <h3 className="text-2xl font-bold">850</h3>
                    </div>
                </Card>

                <Card className="bento-card p-6 flex items-center space-x-4">
                    <div className="p-3 bg-purple-500/10 rounded-xl">
                        <Stethoscope className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Consultas Hoje</p>
                        <h3 className="text-2xl font-bold">5</h3>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bento-card p-6 lg:col-span-2 min-h-[400px]">
                    <h3 className="text-xl font-semibold mb-4 text-white/90">Agenda do Dia</h3>
                    <div className="flex items-center justify-center h-full text-muted-foreground italic">
                        Visualização de agenda em desenvolvimento...
                    </div>
                </Card>

                <Card className="bento-card p-6 min-h-[400px]">
                    <h3 className="text-xl font-semibold mb-4 text-white/90">Alertas Clínicos</h3>
                    <div className="flex items-center justify-center h-full text-muted-foreground italic">
                        Nenhum alerta crítico encontrado.
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default MedicalDashboard;
