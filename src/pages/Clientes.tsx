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
  ChevronLeft, ChevronRight, FileText, Scale, History, Briefcase, Plus, Sparkles
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
      if (import.meta.env.DEV) console.debug("[Clientes] skip fetch: !userId");
      setLoading(false);
      return;
    }
    if (inFlightRef.current) {
      if (import.meta.env.DEV) console.debug("[Clientes] skip fetch: already in flight");
      return;
    }

    inFlightRef.current = true;
    fetchCountRef.current += 1;
    const fetchNum = fetchCountRef.current;

    let watchdog: number | undefined;

    try {
      setLoading(true);
      if (import.meta.env.DEV) console.debug("[Clientes] fetch start", { userId, fetchNum, statusFilter });

      if (import.meta.env.DEV) {
        watchdog = window.setTimeout(() => {
          console.warn("[Clientes] watchdog: forcing loading=false after 10s", { fetchNum });
          setLoading(false);
          inFlightRef.current = false;
        }, 10000);
      }

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
        // Prefer new status column; keep deleted_at as legacy safety
        query = query.eq('status', 'active').is('deleted_at', null);
      } else if (statusFilter === 'archived') {
        // Archived clients may be marked via status or legacy deleted_at
        query = query.or('status.eq.archived,deleted_at.not.is.null');
      }

      const { data: clientsData, error: clientsError } = await query;

      if (clientsError) throw clientsError;

      setClients(clientsData || []);
      if (import.meta.env.DEV) console.debug("[Clientes] fetch end", { fetchNum, count: clientsData?.length });
    } catch (err) {
      console.error('[Clientes] Erro ao carregar:', err);
      setError('Erro ao carregar clientes');
    } finally {
      setLoading(false);
      inFlightRef.current = false;
      if (watchdog) window.clearTimeout(watchdog);
    }
  }, [userId, statusFilter]);

  if (import.meta.env.DEV) console.debug("[PAGE STATE]", { page: "Clientes", userId, loading, fetchCount: fetchCountRef.current });

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchClients();
  }, [userId, fetchClients]);

  // Auto-open dialog when ?new=true is in URL
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setDialogOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Realtime subscription for new clients
  useEffect(() => {
    if (!officeId) return;

    const channel = supabase
      .channel('clientes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'clients',
          filter: `office_id=eq.${officeId}`
        },
        (payload) => {
          const newClient = payload.new as Client;

          // Add new client to the top of the list (avoid duplicates)
          setClients(prev => {
            const exists = prev.some(c => c.id === newClient.id);
            if (exists) return prev;
            return [newClient, ...prev];
          });

          toast({
            title: 'Novo cliente cadastrado!',
            description: `${newClient.full_name} foi adicionado via captação online.`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [officeId, toast]);

  // Filter clients based on search and person type
  const filteredClients = useMemo(() => {
    let result = clients;

    // Person type filter
    if (personTypeFilter !== 'all') {
      result = result.filter((c) => c.person_type === personTypeFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((client) => {
        const nameMatch = client.full_name?.toLowerCase().includes(query);
        const cpfMatch = client.cpf?.replace(/\D/g, '').includes(query.replace(/\D/g, ''));
        const cnpjMatch = client.cnpj?.replace(/\D/g, '').includes(query.replace(/\D/g, ''));
        const phoneMatch = client.phone?.replace(/\D/g, '').includes(query.replace(/\D/g, ''));
        return nameMatch || cpfMatch || cnpjMatch || phoneMatch;
      });
    }

    return result;
  }, [clients, searchQuery, personTypeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE);
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredClients.slice(start, start + PAGE_SIZE);
  }, [filteredClients, currentPage]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, personTypeFilter, statusFilter]);

  const formatDocument = (client: Client) => {
    if (client.person_type === 'PF' && client.cpf) return `CPF: ${client.cpf}`;
    if (client.person_type === 'PJ' && client.cnpj) return `CNPJ: ${client.cnpj}`;
    return '—';
  };

  const openEditDialog = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleClientSaved = (client: Client, isNew: boolean) => {
    if (isNew) {
      // Verificar se cliente já existe para evitar duplicação
      setClients((prev) => {
        const exists = prev.some((c) => c.id === client.id);
        if (exists) {
          return prev.map((c) => (c.id === client.id ? client : c));
        }
        return [client, ...prev];
      });
      toast({
        title: 'Cliente cadastrado',
        description: `${client.full_name} foi adicionado com sucesso.`,
      });
    } else {
      setClients((prev) => prev.map((c) => (c.id === client.id ? client : c)));
      if (selectedClient?.id === client.id) {
        setSelectedClient(client);
      }
      toast({
        title: 'Cliente atualizado',
        description: `Os dados de ${client.full_name} foram atualizados.`,
      });
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingClient(null);
  };

  const handleClientArchived = async () => {
    toast({
      title: 'Cliente arquivado',
      description: 'O cliente foi arquivado com sucesso.',
    });
    setSelectedClient(null);
    await fetchClients();
  };

  // Optimistic update: remove client from local state immediately after deletion
  const handleClientDeleted = () => {
    if (selectedClient) {
      setClients((prev) => prev.filter((c) => c.id !== selectedClient.id));
      setSelectedClient(null);
    }
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setActiveTab('dados');
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 lg:gap-4 overflow-hidden">
      {/* Left Column - Client List */}
      <div className={`w-full lg:w-1/3 xl:w-1/4 flex flex-col border-r border-border ${selectedClient ? 'hidden lg:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold text-foreground">Clientes</h1>
            <Button
              onClick={() => {
                setEditingClient(null);
                setDialogOpen(true);
              }}
              className="whitespace-nowrap"
            >
              <Plus className="h-4 w-4 mr-2 shrink-0" />
              Novo Cliente
            </Button>
            <ClientFormDialog
              officeId={officeId}
              userId={user?.id || null}
              editingClient={editingClient}
              onClientSaved={handleClientSaved}
              onClose={handleCloseDialog}
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) setEditingClient(null);
              }}
            />
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col gap-3">
            {/* Search - Takes full width */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome, CPF/telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-10 w-full"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Filters - Split remaining space */}
            <div className="flex items-center gap-2 w-full">
              <Select value={personTypeFilter} onValueChange={(v) => setPersonTypeFilter(v as PersonTypeFilter)}>
                <SelectTrigger className="h-10 flex-1">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PF">P. Física</SelectItem>
                  <SelectItem value="PJ">P. Jurídica</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="h-10 flex-1">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="archived">Arquivados</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Client List */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="py-12 text-center px-4">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          ) : paginatedClients.length === 0 ? (
            <div className="py-12 text-center px-4">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm">
                {clients.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {paginatedClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => handleSelectClient(client)}
                  className={`p-3 cursor-pointer hover:bg-accent/50 transition-colors ${selectedClient?.id === client.id ? 'bg-accent' : ''
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm md:text-base truncate">
                          {client.full_name}
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                          {client.person_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {formatDocument(client)}
                      </p>
                      {client.phone && (
                        <div
                          className="mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ClickablePhone
                            phone={client.phone}
                            className="text-xs text-muted-foreground"
                          />
                        </div>
                      )}
                      {client.email && (
                        <div
                          className="mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ClickableEmail
                            email={client.email}
                            className="text-xs text-muted-foreground"
                          />
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(client);
                      }}
                      className="h-7 w-7 flex-shrink-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filteredClients.length} cliente(s)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {currentPage}/{totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column - Client Detail */}
      <div className={`flex-1 flex flex-col overflow-hidden ${selectedClient ? 'flex' : 'hidden lg:flex'}`}>
        {selectedClient && officeId ? (
          <>
            <ClientHeader
              client={selectedClient}
              showBackButton
              onBack={() => setSelectedClient(null)}
              onEdit={() => openEditDialog(selectedClient)}
              onArchived={handleClientArchived}
              onDeleted={handleClientDeleted}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              casesCount={0}
              docsCount={0}
              filesCount={0}
              timelineCount={0}
            />

            {/* Tab Contents */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="flex-1 flex flex-col overflow-hidden">

              <ScrollArea className="flex-1">
                {/* Tab: Dados */}
                <TabsContent value="dados" className="p-4 m-0">
                  <ClientDataPanel client={selectedClient} />
                </TabsContent>

                {/* Tab: Casos */}
                <TabsContent value="casos" className="p-4 m-0 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Scale className="h-4 w-4" />
                        Casos do Cliente
                      </CardTitle>
                      <CardDescription>
                        Gerencie os casos vinculados a este cliente
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ClientCasesPanel clientId={selectedClient.id} />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Kit */}
                <TabsContent value="kit" className="p-4 m-0 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Kit Inicial de Documentos
                      </CardTitle>
                      <CardDescription>
                        Procuração, contrato de honorários e declarações
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ClientDocumentKit clientId={selectedClient.id} />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Arquivos */}
                <TabsContent value="arquivos" className="p-4 m-0 space-y-6">
                  {/* Botão de protocolo eProc */}
                  <div className="flex justify-end">
                    <ClientProtocolDownload clientId={selectedClient.id} officeId={officeId} />
                  </div>

                  {/* Card unificado com Identidade + Assinatura + Contrato + Comprovante */}
                  <ClientFilesCard clientId={selectedClient.id} officeId={officeId} />
                </TabsContent>

                {/* Tab: Timeline */}
                <TabsContent value="timeline" className="p-4 m-0">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Histórico do Cliente
                      </CardTitle>
                      <CardDescription>
                        Eventos e alterações relacionadas a este cliente
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <LexosTimeline
                        clientId={selectedClient.id}
                        showFilters={true}
                        compact={true}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Histórico 360 */}
                <TabsContent value="timeline_360" className="p-4 m-0">
                  <Card className="border-teal-100 dark:border-teal-900/30">
                    <CardHeader className="pb-3 bg-teal-50/30 dark:bg-teal-950/10">
                      <CardTitle className="text-base flex items-center gap-2 text-teal-700 dark:text-teal-400">
                        <Sparkles className="h-4 w-4" />
                        Visão 360 do Cliente
                      </CardTitle>
                      <CardDescription>
                        Histórico consolidado de saúde, jurídico e comunicações
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <UnifiedTimeline clientId={selectedClient.id} />
                    </CardContent>
                  </Card>
                </TabsContent>
                {/* Tab: WhatsApp */}
                <TabsContent value="whatsapp" className="p-4 m-0">
                  <WhatsAppTab 
                    clientId={selectedClient.id}
                    patientName={selectedClient.full_name || 'Cliente'}
                    patientPhone={selectedClient.phone || ''}
                    resourceType="CLIENTE"
                  />
                </TabsContent>

                {/* Tab: Agente IA */}
                <TabsContent value="agente" className="p-4 m-0">
                  <ClientAgentPanel clientId={selectedClient.id} />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </>
        ) : (
          /* Placeholder when no client selected */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">
                Selecione um cliente
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Escolha um cliente na lista ao lado para visualizar os detalhes
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
