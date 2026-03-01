import { useState } from "react";
import {
    Calendar as CalendarIcon,
    Clock,
    MoreHorizontal,
    Plus,
    Search,
    User,
    Video,
    FileText
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { GlassCard } from "@/components/ui/glass-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useNavigate } from "react-router-dom";

// Mock data (será substituído pelo Supabase)
const mockAgenda = [
    {
        id: "1",
        paciente_nome: "Maria Oliveira",
        data_hora: new Date(new Date().setHours(9, 0, 0, 0)),
        duracao_minutos: 30,
        tipo_consulta: "primeira_vez",
        status: "espera",
        observacoes: "Paciente referiu dor torácica",
    },
    {
        id: "2",
        paciente_nome: "Carlos Silva",
        data_hora: new Date(new Date().setHours(10, 0, 0, 0)),
        duracao_minutos: 30,
        tipo_consulta: "retorno",
        status: "agendado",
        observacoes: "Trazer exames",
    },
    {
        id: "3",
        paciente_nome: "Ana Souza",
        data_hora: new Date(new Date().setHours(11, 30, 0, 0)),
        duracao_minutos: 30,
        tipo_consulta: "procedimento",
        status: "agendado",
        observacoes: "Remoção de sinal",
    },
    {
        id: "4",
        paciente_nome: "Roberto Costa",
        data_hora: new Date(new Date().setHours(14, 0, 0, 0)),
        duracao_minutos: 30,
        tipo_consulta: "primeira_vez",
        status: "em_atendimento",
        observacoes: "",
    }
];

export default function AgendaMedicaPage() {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'agendado':
                return <Badge variant="outline" className="text-muted-foreground">Agendado</Badge>;
            case 'espera':
                return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 border-0">Aguardando</Badge>;
            case 'em_atendimento':
                return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 border-0">Em Atendimento</Badge>;
            case 'finalizado':
                return <Badge variant="secondary">Finalizado</Badge>;
            case 'cancelado':
                return <Badge variant="destructive">Cancelado</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getTipoConsultaBadge = (tipo: string) => {
        switch (tipo) {
            case 'primeira_vez':
                return <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">Primeira Vez</span>;
            case 'retorno':
                return <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">Retorno</span>;
            case 'procedimento':
                return <span className="text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-1 rounded-md">Procedimento</span>;
            default:
                return <span>{tipo}</span>;
        }
    };

    const handleIniciarAtendimento = (pacienteNome: string) => {
        // No futuro, isso vai atualizar o DB para 'em_atendimento' e navegar
        console.log("Iniciando atendimento para:", pacienteNome);
        // TODO: Adicionar rota para a tela de atendimento single-screen
        // navigate(`/medical/atendimento/${id}`);
    };

    return (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
            <DashboardHeader />

            <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Agenda Médica</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Gerencie seus horários e a fila de pacientes do dia.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Buscar paciente..."
                                    className="pl-8 bg-background/50 backdrop-blur-sm"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Button className="shrink-0 gap-2">
                                <Plus className="h-4 w-4" />
                                <span>Agendar</span>
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Sidebar Calendar */}
                        <div className="lg:col-span-3 space-y-6">
                            <GlassCard className="p-4 border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    className="rounded-md mx-auto"
                                    locale={ptBR}
                                />
                            </GlassCard>

                            <GlassCard className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
                                <CardHeader className="py-4 px-5 bg-muted/30">
                                    <CardTitle className="text-sm font-medium">Resumo do Dia</CardTitle>
                                </CardHeader>
                                <CardContent className="p-5">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Total Agendado</span>
                                            <span className="font-semibold text-lg">{mockAgenda.length}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Em Espera</span>
                                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                {mockAgenda.filter(a => a.status === 'espera').length}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Finalizados</span>
                                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                {mockAgenda.filter(a => a.status === 'finalizado').length}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </GlassCard>
                        </div>

                        {/* Main Schedule Area */}
                        <div className="lg:col-span-9">
                            <GlassCard className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10 flex flex-col h-full min-h-[500px]">
                                <div className="border-b px-6 py-4 flex items-center justify-between bg-muted/20">
                                    <h2 className="text-lg font-medium flex items-center gap-2">
                                        <CalendarIcon className="h-5 w-5 text-primary" />
                                        {date ? format(date, "EEEE, d 'de' MMMM", { locale: ptBR }) : 'Selecione uma data'}
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <Tabs defaultValue="lista" className="w-auto">
                                            <TabsList className="grid w-full grid-cols-2 h-9">
                                                <TabsTrigger value="lista" className="text-xs">Lista</TabsTrigger>
                                                <TabsTrigger value="calendario" className="text-xs">Grade</TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>
                                </div>

                                <ScrollArea className="flex-1 p-6">
                                    <div className="space-y-4">
                                        {mockAgenda.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                                <CalendarIcon className="h-12 w-12 mb-4 opacity-20" />
                                                <p className="text-lg font-medium text-foreground">A agenda está vazia</p>
                                                <p className="text-sm">Não há compromissos marcados para esta data.</p>
                                                <Button variant="outline" className="mt-6">Criar Agendamento</Button>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                {/* Timeline line */}
                                                <div className="absolute left-[59px] top-4 bottom-4 w-px bg-border/50 hidden sm:block"></div>

                                                <div className="space-y-6">
                                                    {mockAgenda.map((item) => (
                                                        <div key={item.id} className="relative flex flex-col sm:flex-row gap-4 sm:gap-6 group">
                                                            {/* Time Column */}
                                                            <div className="sm:w-28 flex-shrink-0 flex items-start sm:justify-end pt-1">
                                                                <span className="text-sm font-medium tabular-nums">
                                                                    {format(item.data_hora, "HH:mm")}
                                                                </span>
                                                            </div>

                                                            {/* Timeline dot */}
                                                            <div className="hidden sm:flex absolute left-[55px] top-2 h-2.5 w-2.5 rounded-full bg-border ring-4 ring-background z-10 
                                group-hover:bg-primary transition-colors"></div>

                                                            {/* Content Card */}
                                                            <div className="flex-1">
                                                                <Card className={`border-0 border-l-4 rounded-lg shadow-sm hover:shadow-md transition-all
                                  ${item.status === 'em_atendimento' ? 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' :
                                                                        item.status === 'espera' ? 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20' :
                                                                            'border-l-border bg-card'}`}>
                                                                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                                                        <div className="space-y-3 flex-1 min-w-0">
                                                                            <div className="flex items-center justify-between sm:justify-start gap-3">
                                                                                <h3 className="text-base font-semibold truncate flex items-center gap-2">
                                                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                                                    {item.paciente_nome}
                                                                                </h3>
                                                                                {getStatusBadge(item.status)}
                                                                            </div>

                                                                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <Clock className="h-3.5 w-3.5" />
                                                                                    <span>{item.duracao_minutos} min</span>
                                                                                </div>
                                                                                {getTipoConsultaBadge(item.tipo_consulta)}
                                                                                {item.observacoes && (
                                                                                    <div className="flex items-center gap-1.5 text-xs bg-muted/50 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                                                                                        <FileText className="h-3 w-3" />
                                                                                        <span className="truncate">{item.observacoes}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 mt-1 sm:mt-0">
                                                                            {item.status === 'espera' && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    className="flex-1 sm:flex-none gap-2 bg-primary hover:bg-primary/90"
                                                                                    onClick={() => handleIniciarAtendimento(item.paciente_nome)}
                                                                                >
                                                                                    <Video className="h-4 w-4" />
                                                                                    <span>Atender</span>
                                                                                </Button>
                                                                            )}

                                                                            <DropdownMenu>
                                                                                <DropdownMenuTrigger asChild>
                                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                                    </Button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="end">
                                                                                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                                                    <DropdownMenuSeparator />
                                                                                    <DropdownMenuItem>Ver Prontuário</DropdownMenuItem>
                                                                                    <DropdownMenuItem>Reagendar</DropdownMenuItem>
                                                                                    <DropdownMenuSeparator />
                                                                                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                                                                                        Cancelar Agendamento
                                                                                    </DropdownMenuItem>
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        </div>
                                                                    </div>
                                                                </Card>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </GlassCard>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
