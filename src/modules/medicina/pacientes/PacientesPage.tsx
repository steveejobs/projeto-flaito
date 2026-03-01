import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Users,
    Plus,
    Search,
    Phone,
    Mail,
    Calendar,
    Eye,
    MoreHorizontal,
    UserPlus,
    Filter,
    ArrowUpDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Paciente {
    id: string;
    nome: string;
    cpf: string;
    data_nascimento: string;
    sexo: string;
    telefone: string;
    email: string;
    status: 'ativo' | 'inativo' | 'arquivado';
    ultima_consulta?: string;
}

// Mock data for visual demo
const MOCK_PACIENTES: Paciente[] = [
    {
        id: '1',
        nome: 'Maria Silva Santos',
        cpf: '123.456.789-00',
        data_nascimento: '1985-03-15',
        sexo: 'F',
        telefone: '(63) 99999-1234',
        email: 'maria.silva@email.com',
        status: 'ativo',
        ultima_consulta: '2026-02-25',
    },
    {
        id: '2',
        nome: 'João Pedro Oliveira',
        cpf: '987.654.321-00',
        data_nascimento: '1978-11-22',
        sexo: 'M',
        telefone: '(63) 98888-5678',
        email: 'joao.oliveira@email.com',
        status: 'ativo',
        ultima_consulta: '2026-02-20',
    },
    {
        id: '3',
        nome: 'Ana Beatriz Costa',
        cpf: '456.789.123-00',
        data_nascimento: '1992-07-08',
        sexo: 'F',
        telefone: '(63) 97777-9012',
        email: 'ana.costa@email.com',
        status: 'ativo',
        ultima_consulta: '2026-02-18',
    },
    {
        id: '4',
        nome: 'Carlos Eduardo Lima',
        cpf: '321.654.987-00',
        data_nascimento: '1965-01-30',
        sexo: 'M',
        telefone: '(63) 96666-3456',
        email: 'carlos.lima@email.com',
        status: 'inativo',
        ultima_consulta: '2026-01-10',
    },
    {
        id: '5',
        nome: 'Fernanda Almeida Souza',
        cpf: '654.321.987-00',
        data_nascimento: '2000-09-12',
        sexo: 'F',
        telefone: '(63) 95555-7890',
        email: 'fernanda.souza@email.com',
        status: 'ativo',
    },
];

const statusColors: Record<string, string> = {
    ativo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inativo: 'bg-amber-50 text-amber-700 border-amber-200',
    arquivado: 'bg-slate-100 text-slate-600 border-slate-200',
};

const PacientesPage = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('todos');
    const [cadastroOpen, setCadastroOpen] = useState(false);

    const filtered = MOCK_PACIENTES.filter((p) => {
        const matchSearch =
            p.nome.toLowerCase().includes(search.toLowerCase()) ||
            p.cpf.includes(search) ||
            p.email.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'todos' || p.status === statusFilter;
        return matchSearch && matchStatus;
    });

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-700 bg-[#FAFAFA] min-h-screen text-slate-800 font-inter">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-800">
                        Pacientes
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">
                        Gestão completa de pacientes — cadastro, histórico e acompanhamento.
                    </p>
                </div>
                <Dialog open={cadastroOpen} onOpenChange={setCadastroOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 h-11 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-all hover:scale-105 active:scale-95 text-sm font-bold">
                            <UserPlus className="h-4 w-4" />
                            Novo Paciente
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white border border-gray-100 shadow-xl rounded-2xl p-6">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <UserPlus className="h-5 w-5 text-teal-600" />
                                Cadastrar Paciente
                            </DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="md:col-span-2">
                                <Label>Nome Completo *</Label>
                                <Input placeholder="Ex: Maria Silva Santos" className="mt-1" />
                            </div>
                            <div>
                                <Label>CPF</Label>
                                <Input placeholder="000.000.000-00" className="mt-1" />
                            </div>
                            <div>
                                <Label>Data de Nascimento</Label>
                                <Input type="date" className="mt-1" />
                            </div>
                            <div>
                                <Label>Sexo</Label>
                                <Select>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="M">Masculino</SelectItem>
                                        <SelectItem value="F">Feminino</SelectItem>
                                        <SelectItem value="Outro">Outro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Telefone</Label>
                                <Input placeholder="(00) 00000-0000" className="mt-1" />
                            </div>
                            <div className="md:col-span-2">
                                <Label>E-mail</Label>
                                <Input type="email" placeholder="email@exemplo.com" className="mt-1" />
                            </div>
                            <div className="md:col-span-2">
                                <Label>Endereço</Label>
                                <Input placeholder="Rua, número, bairro, cidade - UF" className="mt-1" />
                            </div>
                            <div className="md:col-span-2">
                                <Label>Histórico Médico Inicial</Label>
                                <Textarea
                                    placeholder="Descreva condições pré-existentes, cirurgias, internações relevantes..."
                                    className="mt-1 min-h-[80px]"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label>Alergias</Label>
                                <Input placeholder="Medicamentos, alimentos, substâncias..." className="mt-1" />
                            </div>
                            <div className="md:col-span-2">
                                <Label>Medicamentos em Uso</Label>
                                <Textarea
                                    placeholder="Liste os medicamentos em uso atual..."
                                    className="mt-1 min-h-[60px]"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                            <Button variant="outline" onClick={() => setCadastroOpen(false)} className="rounded-xl border-gray-200 text-slate-700 hover:bg-slate-50">
                                Cancelar
                            </Button>
                            <Button className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm">
                                Salvar Paciente
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </header>

            {/* Filters */}
            <Card className="p-4 bg-white border border-gray-100 shadow-sm rounded-2xl">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nome, CPF ou e-mail..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-11 rounded-xl border-gray-200 bg-slate-50 focus-visible:ring-teal-500 hover:border-gray-300 transition-colors"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full md:w-[200px] h-11 rounded-xl border-gray-200 bg-slate-50 hover:border-gray-300 transition-colors text-slate-700 font-medium">
                            <Filter className="h-4 w-4 mr-2 text-slate-400" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-100 shadow-lg">
                            <SelectItem value="todos">Todos os Status</SelectItem>
                            <SelectItem value="ativo">Ativos</SelectItem>
                            <SelectItem value="inativo">Inativos</SelectItem>
                            <SelectItem value="arquivado">Arquivados</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <Card className="p-5 flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md transition-all group">
                    <div className="p-3 bg-blue-50 rounded-xl group-hover:scale-110 transition-transform">
                        <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Total</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">{MOCK_PACIENTES.length}</p>
                    </div>
                </Card>
                <Card className="p-5 flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md transition-all group">
                    <div className="p-3 bg-emerald-50 rounded-xl group-hover:scale-110 transition-transform">
                        <Users className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Ativos</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">{MOCK_PACIENTES.filter(p => p.status === 'ativo').length}</p>
                    </div>
                </Card>
                <Card className="p-5 flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md transition-all group">
                    <div className="p-3 bg-amber-50 rounded-xl group-hover:scale-110 transition-transform">
                        <Users className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Inativos</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">{MOCK_PACIENTES.filter(p => p.status === 'inativo').length}</p>
                    </div>
                </Card>
                <Card className="p-5 flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md transition-all group">
                    <div className="p-3 bg-cyan-50 rounded-xl group-hover:scale-110 transition-transform">
                        <Calendar className="h-5 w-5 text-cyan-600" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Consultas Hoje</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">3</p>
                    </div>
                </Card>
            </div>

            {/* Table */}
            <Card className="bg-white border border-gray-100 shadow-sm overflow-hidden rounded-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50">
                            <tr className="border-b border-gray-100">
                                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                    <button className="flex items-center gap-1 hover:text-slate-800 transition-colors">
                                        Paciente <ArrowUpDown className="h-3 w-3" />
                                    </button>
                                </th>
                                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-widest hidden md:table-cell">CPF</th>
                                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-widest hidden lg:table-cell">Contato</th>
                                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-widest hidden lg:table-cell">Última Consulta</th>
                                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="text-right p-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((pac) => (
                                <tr
                                    key={pac.id}
                                    className="border-b border-gray-50 hover:bg-slate-50 transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/medical/patients/${pac.id}`)}
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-700 font-bold text-sm shadow-sm">
                                                {pac.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{pac.nome}</p>
                                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                                    {pac.sexo === 'M' ? 'Masculino' : pac.sexo === 'F' ? 'Feminino' : 'Outro'} • {
                                                        new Date().getFullYear() - new Date(pac.data_nascimento).getFullYear()
                                                    } anos
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-slate-600 font-medium hidden md:table-cell">{pac.cpf}</td>
                                    <td className="p-4 hidden lg:table-cell">
                                        <div className="space-y-1.5">
                                            <p className="text-xs text-slate-600 font-medium flex items-center gap-2">
                                                <Phone className="h-3.5 w-3.5 text-slate-400" /> {pac.telefone}
                                            </p>
                                            <p className="text-xs text-slate-600 font-medium flex items-center gap-2">
                                                <Mail className="h-3.5 w-3.5 text-slate-400" /> {pac.email}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-slate-600 font-medium hidden lg:table-cell">
                                        {pac.ultima_consulta
                                            ? new Date(pac.ultima_consulta).toLocaleDateString('pt-BR')
                                            : '—'}
                                    </td>
                                    <td className="p-4">
                                        <Badge variant="outline" className={statusColors[pac.status]}>
                                            {pac.status.charAt(0).toUpperCase() + pac.status.slice(1)}
                                        </Badge>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-teal-600 hover:bg-teal-50"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/medical/patients/${pac.id}`);
                                            }}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && (
                    <div className="p-16 text-center text-slate-500">
                        <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                        <p className="text-lg font-bold text-slate-700">Nenhum paciente encontrado</p>
                        <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo paciente.</p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default PacientesPage;
