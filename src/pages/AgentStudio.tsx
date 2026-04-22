import { useState, useEffect } from "react";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { useSearchParams } from "react-router-dom";
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
  Zap,
  Brain,
  Database,
  Globe,
  BookOpen,
  Cpu,
  Thermometer,
  FlaskConical,
  Send,
  Loader2,
  Mic,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { TestChatPanel } from "@/components/TestChatPanel";
import { UnifiedAgent } from "@/types/agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ReasoningMode = "fast" | "standard" | "deep" | "maximum";


const REASONING_MODES: { value: ReasoningMode; label: string; description: string; icon: string }[] = [
  { value: "fast", label: "Rápido", description: "Respostas ágeis, menor custo", icon: "⚡" },
  { value: "standard", label: "Padrão", description: "Equilíbrio entre qualidade e velocidade", icon: "⚖️" },
  { value: "deep", label: "Profundo", description: "Análise completa, modelo superior", icon: "🔬" },
  { value: "maximum", label: "Máximo", description: "Melhor resposta possível, maior custo", icon: "🧠" },
];

const PROVIDER_MODELS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
  google: {
    label: "Google",
    models: [
      { value: "google/gemini-2.0-flash-exp", label: "Gemini 2.0 Flash" },
      { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "google/gemini-2.5-pro-exp-03-25", label: "Gemini 2.5 Pro" },
    ]
  },
  openai: {
    label: "OpenAI",
    models: [
      { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "openai/gpt-4o", label: "GPT-4o" },
    ]
  },
  anthropic: {
    label: "Anthropic",
    models: [
      { value: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
      { value: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    ]
  },
};

// ─────────────────────────────────────────────────────────────
// Test Chat Panel
// ─────────────────────────────────────────────────────────────

function TestChatPanel({ agent, onClose }: { agent: UnifiedAgent; onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: string; content: string; _debug?: any }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendTestMessage = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("lexos-chat-assistant", {
        body: {
          message: msg,
          mode: "chat",
          module: "legal",
          test_mode: true,
          agent_slug: agent.slug,
          context: {},
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data?.message || data?.content || "Sem resposta",
        _debug: data?._audit
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Erro: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 border rounded-xl bg-muted/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FlaskConical className="h-4 w-4 text-primary" />
          Testar Agente — Mesmo runtime de produção
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">Fechar</Button>
      </div>

      <div className="max-h-64 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Envie uma mensagem para testar o agente com as configurações atuais.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-background border"
            }`}>
              <ReactMarkdown>{m.content}</ReactMarkdown>
              {m._debug && (
                <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground space-y-0.5">
                  <div>Config: {m._debug.config_id?.slice(0, 8)}</div>
                  <div>Source: {m._debug.source}</div>
                  <div>Agent: {m._debug.agent_slug}</div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-background border rounded-xl px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendTestMessage()}
          placeholder="Mensagem de teste..."
          className="text-sm"
          disabled={loading}
        />
        <Button size="icon" onClick={sendTestMessage} disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function AgentStudio() {
  const { officeId, module } = useOfficeRole();
  const { toast } = useToast();
  const [agents, setAgents] = useState<UnifiedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<UnifiedAgent | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showTestChat, setShowTestChat] = useState(false);
  const [activeTab, setActiveTab] = useState("global"); // global | LEGAL | MEDICAL
  const [searchParams] = useSearchParams();
  const slugParam = searchParams.get('slug');

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
        .eq("office_id", officeId);

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
          channel: 'chat',
          reasoning_mode: c.reasoning_mode || 'standard',
          use_system_context: c.use_system_context ?? true,
          use_private_knowledge: c.use_private_knowledge ?? true,
          use_web_knowledge: c.use_web_knowledge ?? false,
          guardrails: c.guardrails || {},
          test_mode: c.test_mode ?? false,
          metadata: c.metadata || {},
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
          // Voice assistant is global now, but other system agents might be module-specific
          if (a.slug === 'voice-assistant') return true;
          if (module === 'MEDICAL') {
            return false; // medical-specific logic if needed
          }
          return true;
        }),
        ...unifiedCustomAgents
      ];

      setAgents(finalAgents);
      
      // Auto-open agent if slug is provided
      if (slugParam && !selectedAgent) {
        const targetAgent = finalAgents.find(a => a.slug === slugParam);
        if (targetAgent) {
          handleEditAgent(targetAgent);
        }
      }

      if (unifiedCustomAgents.length === 0 && !loading) {
        // Only seed if they are in a specific vertical, and we don't have agents for it
        if (module) handleSeedAgents(true);
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
    let editAgent = { ...agent };
    
    // Context-aware editing: If editing a system agent inside a vertical tab, 
    // load its specific vertical settings
    if (agent.origin === "system" && (activeTab === "LEGAL" || activeTab === "MEDICAL")) {
      const settingsKey = activeTab === "LEGAL" ? "legal_settings" : "medical_settings";
      const verticalSettings = agent.metadata?.[settingsKey] || {};
      
      // Override the main settings with the vertical-specific ones for the UI
      editAgent = {
        ...editAgent,
        ...verticalSettings
      };
    }
    
    setSelectedAgent(editAgent);
    setShowTestChat(false);
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
      vertical: activeTab === 'global' ? (module || 'LEGAL') : activeTab,
      origin: 'custom',
      channel: 'whatsapp'
    } as UnifiedAgent);
    setShowTestChat(false);
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
          vertical: activeTab === 'global' ? (module || 'LEGAL') : activeTab,
          channel: selectedAgent.id ? selectedAgent.channel : 'whatsapp',
          is_active: selectedAgent.id ? selectedAgent.is_active : true
        };

        const { error } = selectedAgent.id
          ? await supabase.from("agent_profiles").update(agentData).eq("id", selectedAgent.id)
          : await supabase.from("agent_profiles").insert(agentData);

        if (error) throw error;
      } else {
        let settingsToUpdate: any = {};
        let updatedMetadata = { ...(selectedAgent.metadata || {}) };

        // Save into vertical metadata if edited from a vertical tab
        if (activeTab === "LEGAL" || activeTab === "MEDICAL") {
          const settingsKey = activeTab === "LEGAL" ? "legal_settings" : "medical_settings";
          
          settingsToUpdate = {
            system_prompt: selectedAgent.system_prompt,
            extra_instructions: selectedAgent.extra_instructions,
            model: selectedAgent.model,
            provider: selectedAgent.provider,
            temperature: selectedAgent.temperature,
            reasoning_mode: selectedAgent.reasoning_mode || 'standard',
            use_system_context: selectedAgent.use_system_context ?? true,
            use_private_knowledge: selectedAgent.use_private_knowledge ?? true,
            use_web_knowledge: selectedAgent.use_web_knowledge ?? false,
            guardrails: selectedAgent.guardrails || {},
          };
          updatedMetadata[settingsKey] = settingsToUpdate;
        }

        const basePayload = activeTab === "global" ? {
            model: selectedAgent.model,
            provider: selectedAgent.provider,
            temperature: selectedAgent.temperature,
            system_prompt: selectedAgent.system_prompt,
            extra_instructions: selectedAgent.extra_instructions,
            reasoning_mode: selectedAgent.reasoning_mode || 'standard',
            use_system_context: selectedAgent.use_system_context ?? true,
            use_private_knowledge: selectedAgent.use_private_knowledge ?? true,
            use_web_knowledge: selectedAgent.use_web_knowledge ?? false,
            guardrails: selectedAgent.guardrails || {},
        } : {};

        const { error } = await supabase
          .from("ai_agent_configs" as any)
          .upsert({
            slug: selectedAgent.slug,
            office_id: officeId,
            friendly_name: selectedAgent.name,
            is_active: selectedAgent.is_active,
            metadata: updatedMetadata,
            ...basePayload
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

  const filteredAgents = agents.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    if (activeTab === "global") return a.origin === "system";
    if (activeTab === "LEGAL") return a.vertical === "LEGAL" || a.origin === "system";
    if (activeTab === "MEDICAL") return a.vertical === "MEDICAL" || a.origin === "system";
    
    return true;
  });

  const getProviderFromModel = (model?: string): string => {
    if (!model) return "google";
    if (model.startsWith("google/")) return "google";
    if (model.startsWith("openai/")) return "openai";
    if (model.startsWith("anthropic/")) return "anthropic";
    return "google";
  };

  return (
    <div className="container mx-auto py-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 border-border/50">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Studio de Agentes
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Configure a identidade, modelo, conhecimento e comportamento dos seus agentes IA.
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="h-12 p-1 bg-muted/30">
            <TabsTrigger value="global" className="px-6 rounded-md">Global</TabsTrigger>
            <TabsTrigger value="LEGAL" className="px-6 rounded-md">Jurídico</TabsTrigger>
            <TabsTrigger value="MEDICAL" className="px-6 rounded-md">Médico</TabsTrigger>
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
            <Button onClick={() => handleSeedAgents()} className="rounded-full gap-2 shadow-lg shadow-primary/20">
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

                {/* Runtime badges for system agents */}
                {agent.origin === 'system' && (
                  <div className="flex flex-wrap gap-1.5">
                    {agent.reasoning_mode && agent.reasoning_mode !== 'standard' && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Brain className="h-3 w-3" />
                        {REASONING_MODES.find(r => r.value === agent.reasoning_mode)?.label || agent.reasoning_mode}
                      </Badge>
                    )}
                    {agent.model && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Cpu className="h-3 w-3" />
                        {agent.model.split('/').pop()}
                      </Badge>
                    )}
                    {agent.use_private_knowledge && (
                      <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600">
                        <BookOpen className="h-3 w-3" />
                        Conhecimento
                      </Badge>
                    )}
                    {agent.use_web_knowledge && (
                      <Badge variant="outline" className="text-[10px] gap-1 text-blue-600">
                        <Globe className="h-3 w-3" />
                        Web
                      </Badge>
                    )}
                  </div>
                )}

                <Button
                  onClick={() => handleEditAgent(agent)}
                  variant="outline"
                  className="w-full rounded-xl border-border/50 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all gap-2"
                >
                  Configurar Agente
                  <ChevronRight className="h-4 w-4 opacity-50 group-hover:translate-x-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ────────────────────────────────────────────── */}
      {/* Agent Edit Sheet                              */}
      {/* ────────────────────────────────────────────── */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="pb-6 border-b">
            <SheetTitle className="text-2xl flex items-center gap-2">
              <Settings2 className="h-6 w-6 text-primary" />
              {selectedAgent?.origin === 'system' ? 'Configurar Agente de Sistema' : 'Editar Agente'}
            </SheetTitle>
            <SheetDescription>
              {selectedAgent?.origin === 'system'
                ? 'Configure modelo, conhecimento e comportamento do agente.'
                : 'Ajuste as diretrizes e a personalidade do seu atendente.'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSaveAgent} className="space-y-8 py-8">
            {/* ── Identity Section ── */}
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
            </div>

            {/* ── AI Runtime Section (System agents only) ── */}
            {selectedAgent?.origin === 'system' && (
              <>
                <Separator />
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <Cpu className="h-5 w-5 text-primary" />
                    Runtime IA
                  </div>

                  {/* Reasoning Mode */}
                  <div className="space-y-3">
                    <Label>Modo de Raciocínio</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {REASONING_MODES.map(mode => (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => setSelectedAgent(prev => prev ? {...prev, reasoning_mode: mode.value} : null)}
                          className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                            selectedAgent?.reasoning_mode === mode.value
                              ? 'border-primary bg-primary/5'
                              : 'border-border/50 hover:border-primary/30'
                          }`}
                        >
                          <span className="text-xl">{mode.icon}</span>
                          <div>
                            <div className="font-medium text-sm">{mode.label}</div>
                            <div className="text-xs text-muted-foreground">{mode.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Provider + Model */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Provedor</Label>
                      <Select
                        value={getProviderFromModel(selectedAgent?.model)}
                        onValueChange={provider => {
                          const firstModel = PROVIDER_MODELS[provider]?.models[0]?.value;
                          setSelectedAgent(prev => prev ? {...prev, provider, model: firstModel || prev.model} : null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PROVIDER_MODELS).map(([key, p]) => (
                            <SelectItem key={key} value={key}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Modelo</Label>
                      <Select
                        value={selectedAgent?.model || ""}
                        onValueChange={model => setSelectedAgent(prev => prev ? {...prev, model} : null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDER_MODELS[getProviderFromModel(selectedAgent?.model)]?.models.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Temperature */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4" />
                        Temperatura
                      </Label>
                      <span className="text-sm font-mono text-muted-foreground">
                        {(selectedAgent?.temperature ?? 0.7).toFixed(1)}
                      </span>
                    </div>
                    <Slider
                      value={[selectedAgent?.temperature ?? 0.7]}
                      onValueChange={([v]) => setSelectedAgent(prev => prev ? {...prev, temperature: v} : null)}
                      min={0}
                      max={2}
                      step={0.1}
                      className="py-2"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Determinístico</span>
                      <span>Criativo</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Voice Configuration Section (Only for voice-assistant) ── */}
            {selectedAgent?.slug === 'voice-assistant' && (
              <>
                <Separator />
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <Mic className="h-5 w-5 text-primary" />
                    Configurações de Voz (Athena Voice)
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="voice_id">Voz (ElevenLabs)</Label>
                      <Select 
                        value={(selectedAgent?.metadata?.voice_id as string) || 'pNInz6obpgmqEba59W96'} 
                        onValueChange={v => setSelectedAgent(prev => prev ? {...prev, metadata: {...prev.metadata, voice_id: v}} : null)}
                      >
                        <SelectTrigger id="voice_id">
                          <SelectValue placeholder="Selecione uma voz" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pNInz6obpgmqEba59W96">Adam (Masculino)</SelectItem>
                          <SelectItem value="21m00Tcm4TlvDq8ikWAM">Rachel (Feminino)</SelectItem>
                          <SelectItem value="AZnzlk1Xhk61Mc87G8I2">Antoni (Nativo)</SelectItem>
                          <SelectItem value="EXAVITQu4vr4xnSDxMaL">Bella (Suave)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wake_word">Palavra de Ativação</Label>
                      <Input
                        id="wake_word"
                        placeholder="Ex: athena"
                        value={(selectedAgent?.metadata?.wake_word as string) || ""}
                        onChange={e => setSelectedAgent(prev => prev ? {
                          ...prev, 
                          metadata: { ...prev.metadata, wake_word: e.target.value }
                        } : null)}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Estabilidade da Voz</Label>
                        <span className="text-xs font-mono">{((selectedAgent?.metadata?.stability as number) || 0.5).toFixed(2)}</span>
                      </div>
                      <Slider 
                        value={[(selectedAgent?.metadata?.stability as number) || 0.5]} 
                        min={0} max={1} step={0.05}
                        onValueChange={([v]) => setSelectedAgent(prev => prev ? {...prev, metadata: {...prev.metadata, stability: v}} : null)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Similaridade (Boost)</Label>
                        <span className="text-xs font-mono">{((selectedAgent?.metadata?.similarity_boost as number) || 0.75).toFixed(2)}</span>
                      </div>
                      <Slider 
                        value={[(selectedAgent?.metadata?.similarity_boost as number) || 0.75]} 
                        min={0} max={1} step={0.05}
                        onValueChange={([v]) => setSelectedAgent(prev => prev ? {...prev, metadata: {...prev.metadata, similarity_boost: v}} : null)}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Knowledge Sources Section (System agents only) ── */}
            {selectedAgent?.origin === 'system' && (
              <>
                <Separator />
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Fontes de Conhecimento
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                      <div className="flex items-center gap-3">
                        <Database className="h-5 w-5 text-blue-500" />
                        <div>
                          <div className="font-medium text-sm">Contexto do Sistema</div>
                          <div className="text-xs text-muted-foreground">Clientes, casos, documentos, workflows</div>
                        </div>
                      </div>
                      <Switch
                        checked={selectedAgent?.use_system_context ?? true}
                        onCheckedChange={v => setSelectedAgent(prev => prev ? {...prev, use_system_context: v} : null)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-emerald-500" />
                        <div>
                          <div className="font-medium text-sm">Conhecimento Privado</div>
                          <div className="text-xs text-muted-foreground">Livros, manuais, documentos internos (upload)</div>
                        </div>
                      </div>
                      <Switch
                        checked={selectedAgent?.use_private_knowledge ?? true}
                        onCheckedChange={v => setSelectedAgent(prev => prev ? {...prev, use_private_knowledge: v} : null)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-violet-500" />
                        <div>
                          <div className="font-medium text-sm">Conhecimento Web</div>
                          <div className="text-xs text-muted-foreground">Busca na internet em tempo real</div>
                        </div>
                      </div>
                      <Switch
                        checked={selectedAgent?.use_web_knowledge ?? false}
                        onCheckedChange={v => setSelectedAgent(prev => prev ? {...prev, use_web_knowledge: v} : null)}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Prompt Section ── */}
            <Separator />
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <MessageSquare className="h-5 w-5 text-primary" />
                Instruções
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
            </div>

            {/* ── Fallback Section ── */}
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

            {/* ── Test Chat (System agents only) ── */}
            {selectedAgent?.origin === 'system' && selectedAgent?.slug && (
              <>
                {!showTestChat ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 rounded-xl"
                    onClick={() => setShowTestChat(true)}
                  >
                    <FlaskConical className="h-4 w-4" />
                    Testar Agente (mesmo runtime de produção)
                  </Button>
                ) : (
                  <TestChatPanel agent={selectedAgent} onClose={() => setShowTestChat(false)} />
                )}
              </>
            )}

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
