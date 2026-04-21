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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UnifiedAgent {
  id: string;
  slug?: string;
  name: string;
  role: string;
  goal: string;
  is_active: boolean;
  system_prompt: string;
  extra_instructions?: string;
  tone: string;
  fallback_message: string;
  vertical: string;
  origin: 'system' | 'custom';
  provider?: string;
  model?: string;
  temperature?: number;
  channel?: string;
}

export default function AgentStudio() {
  const { officeId, module } = useOfficeRole();
  const { toast } = useToast();
  const [agents, setAgents] = useState<UnifiedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<UnifiedAgent | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    if (officeId) {
      fetchAgents();
    }
  }, [officeId, module]);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      
      const { data: profiles, error: pErr } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("office_id", officeId)
        .eq("vertical", module);

      if (pErr) throw pErr;

      const { data: configs, error: cErr } = await supabase
        .from("ai_agent_configs" as any)
        .select("*")
        .or(`office_id.is.null,office_id.eq.${officeId}`);

      if (cErr) throw cErr;

      const systemMap = new Map<string, any>();
      
      configs?.filter(c => !c.office_id).forEach(c => {
        systemMap.set(c.slug, { ...c, is_override: false });
      });

      configs?.filter(c => c.office_id === officeId).forEach(c => {
        const global = systemMap.get(c.slug);
        systemMap.set(c.slug, { ...global, ...c, is_override: true });
      });

      const unifiedSystemAgents: UnifiedAgent[] = Array.from(systemMap.values())
        .map(c => ({
          id: `system:${c.slug}`,
          slug: c.slug,
          name: c.friendly_name || c.slug,
          role: "Agente de Sistema",
          goal: c.description || "",
          is_active: c.is_active ?? true,
          system_prompt: c.system_prompt || "",
          extra_instructions: c.extra_instructions || "",
          tone: "Profissional",
          fallback_message: "",
          vertical: "BOTH",
          origin: 'system' as const,
          provider: c.provider,
          model: c.model,
          temperature: c.temperature,
          channel: 'chat'
        }));

      const unifiedCustomAgents: UnifiedAgent[] = (profiles || []).map(p => ({
        id: p.id,
        name: p.name,
        role: p.role || "",
        goal: p.goal || "",
        is_active: p.is_active ?? true,
        system_prompt: p.system_prompt || "",
        tone: p.tone || "Profissional",
        fallback_message: p.fallback_message || "",
        vertical: p.vertical,
        origin: 'custom' as const,
        channel: p.channel || 'whatsapp'
      }));

      const finalAgents = [
        ...unifiedSystemAgents.filter(a => {
          if (module === 'MEDICAL') {
            return a.slug === 'voice-assistant';
          }
          return true;
        }),
        ...unifiedCustomAgents
      ];

      setAgents(finalAgents);

      // Auto-seeding: Se não houver agentes customizados na vertical, semeia automaticamente
      if (unifiedCustomAgents.length === 0 && module && !loading) {
        console.log(`[AgentStudio] Vertical ${module} sem agentes customizados. Iniciando auto-seed...`);
        handleSeedAgents(true); 
      }

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

  const handleSeedAgents = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const seeds = module === 'MEDICAL' 
        ? [
          {
            name: 'Recepcionista Clínica',
            role: 'Atendente de Triagem',
            goal: 'Identificar a especialidade necessária e coletar dados do convênio.',
            system_prompt: 'Você é a recepcionista virtual da Flaito Health. Sua missão é: 1. Confirmar se o paciente já é cadastrado. 2. Identificar se o motivo do contato é consulta eletiva ou urgência. 3. Se for urgência, instruir o paciente sobre o tempo médio de espera e coletar sintomas principais para o médico. 4. Se for eletiva, oferecer horários disponíveis. Seja acolhedora, mas eficiente na coleta de dados estruturados.',
            tone: 'Acolhedor e Profissional',
            fallback_message: 'Vou transferir para nossa recepção humana para finalizar seu agendamento.',
            vertical: 'MEDICAL'
          },
          {
            name: 'Triagem Pré-Consulta',
            role: 'Assistente Clínico IA',
            goal: 'Coletar anamnese básica (alergias, medicamentos, sintomas) antes da consulta.',
            system_prompt: 'Você é um assistente clínico que prepara o atendimento para o médico. Sua missão é: 1. Perguntar sobre alergias conhecidas. 2. Listar medicamentos em uso contínuo. 3. Descrever os sintomas atuais com duração e intensidade (0-10). 4. Organizar esses dados em um resumo para o prontuário. Nunca dê diagnósticos, apenas colete informações.',
            tone: 'Técnico e Empático',
            fallback_message: 'Aguarde um momento, um profissional de saúde analisará seus sintomas.',
            vertical: 'MEDICAL'
          }
        ]
        : [
          {
            name: 'Protocolo Jurídico',
            role: 'Assistente de Intake',
            goal: 'Qualificar a viabilidade jurídica do caso e coletar documentos básicos.',
            system_prompt: 'Você é o assistente de entrada do escritório. Sua missão é: 1. Identificar o ramo do direito (Trabalhista, Cível, etc). 2. Coletar fatos principais (O que aconteceu? Quando? Onde?). 3. Solicitar documentos essenciais (RG, Comprovante de Residência). 4. Avaliar se o caso tem urgência (prazos correndo). Organize as informações para que o advogado possa decidir pela aceitação do caso em menos de 2 minutos.',
            tone: 'Formal e Eficiente',
            fallback_message: 'Vou encaminhar seu relato para um de nossos advogados especialistas.',
            vertical: 'LEGAL'
          },
          {
            name: 'Qualificação Comercial',
            role: 'Sales Development Representative (SDR)',
            goal: 'Identificar o potencial financeiro do lead e urgência da demanda.',
            system_prompt: 'Você é o responsável por filtrar leads no CRM. Sua missão é: 1. Entender o ticket médio potencial do caso. 2. Identificar a dor emocional do cliente. 3. Agendar uma reunião de briefing se o lead for qualificado. 4. Marcar leads "frios" para régua de nutrição. Seja persuasivo e focado em converter o contato em uma reunião.',
            tone: 'Direto e Persuasivo',
            fallback_message: 'Nossa equipe comercial entrará em contato em breve para uma análise personalizada.',
            vertical: 'LEGAL'
          }
        ];

      const fullSeeds = seeds.map(s => ({
        ...s,
        office_id: officeId,
        channel: 'whatsapp',
        is_active: true,
        business_hours_json: {}
      }));

      const { error } = await supabase.from('agent_profiles').insert(fullSeeds);
      if (error) throw error;

      if (!silent) {
        toast({
          title: "Agentes Semeados!",
          description: `Criamos ${seeds.length} agentes padrão para o módulo ${module}.`,
        });
      }
      
      fetchAgents();

    } catch (error: any) {
      if (!silent) {
        toast({
          title: "Erro ao semear agentes",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleToggleActive = async (agent: UnifiedAgent) => {
    try {
      if (agent.origin === 'custom') {
        const { error } = await supabase
          .from("agent_profiles")
          .update({ is_active: !agent.is_active })
          .eq("id", agent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ai_agent_configs" as any)
          .upsert({ 
            slug: agent.slug, 
            office_id: officeId,
            is_active: !agent.is_active 
          }, { onConflict: 'office_id,slug' });
        if (error) throw error;
      }
      
      fetchAgents();
      
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

  const handleEditAgent = (agent: UnifiedAgent) => {
    setSelectedAgent(agent);
    setIsSheetOpen(true);
  };

  const handleCreateAgent = () => {
    setSelectedAgent({
      id: '', 
      name: 'Novo Agente',
      role: 'Atendente',
      goal: '',
      is_active: true,
      system_prompt: '',
      tone: 'Profissional',
      fallback_message: 'Um momento, vou transferir para um especialista.',
      vertical: module || 'LEGAL',
      origin: 'custom',
      channel: 'whatsapp'
    } as UnifiedAgent);
    setIsSheetOpen(true);
  };


  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent || !officeId) return;

    try {
      if (selectedAgent.origin === 'custom') {
        const agentData = {
          office_id: officeId,
          name: selectedAgent.name,
          role: selectedAgent.role,
          goal: selectedAgent.goal,
          system_prompt: selectedAgent.system_prompt,
          tone: selectedAgent.tone,
          fallback_message: selectedAgent.fallback_message,
          vertical: module || 'LEGAL',
          channel: selectedAgent.id ? selectedAgent.channel : 'whatsapp',
          is_active: selectedAgent.id ? selectedAgent.is_active : true
        };

        const { error } = selectedAgent.id 
          ? await supabase.from("agent_profiles").update(agentData).eq("id", selectedAgent.id)
          : await supabase.from("agent_profiles").insert(agentData);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ai_agent_configs" as any)
          .upsert({
            slug: selectedAgent.slug,
            office_id: officeId,
            model: selectedAgent.model,
            temperature: selectedAgent.temperature,
            system_prompt: selectedAgent.system_prompt,
            extra_instructions: selectedAgent.extra_instructions,
            friendly_name: selectedAgent.name,
            is_active: selectedAgent.is_active
          }, { onConflict: 'office_id,slug' });

        if (error) throw error;
      }

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 border-border/50">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Studio de Agentes
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Configure a personalidade e o comportamento dos seus atendentes virtuais.
          </p>
        </div>
        <Button 
          size="lg" 
          className="rounded-full shadow-lg hover:shadow-primary/20 transition-all gap-2 px-6"
          onClick={handleCreateAgent}
        >
          <Plus className="h-5 w-5" />
          Novo Agente
        </Button>
      </div>

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

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-3xl bg-muted/5 border-muted-foreground/20">
          <Bot className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-xl font-semibold">Nenhum agente encontrado</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2 mb-6">
            Sua vertical <strong>{module}</strong> está sem agentes ativos. Comece do zero ou use nossos templates recomendados.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button onClick={handleCreateAgent} variant="outline" className="rounded-full">
              <Plus className="h-4 w-4 mr-2" /> Criar do Zero
            </Button>
            <Button onClick={handleSeedAgents} className="rounded-full gap-2 shadow-lg shadow-primary/20">
              <Zap className="h-4 w-4" /> Gerar Agentes Sugeridos ({module})
            </Button>
          </div>
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
                    <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="outline" className="font-medium bg-muted/50 border-none capitalize">{agent.channel}</Badge>
                      <Badge variant="secondary" className={agent.origin === 'system' ? 'bg-blue-500/10 text-blue-600 border-none' : 'bg-purple-500/10 text-purple-600 border-none'}>
                        {agent.origin === 'system' ? 'Sistema' : 'Personalizado'}
                      </Badge>
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
                    disabled={selectedAgent?.origin === 'system'}
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

              {selectedAgent?.origin === 'system' && (
                <div className="space-y-2">
                  <Label htmlFor="extra">Instruções Adicionais (Office Override)</Label>
                  <Textarea 
                    id="extra" 
                    placeholder="Regras específicas do seu escritório que complementam o prompt..."
                    value={selectedAgent?.extra_instructions || ""} 
                    onChange={e => setSelectedAgent(prev => prev ? {...prev, extra_instructions: e.target.value} : null)}
                    rows={4}
                  />
                </div>
              )}

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
