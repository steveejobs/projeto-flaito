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
    ativo: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    inativo: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    arquivado: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
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
        <div className="p-6 max-w-screen-2xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                        Pacientes
                    </h1>
                    <p className="text-muted-foreground">
                        Gestão completa de pacientes — cadastro, histórico e acompanhamento.
                    </p>
                </div>
                <Dialog open={cadastroOpen} onOpenChange={setCadastroOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20">
                            <UserPlus className="h-4 w-4" />
                            Novo Paciente
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <UserPlus className="h-5 w-5 text-blue-400" />
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
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                            <Button variant="outline" onClick={() => setCadastroOpen(false)}>
                                Cancelar
                            </Button>
                            <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                                Salvar Paciente
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </header>

            {/* Filters */}
            <Card className="bento-card p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nome, CPF ou e-mail..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full md:w-[180px]">
                            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="ativo">Ativos</SelectItem>
                            <SelectItem value="inativo">Inativos</SelectItem>
                            <SelectItem value="arquivado">Arquivados</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bento-card p-4 flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 rounded-xl">
                        <Users className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-2xl font-bold">{MOCK_PACIENTES.length}</p>
                    </div>
                </Card>
                <Card className="bento-card p-4 flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                        <Users className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Ativos</p>
                        <p className="text-2xl font-bold">{MOCK_PACIENTES.filter(p => p.status === 'ativo').length}</p>
                    </div>
                </Card>
                <Card className="bento-card p-4 flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/10 rounded-xl">
                        <Users className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Inativos</p>
                        <p className="text-2xl font-bold">{MOCK_PACIENTES.filter(p => p.status === 'inativo').length}</p>
                    </div>
                </Card>
                <Card className="bento-card p-4 flex items-center gap-3">
                    <div className="p-2.5 bg-cyan-500/10 rounded-xl">
                        <Calendar className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Consultas Hoje</p>
                        <p className="text-2xl font-bold">3</p>
                    </div>
                </Card>
            </div>

            {/* Table */}
            <Card className="bento-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                                        Paciente <ArrowUpDown className="h-3 w-3" />
                                    </button>
                                </th>
                                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">CPF</th>
                                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Contato</th>
                                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Última Consulta</th>
                                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((pac) => (
                                <tr
                                    key={pac.id}
                                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/medical/patients/${pac.id}`)}
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-blue-400 font-semibold text-sm">
                                                {pac.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">{pac.nome}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {pac.sexo === 'M' ? 'Masculino' : pac.sexo === 'F' ? 'Feminino' : 'Outro'} • {
                                                        new Date().getFullYear() - new Date(pac.data_nascimento).getFullYear()
                                                    } anos
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{pac.cpf}</td>
                                    <td className="p-4 hidden lg:table-cell">
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Phone className="h-3 w-3" /> {pac.telefone}
                                            </p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Mail className="h-3 w-3" /> {pac.email}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-muted-foreground hidden lg:table-cell">
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
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
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
                    <div className="p-12 text-center text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="text-lg font-medium">Nenhum paciente encontrado</p>
                        <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo paciente.</p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default PacientesPage;
