import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Users, Pencil, Search, X,
  ChevronLeft, ChevronRight, FileText, Scale, History, Briefcase, Plus, Sparkles, Wand2
} from 'lucide-react';
import { ClickablePhone } from '@/components/ui/clickable-phone';
import { ClickableEmail } from '@/components/ui/clickable-email';
import { ClientHeader, type TabValue } from '@/components/clients';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import {
  ClientFormDialog,
  ClientCasesPanel,
  ClientDataPanel,
  ClientDocumentKit,
  ClientFilesCard,
  ClientProtocolDownload,
} from '@/features/clients';
import { LexosTimeline } from '@/components/LexosTimeline';
import { WhatsAppTab } from '@/modules/medicina/pacientes/components/WhatsAppTab';
import { ClientAgentPanel } from '@/components/clients/ClientAgentPanel';
import { DocumentGenerator } from '@/components/documents/DocumentGenerator';
import { UnifiedTimeline } from '@/components/UnifiedTimeline';

type Client = Tables<'clients'>;

type PersonTypeFilter = 'all' | 'PF' | 'PJ';
type StatusFilter = 'all' | 'active' | 'archived';

const PAGE_SIZE = 20;

export default function Clientes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Stable userId for deps
  const userId = user?.id ?? null;

  // Data state
  const [clients, setClients] = useState<Client[]>([]);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Selection state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Filters and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [personTypeFilter, setPersonTypeFilter] = useState<PersonTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [currentPage, setCurrentPage] = useState(1);

  // Active tab in detail panel
  const [activeTab, setActiveTab] = useState<TabValue>('dados');

  // Prevent concurrent fetches
  const inFlightRef = useRef(false);
  const fetchCountRef = useRef(0);

  const fetchClients = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    fetchCountRef.current += 1;

    try {
      setLoading(true);
      const { data: memberData, error: memberError } = await supabase
        .from('office_members')
        .select('office_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!memberData) {
        setError('Você não está vinculado a nenhum escritório');
        return;
      }

      setOfficeId(memberData.office_id);

      let query = supabase
        .from('clients')
        .select('*')
        .eq('office_id', memberData.office_id)
        .order('created_at', { ascending: false });

      if (statusFilter === 'active') {
        query = query.eq('status', 'active').is('deleted_at', null);
      } else if (statusFilter === 'archived') {
        query = query.or('status.eq.archived,deleted_at.not.is.null');
      }

      const { data: clientsData, error: clientsError } = await query;
      if (clientsError) throw clientsError;
      setClients(clientsData || []);
    } catch (err) {
      console.error('[Clientes] Erro ao carregar:', err);
      setError('Erro ao carregar clientes');
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [userId, statusFilter]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchClients();
  }, [userId, fetchClients]);

  // Filter clients based on search and person type
  const filteredClients = useMemo(() => {
    let result = clients;
    if (personTypeFilter !== 'all') {
      result = result.filter((c) => c.person_type === personTypeFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((client) => {
        const nameMatch = client.full_name?.toLowerCase().includes(query);
        const cpfMatch = client.cpf?.replace(/\D/g, '').includes(query.replace(/\D/g, ''));
        return nameMatch || cpfMatch;
      });
    }
    return result;
  }, [clients, searchQuery, personTypeFilter]);

  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE);
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredClients.slice(start, start + PAGE_SIZE);
  }, [filteredClients, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, personTypeFilter, statusFilter]);

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setActiveTab('dados');
  };

  const handleClientSaved = (client: Client, isNew: boolean) => {
    if (isNew) {
      setClients((prev) => [client, ...prev]);
      toast({ title: 'Cliente cadastrado', description: `${client.full_name} foi adicionado com sucesso.` });
    } else {
      setClients((prev) => prev.map((c) => (c.id === client.id ? client : c)));
      if (selectedClient?.id === client.id) setSelectedClient(client);
      toast({ title: 'Cliente atualizado', description: `Os dados de ${client.full_name} foram atualizados.` });
    }
  };

  const handleClientArchived = async () => {
    setSelectedClient(null);
    await fetchClients();
  };

  const handleClientDeleted = () => {
    if (selectedClient) {
      setClients((prev) => prev.filter((c) => c.id !== selectedClient.id));
      setSelectedClient(null);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] gap-0 lg:gap-4 overflow-hidden">
      {/* Left Column - Client List */}
      <div className={`w-full lg:w-1/3 xl:w-1/4 flex flex-col border-r border-border ${selectedClient ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold text-foreground">Clientes</h1>
            <Button onClick={() => { setEditingClient(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Novo
            </Button>
            <ClientFormDialog
              officeId={officeId}
              userId={user?.id || null}
              editingClient={editingClient}
              onClientSaved={handleClientSaved}
              onClose={() => setDialogOpen(false)}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {paginatedClients.map((client) => (
              <div
                key={client.id}
                onClick={() => handleSelectClient(client)}
                className={`p-3 cursor-pointer hover:bg-accent/50 ${selectedClient?.id === client.id ? 'bg-accent' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{client.full_name}</span>
                  <Badge variant="outline" className="text-[9px]">{client.person_type}</Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right Column - Client Detail */}
      <div className={`flex-1 flex flex-col overflow-hidden ${selectedClient ? 'flex' : 'hidden lg:flex'}`}>
        {selectedClient && officeId ? (
          <>
            <ClientHeader
              client={selectedClient}
              showBackButton
              onBack={() => setSelectedClient(null)}
              onEdit={() => { setEditingClient(selectedClient); setDialogOpen(true); }}
              onArchived={handleClientArchived}
              onDeleted={handleClientDeleted}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              casesCount={0}
              docsCount={0}
              filesCount={0}
              timelineCount={0}
              extraActions={
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 border-primary/20 text-primary shadow-sm hover:bg-primary/5"
                  onClick={() => setIsGeneratorOpen(true)}
                >
                  <Wand2 className="h-4 w-4" />
                  Gerar Peça
                </Button>
              }
            />

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <TabsContent value="dados" className="p-4 m-0">
                  <ClientDataPanel client={selectedClient} />
                </TabsContent>
                <TabsContent value="casos" className="p-4 m-0">
                   <ClientCasesPanel clientId={selectedClient.id} />
                </TabsContent>
                <TabsContent value="timeline_360" className="p-4 m-0">
                   <UnifiedTimeline clientId={selectedClient.id} />
                </TabsContent>
                <TabsContent value="whatsapp" className="p-4 m-0">
                  <WhatsAppTab clientId={selectedClient.id} patientName={selectedClient.full_name || 'Cliente'} patientPhone={selectedClient.phone || ''} resourceType="CLIENTE" />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
            <div className="text-center">
              <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p>Selecione um cliente para visualizar</p>
            </div>
          </div>
        )}
      </div>

      <DocumentGenerator 
        open={isGeneratorOpen} 
        onOpenChange={setIsGeneratorOpen} 
        clientId={selectedClient?.id}
        vertical="LEGAL"
      />
    </div>
  );
}
