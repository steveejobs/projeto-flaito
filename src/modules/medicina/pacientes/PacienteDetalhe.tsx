import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    ArrowLeft,
    User,
    Calendar,
    Phone,
    Mail,
    MapPin,
    Heart,
    Pill,
    AlertTriangle,
    FileText,
    Upload,
    Plus,
    Clock,
    Stethoscope,
    ClipboardList,
    ChevronRight,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

const PacienteDetalhe = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [novaAnotacao, setNovaAnotacao] = useState('');

    // Mock paciente
    const paciente = {
        id,
        nome: 'Maria Silva Santos',
        cpf: '123.456.789-00',
        data_nascimento: '1985-03-15',
        sexo: 'F',
        telefone: '(63) 99999-1234',
        email: 'maria.silva@email.com',
        endereco: 'Rua das Flores, 123 - Centro, Palmas - TO',
        status: 'ativo',
        historico_medico: 'Hipertensão arterial controlada. Cirurgia de apendicectomia em 2018. Histórico familiar de diabetes tipo 2.',
        alergias: 'Dipirona, Penicilina',
        medicamentos_em_uso: 'Losartana 50mg 1x/dia, Vitamina D 2000UI 1x/dia',
    };

    const consultas = [
        { id: '1', data: '2026-02-25', queixa: 'Cefaleia persistente', conduta: 'Solicitado exames laboratoriais. Prescrito analgésico.', profissional: 'Dr. Carlos Mendes' },
        { id: '2', data: '2026-02-10', queixa: 'Fadiga crônica, dificuldade de concentração', conduta: 'Encaminhamento para avaliação neuropsicológica.', profissional: 'Dra. Ana Paula' },
        { id: '3', data: '2026-01-15', queixa: 'Revisão de rotina', conduta: 'Resultados dentro da normalidade. Manter medicação.', profissional: 'Dr. Carlos Mendes' },
    ];

    const anotacoes = [
        { id: '1', data: '2026-02-25', texto: 'Paciente relata melhora dos sintomas de cefaleia após início do tratamento com magnésio quelato.', autor: 'Dr. Carlos Mendes' },
        { id: '2', data: '2026-02-10', texto: 'Observação: paciente demonstra sinais de ansiedade leve durante consulta. Considerar abordagem integrativa.', autor: 'Dra. Ana Paula' },
    ];

    const exames = [
        { id: '1', nome: 'Hemograma Completo', data: '2026-02-20', tipo: 'Laboratorial' },
        { id: '2', nome: 'Ressonância Magnética Crânio', data: '2026-02-15', tipo: 'Imagem' },
        { id: '3', nome: 'Perfil Tireoidiano (TSH, T3, T4)', data: '2026-01-10', tipo: 'Laboratorial' },
    ];

    const idade = new Date().getFullYear() - new Date(paciente.data_nascimento).getFullYear();

    return (
        <div className="p-6 max-w-screen-2xl mx-auto space-y-6 animate-in fade-in duration-700">
            {/* Back button */}
            <Button
                variant="ghost"
                className="gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/medical/patients')}
            >
                <ArrowLeft className="h-4 w-4" /> Voltar para Pacientes
            </Button>

            {/* Patient Header */}
            <Card className="bento-card p-6">
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Avatar */}
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-blue-400 font-bold text-2xl shrink-0">
                        {paciente.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>

                    {/* Info */}
                    <div className="flex-1 space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">{paciente.nome}</h1>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {paciente.sexo === 'F' ? 'Feminino' : 'Masculino'} • {idade} anos • CPF: {paciente.cpf}
                                </p>
                            </div>
                            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                Ativo
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-4 w-4 text-blue-400" />
                                {new Date(paciente.data_nascimento).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-4 w-4 text-blue-400" />
                                {paciente.telefone}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4 text-blue-400" />
                                {paciente.email}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground md:col-span-3">
                                <MapPin className="h-4 w-4 text-blue-400" />
                                {paciente.endereco}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick info cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/5">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                        <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Alergias</p>
                            <p className="text-sm text-foreground mt-1">{paciente.alergias}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                        <Pill className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Medicamentos em Uso</p>
                            <p className="text-sm text-foreground mt-1">{paciente.medicamentos_em_uso}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                        <Heart className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Histórico</p>
                            <p className="text-sm text-foreground mt-1 line-clamp-2">{paciente.historico_medico}</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="consultas" className="space-y-4">
                <TabsList className="bg-white/5 border border-white/10 p-1">
                    <TabsTrigger value="consultas" className="gap-2 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                        <Stethoscope className="h-4 w-4" /> Consultas
                    </TabsTrigger>
                    <TabsTrigger value="anotacoes" className="gap-2 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                        <ClipboardList className="h-4 w-4" /> Anotações
                    </TabsTrigger>
                    <TabsTrigger value="exames" className="gap-2 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                        <FileText className="h-4 w-4" /> Exames
                    </TabsTrigger>
                </TabsList>

                {/* Consultas Tab */}
                <TabsContent value="consultas" className="space-y-4">
                    <div className="flex justify-end">
                        <Button
                            className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                            onClick={() => navigate(`/medical/atendimento/${paciente.id}`)}
                        >
                            <Plus className="h-4 w-4" /> Nova Consulta Single-Screen
                        </Button>
                    </div>
                    {consultas.map((c) => (
                        <Card key={c.id} className="bento-card p-5 hover:border-blue-500/20 transition-colors cursor-pointer group">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="p-2.5 bg-blue-500/10 rounded-xl shrink-0">
                                        <Stethoscope className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <p className="font-semibold text-foreground">{c.queixa}</p>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(c.data).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{c.conduta}</p>
                                        <p className="text-xs text-muted-foreground/60">{c.profissional}</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </Card>
                    ))}
                </TabsContent>

                {/* Anotações Tab */}
                <TabsContent value="anotacoes" className="space-y-4">
                    <Card className="bento-card p-5">
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Nova Anotação</h3>
                        <Textarea
                            placeholder="Escreva uma anotação clínica..."
                            value={novaAnotacao}
                            onChange={(e) => setNovaAnotacao(e.target.value)}
                            className="min-h-[80px] mb-3"
                        />
                        <div className="flex justify-end">
                            <Button className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white" size="sm">
                                <Plus className="h-4 w-4" /> Adicionar Anotação
                            </Button>
                        </div>
                    </Card>
                    {anotacoes.map((a) => (
                        <Card key={a.id} className="bento-card p-5">
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-amber-500/10 rounded-xl shrink-0">
                                    <ClipboardList className="h-5 w-5 text-amber-400" />
                                </div>
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground">{a.autor}</p>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {new Date(a.data).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-foreground">{a.texto}</p>
                                </div>
                            </div>
                        </Card>
                    ))}
                </TabsContent>

                {/* Exames Tab */}
                <TabsContent value="exames" className="space-y-4">
                    <div className="flex justify-end">
                        <Button className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                            <Upload className="h-4 w-4" /> Upload de Exame
                        </Button>
                    </div>
                    <Card className="bento-card overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exame</th>
                                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                                    <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {exames.map((ex) => (
                                    <tr key={ex.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <FileText className="h-4 w-4 text-blue-400" />
                                                <span className="font-medium text-sm">{ex.nome}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge variant="outline" className="text-xs bg-white/5">
                                                {ex.tipo}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-sm text-muted-foreground">
                                            {new Date(ex.data).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="p-4 text-right">
                                            <Button variant="ghost" size="sm" className="gap-1 text-xs">
                                                <FileText className="h-3 w-3" /> Visualizar
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default PacienteDetalhe;
