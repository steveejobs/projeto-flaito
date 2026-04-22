import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Calendar, 
  MessageSquare, 
  User, 
  ArrowRight,
  TrendingUp,
  Clock,
  Archive,
  Trash2,
  RotateCcw,
  History,
  CheckCircle2,
  AlertCircle,
  Users
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { crmSyncService } from "@/services/crmSyncService";
import { LeadLifecycleService } from "@/services/leadLifecycleService";
import { LeadDeduplicationService, MatchType } from "@/services/leadDeduplicationService";

const STAGES = [
  { id: 'novo_contato', label: 'Novo Contato' },
  { id: 'qualificacao', label: 'Qualificação' },
  { id: 'briefing_agendado', label: 'Briefing Agendado' },
  { id: 'proposta_enviada', label: 'Proposta Enviada' },
  { id: 'fechado', label: 'Fechado' }
];

type LeadStatus = 'active' | 'archived' | 'trashed' | 'converted' | 'lost';

interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  pipeline_stage: string;
  source: string;
  notes: string;
  ai_summary: string;
  last_interaction_at: string;
  created_at: string;
  last_automation_reason?: string;
  purge_at?: string;
  last_automation_source?: string;
  duplicate_status?: string;
}

const CRMPage = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<LeadStatus>('active');
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [globalStats, setGlobalStats] = useState({
    active: 0,
    archived: 0,
    trashed: 0,
    converted: 0,
    total: 0,
    conversionRate: 0
  });

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { data: officeMember } = await supabase
        .from('office_members')
        .select('office_id')
        .eq('user_id', session.session.user.id)
        .single();

      if (!officeMember) return;

      // 1. Fetch leads para a aba atual
      const { data, error } = await supabase
        .from('crm_leads')
        .select('*')
        .eq('office_id', officeMember.office_id)
        .eq('status', currentStatus)
        .order('last_interaction_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);

      // 2. Fetch métricas globais para o header
      const { data: allLeads, error: statsError } = await supabase
        .from('crm_leads')
        .select('status, pipeline_stage')
        .eq('office_id', officeMember.office_id);

      if (!statsError && allLeads) {
        const active = allLeads.filter(l => l.status === 'active').length;
        const archived = allLeads.filter(l => l.status === 'archived').length;
        const trashed = allLeads.filter(l => l.status === 'trashed').length;
        const converted = allLeads.filter(l => l.status === 'converted').length;
        const closed = allLeads.filter(l => l.pipeline_stage === 'fechado').length;
        const reviewing = allLeads.filter(l => l.duplicate_status !== 'no_match' && l.status === 'active').length;
        const totalComercial = active + archived + converted;

        setGlobalStats({
          active,
          archived,
          trashed,
          converted,
          total: totalComercial,
          reviewing,
          conversionRate: totalComercial > 0 ? Math.round((closed / totalComercial) * 100) : 0
        });
      }
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
      toast.error("Erro ao carregar os leads do pipeline.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [currentStatus]);

  const handleSyncIA = async () => {
    try {
      setIsSyncing(true);
      const { data: officeMember } = await supabase
        .from('office_members')
        .select('office_id')
        .eq('user_id', user?.id)
        .single();

      if (!officeMember) return;

      await crmSyncService.applyAutomationRules(officeMember.office_id);
      await fetchLeads();
      toast.success("Sincronização de automações concluída!");
    } catch (error) {
      toast.error("Falha na sincronização automática.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleArchive = async (lead: Lead) => {
    try {
      const { data: officeMember } = await supabase
        .from('office_members')
        .select('office_id')
        .eq('user_id', user?.id)
        .single();
      
      if (!officeMember) return;
      await LeadLifecycleService.archiveLead(lead.id, officeMember.office_id);
      toast.success("Lead arquivado.");
      fetchLeads();
    } catch (error) {
      toast.error("Erro ao arquivar.");
    }
  };

  const handleTrash = async (lead: Lead) => {
    try {
      const { data: officeMember } = await supabase
        .from('office_members')
        .select('office_id')
        .eq('user_id', user?.id)
        .single();
      
      if (!officeMember) return;
      await LeadLifecycleService.trashLead(lead.id, officeMember.office_id);
      toast.success("Lead movido para lixeira.");
      fetchLeads();
    } catch (error) {
      toast.error("Erro ao remover.");
    }
  };

  const handleRestore = async (lead: Lead) => {
    try {
      const { data: officeMember } = await supabase
        .from('office_members')
        .select('office_id')
        .eq('user_id', user?.id)
        .single();
      
      if (!officeMember) return;
      await LeadLifecycleService.restoreLead(lead.id, officeMember.office_id);
      toast.success("Lead restaurado.");
      fetchLeads();
    } catch (error) {
      toast.error("Erro ao restaurar.");
    }
  };

  const handleConvertToClient = async (lead: Lead) => {
    try {
      const { data: officeMember } = await supabase
        .from('office_members')
        .select('office_id')
        .eq('user_id', user?.id)
        .single();
      
      if (!officeMember) return;
      await LeadLifecycleService.convertToClient(lead.id, officeMember.office_id);
      toast.success("Convertido em cliente!");
      fetchLeads();
      if (selectedLead?.id === lead.id) setSelectedLead(null);
    } catch (error) {
      toast.error("Erro na conversão.");
    }
  };

  const filteredLeads = leads.filter(lead => 
    lead.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone?.includes(searchTerm)
  );

  return (
    <div className="flex h-full bg-background/50 overflow-hidden relative max-w-full">
      <div className={`flex flex-col flex-1 transition-all duration-500 min-w-0 ${selectedLead ? 'lg:mr-[450px]' : ''}`}>
        <header className="border-b border-white/5 px-8 py-6 flex flex-col gap-6 bg-background/40 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-2xl font-bold tracking-tight">CRM Inteligente</h1>
              <div className="flex bg-muted/30 p-1 rounded-xl border border-white/5">
                <Button variant={currentStatus === 'active' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg h-8 text-xs font-semibold px-4" onClick={() => setCurrentStatus('active')}> Ativos </Button>
                <Button variant={currentStatus === 'archived' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg h-8 text-xs font-semibold px-4" onClick={() => setCurrentStatus('archived')}> Arquivados </Button>
                <Button variant={currentStatus === 'trashed' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg h-8 text-xs font-semibold px-4" onClick={() => setCurrentStatus('trashed')}> 
                  Lixeira {globalStats.trashed > 0 && <Badge className="ml-2 h-4 min-w-4 p-0 flex items-center justify-center bg-destructive text-[9px]">{globalStats.trashed}</Badge>}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input placeholder="Buscar leads..." className="pl-10 bg-white/5 border-white/10 h-11 rounded-xl focus:ring-primary/20" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <Button variant="outline" className="gap-2 border-white/10 hover:bg-white/5 h-11 rounded-xl px-4" onClick={handleSyncIA} disabled={isSyncing}>
                <RotateCcw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sincronizar</span>
              </Button>
              <Button onClick={() => setIsNewLeadOpen(true)} className="gap-2 bg-primary hover:bg-primary/90 h-11 px-5 rounded-xl shadow-lg shadow-primary/20 font-bold">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo Lead</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard label="Ativos" value={globalStats.active} icon={Users} color="text-primary" />
            <MetricCard label="Taxa Conversão" value={`${globalStats.conversionRate}%`} icon={TrendingUp} color="text-emerald-500" />
            <MetricCard label="Em Revisão" value={globalStats.reviewing || 0} icon={AlertCircle} color={globalStats.reviewing > 0 ? "text-amber-500" : "text-blue-500"} />
            <MetricCard label="Na Lixeira" value={globalStats.trashed} icon={Trash2} color="text-destructive" />
          </div>
        </header>

        <div className="flex-1 p-6 overflow-hidden max-w-full">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="w-full h-full overflow-x-auto overflow-y-hidden pb-6 custom-scrollbar scroll-smooth pr-10">
              <div className="flex gap-6 h-full min-w-max">
                {STAGES.map((stage) => (
                  <div key={stage.id} className="w-[320px] flex flex-col group">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground/80 group-hover:text-foreground transition-colors uppercase tracking-wider">{stage.label}</h3>
                        <Badge variant="secondary" className="bg-white/5 text-[10px] h-5 px-1.5 rounded-md font-black">
                          {filteredLeads.filter(l => l.pipeline_stage === stage.id).length}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex-1 bg-white/[0.01] rounded-2xl border border-white/5 p-3 space-y-3 overflow-y-auto custom-scrollbar group-hover:bg-white/[0.03] transition-all duration-300">
                      {filteredLeads
                        .filter(lead => lead.pipeline_stage === stage.id)
                        .map(lead => (
                          <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} onArchive={() => handleArchive(lead)} onTrash={() => handleTrash(lead)} onRestore={() => handleRestore(lead)} />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedLead && (
        <SidePanel lead={selectedLead} onClose={() => setSelectedLead(null)} onConvert={() => handleConvertToClient(selectedLead)} onArchive={() => handleArchive(selectedLead)} onTrash={() => handleTrash(selectedLead)} />
      )}

      {isNewLeadOpen && (
        <NewLeadModal onClose={() => setIsNewLeadOpen(false)} onSuccess={() => { setIsNewLeadOpen(false); fetchLeads(); }} />
      )}
    </div>
  );
};

const MetricCard = ({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: string }) => (
  <Card className="bg-white/[0.02] border-white/5 shadow-none group hover:bg-white/[0.04] transition-all cursor-default">
    <CardContent className="p-4 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-xl font-black ${color}`}>{value}</p>
      </div>
      <div className={`p-2 rounded-xl bg-white/5 ${color} opacity-40 group-hover:opacity-100 transition-opacity`}>
        <Icon className="h-5 w-5" />
      </div>
    </CardContent>
  </Card>
);

const NewLeadModal = ({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', email: '', phone: '', source: 'Direto' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { data: officeMember } = await supabase.from('office_members').select('office_id').eq('user_id', user?.id).single();
      if (!officeMember) return;

      const { data: newLead, error } = await supabase
        .from('crm_leads')
        .insert({
          ...formData,
          office_id: officeMember.office_id,
          pipeline_stage: 'novo_contato',
          status: 'active'
        })
        .select('id')
        .single();

      if (error) throw error;

      // Executa deduplicação em tempo real
      const matches = await LeadDeduplicationService.checkDuplicity(officeMember.office_id, formData);
      if (matches.length > 0 && newLead) {
        await LeadDeduplicationService.persistMatches(officeMember.office_id, newLead.id, matches);
        toast.info("Atenção: Possíveis duplicidades detectadas.");
      } else {
        toast.success("Lead criado!");
      }

      onSuccess();
    } catch (error) {
      toast.error("Erro ao criar lead.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-white/10 shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xl font-bold">Novo Lead</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"> <Plus className="h-5 w-5 rotate-45" /> </Button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground">Nome Completo</label>
            <Input required value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="bg-white/5 border-white/10" placeholder="Nome do Lead" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">WhatsApp</label>
              <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="bg-white/5 border-white/10" placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Origem</label>
              <Input value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} className="bg-white/5 border-white/10" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground">E-mail</label>
            <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-white/5 border-white/10" />
          </div>
          <Button type="submit" className="w-full h-12 rounded-xl font-bold" disabled={loading}> {loading ? "Salvando..." : "Criar Lead"} </Button>
        </form>
      </Card>
    </div>
  );
};

const LeadCard = ({ lead, onClick, onArchive, onTrash, onRestore }: { lead: Lead, onClick: () => void, onArchive: () => void, onTrash: () => void, onRestore: () => void }) => (
  <Card className="group relative bg-card/40 border-white/5 hover:border-primary/30 hover:bg-card/60 transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-sm" onClick={onClick}>
    <div className={`absolute left-0 top-0 bottom-0 w-1 ${lead.status === 'active' ? 'bg-primary/40' : 'bg-muted/40'}`} />
    <CardContent className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0 pr-6">
          <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{lead.full_name}</h4>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="outline" className="text-[9px] uppercase h-4 border-white/10 bg-white/5 text-muted-foreground">#{lead.id.slice(0, 4)}</Badge>
            <Badge variant="outline" className="text-[9px] uppercase h-4 border-white/10 bg-white/5 text-muted-foreground">{lead.source}</Badge>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {lead.duplicate_status === 'duplicate_probable' && (
              <Badge className="bg-destructive/20 text-destructive border-destructive/20 text-[8px] h-4 font-black">DUPLICADO PROVÁVEL</Badge>
            )}
            {lead.duplicate_status === 'existing_client_other_case' && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/20 text-[8px] h-4 font-black">MESMO CLIENTE</Badge>
            )}
            {lead.duplicate_status === 'review_required' && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/20 text-[8px] h-4 font-black">REVISÃO NECESSÁRIA</Badge>
            )}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-white/10"> <MoreHorizontal className="h-4 w-4" /> </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-xl border-white/10 rounded-xl">
              {lead.status === 'active' ? (
                <>
                  <DropdownMenuItem onClick={onArchive} className="gap-2"> <Archive className="h-4 w-4 text-primary" /> Arquivar </DropdownMenuItem>
                  <DropdownMenuItem onClick={onTrash} className="gap-2 text-destructive"> <Trash2 className="h-4 w-4" /> Lixeira </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={onRestore} className="gap-2"> <RotateCcw className="h-4 w-4 text-primary" /> Restaurar </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {lead.last_automation_reason && (
        <div className="mb-3 p-2.5 bg-primary/5 border border-primary/10 rounded-xl flex items-start gap-2.5">
          <Badge className="h-4 w-4 p-0 flex items-center justify-center bg-primary rounded-full"> <TrendingUp className="h-2 w-2 text-white" /> </Badge>
          <p className="text-[11px] leading-relaxed text-foreground/70 font-medium"> <span className="text-primary font-bold mr-1">Automação:</span> {lead.last_automation_reason} </p>
        </div>
      )}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground"> <Clock className="h-3 w-3" /> {new Date(lead.last_interaction_at).toLocaleDateString('pt-BR')} </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground"> <MessageSquare className="h-3 w-3" /> 4 </div>
      </div>
    </CardContent>
  </Card>
);

const SidePanel = ({ lead, onClose, onConvert, onArchive, onTrash }: { lead: Lead, onClose: () => void, onConvert: () => void, onArchive: () => void, onTrash: () => void }) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      const [actResp, matchResp] = await Promise.all([
        supabase.from('crm_activities').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }),
        supabase.from('crm_lead_matches').select('*, matched_lead:crm_leads(*), matched_client:clients(*)').eq('lead_id', lead.id)
      ]);
      setActivities(actResp.data || []);
      setMatches(matchResp.data || []);
    };
    fetchData();
  }, [lead.id]);

  const handleConvertToClientLocal = async () => {
    if (lead.duplicate_status === 'duplicate_probable') {
      const confirm = window.confirm("ATENÇÃO: Este lead é uma duplicidade provável. Deseja realmente convertê-lo e criar um novo registro de cliente?");
      if (!confirm) return;
    }
    onConvert();
  };

  const handleDismissMatch = async (matchId: string) => {
    if (!user) return;
    await LeadDeduplicationService.dismissMatch(lead.office_id as any, matchId, user.id);
    toast.success("Duplicidade descartada.");
    setMatches(prev => prev.filter(m => m.id !== matchId));
  };

  return (
    <div className="fixed top-0 right-0 h-screen w-full lg:w-[450px] bg-background/95 backdrop-blur-2xl border-l border-white/5 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-500">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/20"> <User className="h-5 w-5 text-primary" /> </div>
          <div> <h2 className="text-lg font-bold">{lead.full_name}</h2> <p className="text-xs text-muted-foreground">Criado em {new Date(lead.created_at).toLocaleDateString()}</p> </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"> <Plus className="h-5 w-5 rotate-45" /> </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Ações Estratégicas</h3>
          {lead.duplicate_status === 'duplicate_probable' && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-[11px] font-bold text-destructive leading-tight">Duplicidade detectada! Revise os registros relacionados antes de converter.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleConvertToClientLocal} className="gap-2 bg-primary hover:bg-primary/90 h-11 rounded-xl shadow-lg shadow-primary/10"> <CheckCircle2 className="h-4 w-4" /> Converter </Button>
            <Button variant="outline" className="gap-2 border-white/10 hover:bg-white/5 h-11 rounded-xl" onClick={onArchive}> <Archive className="h-4 w-4" /> Arquivar </Button>
            <Button variant="ghost" className="gap-2 hover:bg-destructive/5 text-destructive/80 h-11 rounded-xl col-span-2" onClick={onTrash}> <Trash2 className="h-4 w-4" /> Lixeira </Button>
          </div>
        </section>
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-12 bg-white/5 p-1 rounded-xl border border-white/5">
            <TabsTrigger value="info" className="rounded-lg">Dados</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg">Histórico</TabsTrigger>
            <TabsTrigger value="intelligence" className="rounded-lg">Insights</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1"> <p className="text-[10px] font-bold text-muted-foreground uppercase">Telefone</p> <p className="text-sm font-semibold">{lead.phone || 'N/A'}</p> </div>
              <div className="space-y-1"> <p className="text-[10px] font-bold text-muted-foreground uppercase">E-mail</p> <p className="text-sm font-semibold truncate">{lead.email || 'N/A'}</p> </div>
              <div className="space-y-1"> <p className="text-[10px] font-bold text-muted-foreground uppercase">Origem</p> <Badge variant="secondary" className="text-[10px]">{lead.source}</Badge> </div>
              <div className="space-y-1"> <p className="text-[10px] font-bold text-muted-foreground uppercase">Última Interação</p> <div className="flex items-center gap-1.5 text-sm font-semibold"> <Clock className="h-3.5 w-3.5 text-primary" /> {new Date(lead.last_interaction_at).toLocaleDateString()} </div> </div>
            </div>
            <div className="space-y-3"> <p className="text-[10px] font-bold text-muted-foreground uppercase">Anotações</p> <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-sm leading-relaxed italic"> {lead.notes || "Sem anotações."} </div> </div>
          </TabsContent>
          <TabsContent value="history" className="mt-6">
            <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-white/5">
              {activities.map((activity) => (
                <div key={activity.id} className="relative pl-10 group">
                  <div className={`absolute left-0 top-1 h-6 w-6 rounded-full border-4 border-background flex items-center justify-center ${activity.activity_type === 'automation_move' ? 'bg-primary' : 'bg-muted'}`}> <History className="h-2.5 w-2.5 text-background" /> </div>
                  <div className="space-y-1"> <p className="text-sm font-bold text-foreground/90">{activity.description}</p> <p className="text-[10px] text-muted-foreground">{new Date(activity.created_at).toLocaleString('pt-BR')}</p> </div>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="intelligence" className="mt-6">
            <Card className="bg-primary/5 border-primary/20 p-4">
              <h4 className="font-bold text-sm text-primary mb-2">Contexto Analítico</h4>
              <p className="text-sm leading-relaxed">{lead.last_automation_reason || "Aguardando interações do sistema."}</p>
            </Card>

            {matches.length > 0 && (
              <div className="mt-8 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" /> Registros Relacionados
                </h4>
                <div className="space-y-3">
                  {matches.map(match => (
                    <div key={match.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge variant="outline" className="text-[9px] mb-1">
                            {match.match_type === 'duplicate_probable' ? 'Possível Duplicata' : 'Mesmo Cliente'}
                          </Badge>
                          <p className="text-sm font-bold">{match.matched_lead?.full_name || match.matched_client?.full_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-primary">{match.score}% match</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 h-8 text-[10px] rounded-lg" onClick={() => handleDismissMatch(match.id)}>Ignorar</Button>
                        <Button variant="secondary" size="sm" className="flex-1 h-8 text-[10px] rounded-lg">Abrir Registro</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CRMPage;
