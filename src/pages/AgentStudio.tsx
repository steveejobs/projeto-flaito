import { useState, useEffect } from "react";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { 
  Bot, 
  Plus, 
  Search, 
  Settings2, 
  MessageSquare, 
  Clock, 
  ShieldAlert, 
  ChevronRight,
  MoreHorizontal,
  Power,
  Zap
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AgentProfile {
  id: string;
  name: string;
  role: string;
  goal: string;
  channel: string;
  is_active: boolean;
  system_prompt: string;
  tone: string;
  fallback_message: string;
  business_hours_json: any;
  created_at: string;
}

export default function AgentStudio() {
  const { officeId } = useOfficeRole();
  const { toast } = useToast();
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    if (officeId) {
      fetchAgents();
    }
  }, [officeId]);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("office_id", officeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAgents(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar agentes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (agent: AgentProfile) => {
    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({ is_active: !agent.is_active })
        .eq("id", agent.id);

      if (error) throw error;
      
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, is_active: !a.is_active } : a));
      
      toast({
        title: agent.is_active ? "Agente desativado" : "Agente ativado",
        description: `O agente ${agent.name} foi atualizado com sucesso.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar agente",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditAgent = (agent: AgentProfile) => {
    setSelectedAgent(agent);
    setIsSheetOpen(true);
  };

  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;

    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({
          name: selectedAgent.name,
          role: selectedAgent.role,
          goal: selectedAgent.goal,
          system_prompt: selectedAgent.system_prompt,
          tone: selectedAgent.tone,
          fallback_message: selectedAgent.fallback_message
        })
        .eq("id", selectedAgent.id);

      if (error) throw error;

      toast({
        title: "Agente salvo",
        description: "As configurações foram atualizadas corretamente.",
      });
      setIsSheetOpen(false);
      fetchAgents();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredAgents = agents.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    a.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8 space-y-8 animate-in fade-in duration-500">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 border-border/50">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Studio de Agentes
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Configure a personalidade e o comportamento dos seus atendentes virtuais.
          </p>
        </div>
        <Button size="lg" className="rounded-full shadow-lg hover:shadow-primary/20 transition-all gap-2 px-6">
          <Plus className="h-5 w-5" />
          Novo Agente
        </Button>
      </div>

      {/* Toolbox */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou papel..." 
            className="pl-10 h-12 bg-background/50 border-border/50 focus-visible:ring-primary/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs defaultValue="all" className="w-full sm:w-auto">
          <TabsList className="h-12 p-1 bg-muted/30">
            <TabsTrigger value="all" className="px-6 rounded-md">Todos</TabsTrigger>
            <TabsTrigger value="active" className="px-6 rounded-md">Ativos</TabsTrigger>
            <TabsTrigger value="inactive" className="px-6 rounded-md">Inativos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Grid de Agentes */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-3xl bg-muted/5 border-muted-foreground/20">
          <Bot className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-xl font-semibold">Nenhum agente encontrado</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2">
            Comece criando seu primeiro atendente configurável para automatizar o pré-atendimento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map(agent => (
            <Card key={agent.id} className="group overflow-hidden rounded-2xl border-border/50 hover:border-primary/50 transition-all shadow-sm hover:shadow-xl hover:shadow-primary/5">
              <CardHeader className="relative pb-4">
                <div className="absolute right-4 top-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted/50 rounded-full">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleEditAgent(agent)} className="gap-2">
                        <Settings2 className="h-4 w-4" /> Editar Perfil
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2">
                        <MessageSquare className="h-4 w-4" /> Ver Conversas
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleToggleActive(agent)}
                        className={`gap-2 ${agent.is_active ? 'text-destructive' : 'text-primary'}`}
                      >
                        <Power className="h-4 w-4" /> 
                        {agent.is_active ? 'Desativar Agente' : 'Ativar Agente'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${agent.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'} transition-colors`}>
                    <Bot className="h-8 w-8" />
                  </div>
                  <div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{agent.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="font-medium bg-muted/50 border-none capitalize">{agent.channel}</Badge>
                      {agent.is_active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-none flex gap-1 items-center">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          Online
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground/60">Offline</Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                    <Zap className="h-4 w-4 text-primary" />
                    <span>Papel: {agent.role}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.goal || "Sem objetivo definido."}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="bg-muted/30 p-2 rounded-xl text-center">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Conversas</span>
                    <span className="font-bold text-lg">--</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl text-center">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Satisfação</span>
                    <span className="font-bold text-lg text-emerald-600">--</span>
                  </div>
                </div>

                <Button 
                  onClick={() => handleEditAgent(agent)}
                  variant="outline" 
                  className="w-full rounded-xl border-border/50 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all gap-2"
                >
                  Personalizar Atendimento
                  <ChevronRight className="h-4 w-4 opacity-50 group-hover:translate-x-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sheet de Edição */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader className="pb-6 border-b">
            <SheetTitle className="text-2xl flex items-center gap-2">
              <Settings2 className="h-6 w-6 text-primary" />
              Editar Agente
            </SheetTitle>
            <SheetDescription>
              Ajuste as diretrizes e a personalidade do seu atendente.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSaveAgent} className="space-y-8 py-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Agente (Público)</Label>
                <Input 
                  id="name" 
                  value={selectedAgent?.name || ""} 
                  onChange={e => setSelectedAgent(prev => prev ? {...prev, name: e.target.value} : null)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Papel / Título</Label>
                  <Input 
                    id="role" 
                    placeholder="Ex: Concierge Jurídico"
                    value={selectedAgent?.role || ""} 
                    onChange={e => setSelectedAgent(prev => prev ? {...prev, role: e.target.value} : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tone">Tom de Voz</Label>
                  <Input 
                    id="tone" 
                    placeholder="Ex: Profissional e Acolhedor"
                    value={selectedAgent?.tone || ""} 
                    onChange={e => setSelectedAgent(prev => prev ? {...prev, tone: e.target.value} : null)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal">Objetivo Principal (Resumo)</Label>
                <Textarea 
                  id="goal" 
                  placeholder="O que este agente deve realizar?"
                  value={selectedAgent?.goal || ""} 
                  onChange={e => setSelectedAgent(prev => prev ? {...prev, goal: e.target.value} : null)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">Instruções do Sistema (Prompt Principal)</Label>
                <Textarea 
                  id="prompt" 
                  className="font-mono text-xs"
                  placeholder="Diretrizes detalhadas de comportamento..."
                  value={selectedAgent?.system_prompt || ""} 
                  onChange={e => setSelectedAgent(prev => prev ? {...prev, system_prompt: e.target.value} : null)}
                  rows={8}
                />
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-500" />
                    <span className="font-semibold text-sm">Controle de Fallback</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fallback" className="text-xs">Mensagem de Transbordo (Humano/Erro)</Label>
                  <Input 
                    id="fallback" 
                    placeholder="Aguarde um momento, passarei para um humano..."
                    value={selectedAgent?.fallback_message || ""} 
                    onChange={e => setSelectedAgent(prev => prev ? {...prev, fallback_message: e.target.value} : null)}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 sticky bottom-0 bg-background pb-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsSheetOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 shadow-lg shadow-primary/20">
                Salvar Alterações
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
