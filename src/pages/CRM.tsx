import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Users, 
  Calendar, 
  TrendingUp, 
  Clock, 
  MoreHorizontal, 
  Plus,
  Search,
  Filter,
  ArrowRight,
  Activity,
  RefreshCw,
  AlertCircle,
  X,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from "@/integrations/supabase/client";
import { crmSyncService, STAGES, PipelineStage } from "@/services/crmSyncService";
import { WhatsAppTimeline } from "@/components/crm/WhatsAppTimeline";
import { toast } from "sonner";

// --- Types ---
interface Lead {
  id: string;
  full_name: string;
  pipeline_stage: PipelineStage;
  source: string;
  last_interaction_at: string;
  phone?: string;
  ai_summary?: string;
  value?: string;
}

interface ActivityLog {
  id: string;
  lead_name: string;
  activity_type: string;
  description: string;
  created_at: string;
}

const STAGE_CONFIG: { id: PipelineStage; label: string; color: string }[] = [
  { id: 'novo_contato', label: 'Novo Contato', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { id: 'qualificacao', label: 'Qualificação', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  { id: 'briefing_agendado', label: 'Briefing Agendado', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  { id: 'proposta_enviada', label: 'Proposta Enviada', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
  { id: 'fechado', label: 'Fechado', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
];

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Detalhes do Lead
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [whatsappMessages, setWhatsappMessages] = useState<any[]>([]);
  const [whatsappConv, setWhatsappConv] = useState<any>(null);
  
  const officeId = sessionStorage.getItem('lexos_office_id');

  const fetchData = async () => {
    if (!officeId) return;
    try {
      setLoading(true);
      
      const { data: leadsData, error: leadsError } = await supabase
        .from('crm_leads' as any)
        .select('*')
        .eq('office_id', officeId)
        .order('updated_at', { ascending: false });

      if (!leadsError) setLeads(leadsData || []);

      const { data: actsData } = await supabase
        .from('crm_activities' as any)
        .select(`id, activity_type, description, created_at, crm_leads (full_name)`)
        .eq('office_id', officeId)
        .order('created_at', { ascending: false })
        .limit(20);

      setActivities(actsData?.map((a: any) => ({
        ...a,
        lead_name: a.crm_leads?.full_name || 'Desconhecido'
      })) || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadDetails = async (lead: Lead) => {
    setSelectedLead(lead);
    
    // Buscar conversa de WhatsApp
    const { data: conv } = await supabase
      .from('whatsapp_conversations' as any)
      .select('*')
      .eq('lead_id', lead.id)
      .maybeSingle();
      
    setWhatsappConv(conv);

    if (conv) {
      const { data: messages } = await supabase
        .from('whatsapp_messages' as any)
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });
      
      setWhatsappMessages(messages || []);
    } else {
      setWhatsappMessages([]);
    }
  };

  const handleSync = async () => {
    if (!officeId) return;
    setSyncing(true);
    toast.info("Iniciando orquestração autônoma...");
    await crmSyncService.applyAutomationRules(officeId);
    await fetchData();
    setSyncing(false);
    toast.success("CRM Sincronizado!");
  };

  useEffect(() => {
    fetchData();
    handleSync();
  }, [officeId]);

  const filteredLeads = leads.filter(l => 
    l.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.source?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-full bg-background/50 overflow-hidden relative">
      <div className={`flex flex-col flex-1 transition-all duration-500 ${selectedLead ? 'lg:mr-[400px]' : ''}`}>
        {/* Header Premium */}
        <div className="p-6 pb-2 border-b bg-background/30 backdrop-blur-xl sticky top-0 z-10 transition-all">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                <span className="p-2 rounded-xl bg-primary/10 text-primary shadow-inner">
                  <Sparkles className="h-6 w-6" />
                </span>
                CRM Inteligente
              </h1>
              <p className="text-muted-foreground mt-1">Pipeline autônomo e orquestração baseada em IA.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2 bg-background/50" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Sincronizar IA
              </Button>
              <Button className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all font-bold">
                <Plus className="h-4 w-4" /> Novo Lead
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard title="Leads Ativos" value={leads.length.toString()} subValue="Base auditada" icon={Users} color="primary" />
            <MetricCard title="Aguardando Agenda" value={leads.filter(l => l.pipeline_stage === 'qualificacao').length.toString()} subValue="Potencial conversão" icon={Calendar} color="orange" />
            <MetricCard title="Conversas IA" value={activities.length.toString()} subValue="Interações registradas" icon={MessageSquare} color="purple" />
            <MetricCard title="Conversão" value="--" subValue="Processando BI..." icon={TrendingUp} color="green" />
          </div>

          <div className="flex items-center gap-4 mt-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nome ou origem..." 
                className="pl-9 bg-muted/30 border-primary/5 focus:border-primary/20 transition-all shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Tabs defaultValue="pipeline" className="w-auto">
              <TabsList className="bg-muted/30 border border-primary/5 p-1">
                <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                <TabsTrigger value="history">Atividades IA</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-hidden">
          {loading && leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin opacity-20" />
              <p className="text-sm font-medium animate-pulse">Invocando agentes de orquestração...</p>
            </div>
          ) : (
            <Tabs defaultValue="pipeline" className="h-full flex flex-col">
              <TabsContent value="pipeline" className="flex-1 mt-0 outline-none">
                <ScrollArea className="w-full h-full pb-8" orientation="horizontal">
                  <div className="flex gap-6 h-full min-h-[500px]">
                    {STAGE_CONFIG.map((stage) => (
                      <CRMColumn 
                        key={stage.id} 
                        stage={stage} 
                        leads={filteredLeads.filter(l => l.pipeline_stage === stage.id)}
                        onLeadClick={fetchLeadDetails}
                        selectedId={selectedLead?.id}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="history" className="mt-0 outline-none">
                 <div className="max-w-4xl mx-auto space-y-4">
                    {activities.map((activity) => <ActivityItem key={activity.id} activity={activity} />)}
                 </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Side Panel: Detalhes e WhatsApp */}
      <div className={`fixed right-0 top-0 h-full w-full sm:w-[400px] border-l bg-background/95 lg:bg-background/80 backdrop-blur-xl shadow-2xl z-[60] transition-transform duration-500 transform ${selectedLead ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b flex items-center justify-between bg-muted/20">
            <h3 className="font-black text-sm uppercase tracking-widest">Detalhes do Lead</h3>
            <Button variant="ghost" size="icon" onClick={() => setSelectedLead(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedLead && (
              <>
                <div className="p-6 pb-0">
                  <h2 className="text-xl font-black tracking-tight">{selectedLead.full_name}</h2>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-[10px] uppercase font-bold">{selectedLead.source}</Badge>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary">{selectedLead.pipeline_stage.replace('_', ' ')}</Badge>
                  </div>
                  {selectedLead.ai_summary && (
                    <div className="mt-4 p-3 bg-primary/5 rounded-2xl border border-primary/10 flex gap-2">
                       <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                       <p className="text-[11px] font-medium leading-relaxed italic">{selectedLead.ai_summary}</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 p-4 mt-4 overflow-hidden flex flex-col">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-4 px-2">Timeline WhatsApp Inteligente</h4>
                  <div className="flex-1 overflow-hidden">
                    <WhatsAppTimeline 
                       messages={whatsappMessages} 
                       status={whatsappConv?.status || 'active'} 
                       leadName={selectedLead.full_name} 
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Subcomponents ---

function MetricCard({ title, value, subValue, icon: Icon, color }: any) {
  const colorMap: any = {
    primary: "text-primary bg-primary/10",
    orange: "text-orange-500 bg-orange-500/10",
    green: "text-green-500 bg-green-500/10",
    purple: "text-purple-500 bg-purple-500/10",
  };

  return (
    <Card className="bg-background/40 border-primary/5 shadow-sm overflow-hidden hover:bg-background/60 transition-all group relative">
      <CardContent className="p-4 flex items-center gap-4 relative z-10">
        <div className={`p-3 rounded-xl transition-all duration-500 group-hover:scale-110 shadow-sm border ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
          <p className="text-2xl font-black tracking-tighter">{value}</p>
          <p className="text-[10px] font-bold text-primary/70 mt-0.5">{subValue}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CRMColumn({ stage, leads, onLeadClick, selectedId }: { stage: any, leads: Lead[], onLeadClick: (l: Lead) => void, selectedId?: string }) {
  return (
    <div className="flex flex-col w-[300px] shrink-0 h-full group/column">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`px-2 py-0.5 font-bold uppercase text-[10px] shadow-sm border ${stage.color}`}>
            {stage.label}
          </Badge>
          <span className="text-xs font-black text-muted-foreground/40 leading-none">{leads.length}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover/column:opacity-100 transition-opacity">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 bg-muted/10 border border-primary/5 rounded-3xl p-2 pb-10">
        <div className="space-y-3">
          {leads.map((lead) => (
            <CRMCard 
              key={lead.id} 
              lead={lead} 
              color={stage.color} 
              onClick={() => onLeadClick(lead)}
              isSelected={selectedId === lead.id}
            />
          ))}
          {leads.length === 0 && (
            <div className="h-32 border-2 border-dashed border-muted/30 flex flex-col items-center justify-center rounded-2xl p-4 text-center opacity-40">
              <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Vazio</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function CRMCard({ lead, color, onClick, isSelected }: { lead: Lead, color: string, onClick: () => void, isSelected: boolean }) {
  return (
    <Card 
      className={`bg-card border shadow-sm hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-300 cursor-pointer group overflow-hidden ${isSelected ? 'border-primary ring-2 ring-primary/20 scale-[0.98]' : 'border-primary/5'}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-muted-foreground/30 group-hover:text-primary transition-colors uppercase tracking-tighter">
            #{lead.id.slice(0, 4)}
          </span>
          <MessageSquare className={`h-3 w-3 ${lead.source === 'WhatsApp' ? 'text-emerald-500' : 'text-blue-500 opacity-20'}`} />
        </div>
        
        <h3 className="text-[14px] font-black leading-tight mb-2 tracking-tight group-hover:text-primary transition-colors">{lead.full_name}</h3>
        <Badge variant="secondary" className="bg-muted text-[9px] px-1.5 py-0 font-bold uppercase tracking-tighter mb-4">{lead.source}</Badge>

        {lead.ai_summary && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-2.5 mb-3 flex items-start gap-2.5">
            <Sparkles className="h-3 w-3 text-primary mt-0.5 shrink-0 animate-pulse" />
            <p className="text-[10px] leading-snug line-clamp-2 text-primary/80 font-bold italic">{lead.ai_summary}</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-1 pt-3 border-t border-muted/30">
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/60 font-black tracking-widest uppercase">
            <Clock className="h-3 w-3" />
            {new Date(lead.last_interaction_at || Date.now()).toLocaleDateString('pt-BR')}
          </div>
          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black border border-primary/5">
             {lead.full_name.charAt(0)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityItem({ activity }: { activity: ActivityLog }) {
  return (
    <div className="flex gap-4 p-5 rounded-3xl border border-primary/5 bg-card/40 hover:bg-card hover:shadow-xl transition-all duration-500 group">
       <div className={`mt-1 p-3 rounded-2xl h-fit ${activity.activity_type.includes('whatsapp') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
         {activity.activity_type.includes('whatsapp') ? <MessageSquare className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
       </div>
       <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-sm tracking-tight">{activity.lead_name}</h4>
            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
              {new Date(activity.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed font-medium">{activity.description}</p>
       </div>
    </div>
  );
}
