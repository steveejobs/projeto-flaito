import React, { useState } from "react";
import { Mic, Plus, Search, Filter, Clock, CheckCircle2, AlertCircle, PlayCircle, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

export default function MeetingModule() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Simulated meetings data (will be fetched from Supabase later)
  const [meetings] = useState([
    { 
      id: "1", 
      title: "Audiência de Instrução - Caso Silva vs. Estado", 
      date: "2024-04-09 14:00", 
      duration: "01:24:32", 
      status: "analyzed", 
      client: "João Silva",
      case: "0012345-67.2023.8.19.0001"
    },
    { 
      id: "2", 
      title: "Reunião de Alinhamento Estratégico", 
      date: "2024-04-09 10:30", 
      duration: "00:45:12", 
      status: "processing", 
      client: "Empresa XPTO",
      case: "Interno"
    },
    { 
      id: "3", 
      title: "Entrevista de Testemunha", 
      date: "2024-04-08 16:15", 
      duration: "00:32:00", 
      status: "completed", 
      client: "Maria Oliveira",
      case: "0088776-55.2024.8.19.0001"
    }
  ]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "recording":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 animate-pulse">Gravando</Badge>;
      case "processing":
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Processando</Badge>;
      case "analyzed":
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Analisado</Badge>;
      case "completed":
        return <Badge variant="outline">Concluído</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "recording": return <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />;
      case "processing": return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case "analyzed": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Mic className="h-8 w-8 text-primary" />
            </div>
            Reuniões Inteligentes
          </h1>
          <p className="text-muted-foreground mt-2">
            Grave, transcreva e analise reuniões jurídicas com IA de alta precisão.
          </p>
        </div>
        
        <Button 
          onClick={() => navigate("/legal/meetings/new")}
          size="lg" 
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 gap-2 h-12 px-6 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" />
          Nova Reunião
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card/50 backdrop-blur-sm border-white/5 overflow-hidden group hover:border-primary/20 transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Reuniões</p>
                <p className="text-3xl font-bold mt-1">24</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Mic className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-emerald-500 font-medium">
              <PlayCircle className="h-3 w-3 mr-1" />
              +3 esta semana
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5 overflow-hidden group hover:border-blue-500/20 transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Em Processamento</p>
                <p className="text-3xl font-bold mt-1 text-blue-500">02</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-blue-400 font-medium">
              Aguardando IA
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5 overflow-hidden group hover:border-emerald-500/20 transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Insights Gerados</p>
                <p className="text-3xl font-bold mt-1 text-emerald-500">18</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-emerald-400 font-medium">
              Tarefas extraídas
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <Card className="bg-card/30 backdrop-blur-xl border-white/5 overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/[0.02]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xl">Histórico de Reuniões</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar reuniões..." 
                  className="pl-8 bg-background/50 border-white/10 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9 bg-background/50 border-white/10">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01]">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Título</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente / Caso</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {meetings.map((meeting) => (
                  <tr 
                    key={meeting.id} 
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                    onClick={() => navigate(`/legal/meetings/${meeting.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10 group-hover:bg-primary/10 transition-colors">
                          <Mic className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold truncate max-w-[300px]">{meeting.title}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{meeting.duration}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-muted-foreground">{meeting.date}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(meeting.status)}
                        {getStatusBadge(meeting.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{meeting.client}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{meeting.case}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/legal/meetings/${meeting.id}`)}>
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {meetings.length === 0 && (
            <div className="p-12 text-center">
              <div className="mx-auto w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                <Mic className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium">Nenhuma reunião encontrada</h3>
              <p className="text-muted-foreground mt-1">Clique em "Nova Reunião" para começar a gravar.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
