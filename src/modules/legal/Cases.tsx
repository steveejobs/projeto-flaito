import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOfficeRole } from '@/hooks/useOfficeRole';
import { hasRole } from '@/lib/rbac/roles';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Scale, Search, X, ChevronLeft, ChevronRight, FileText, Clock,
  CheckSquare, DollarSign, History, BookOpen, Briefcase, Pencil, User, Bell, Mic,
  MoreVertical, Trash2, ExternalLink
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// AppLayout removed - now using AppShell nested routes
import { DeleteCaseButton } from '@/components/DeleteCaseButton';
import { useToast } from '@/hooks/use-toast';
import type { Tables, Database } from '@/integrations/supabase/types';

// Case-related components
import { 
  CaseTimeline, 
  CaseProcessTimeline,
  CaseChecklist, 
  CaseDeadlines, 
  CaseExpenses,
  CaseInitialDocs,
  CaseGeneratedHistory,
  CaseInteractionPanel,
  CaseKnowledgePanel,
  CaseStateSelect,
  CaseStateTimeline,
  CaseNotificationsFeed,
  CaseStateTimelineInline,
  CaseNotificationsInline,
  CasePlaudPanel,
} from '@/features/cases';

import { NijaFullAnalysisCard } from '@/components/NijaFullAnalysisCard';
import { NijaAutoPetitionButton } from '@/components/NijaAutoPetitionButton';
import type { NijaFullAnalysisResult } from '@/services/nijaFullAnalysis';
import {
  getAllStates,
  getCaseCurrentState,
  listCasesWithCurrentState,
  type CaseState,
  type CaseCurrentState,
  buildStatesMap,
} from '@/services/caseState';

type Case = Tables<'cases'>;
type Client = Tables<'clients'>;
type CaseSide = Database['public']['Enums']['case_side'];

type SideFilter = 'all' | 'ATAQUE' | 'DEFESA';
type ScopeFilter = 'all' | 'mine';
type SourceFilter = 'all' | 'manual' | 'escavador';

const PAGE_SIZE = 20;
const CASES_FILTERS_KEY = 'lexos_cases_filters_v1';

interface CasesFiltersStorage {
  scope?: string;
  side?: SideFilter;
  state?: string;
  search?: string;
}

const SIDE_OPTIONS = [
  { value: 'all', label: 'Todos os lados' },
  { value: 'ATAQUE', label: 'Autor (Ataque)' },
  { value: 'DEFESA', label: 'Réu (Defesa)' },
];

// Fallback for legacy status/stage (used when FSM state not available)
const STAGE_BADGES: Record<string, { label: string; className: string }> = {
  pre_processual: { label: 'Pré-Processual', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  judicializado: { label: 'Judicializado', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  arquivado: { label: 'Arquivado', className: 'bg-gray-100 text-gray-500 border-gray-300' },
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  EM_ANDAMENTO: { label: 'Em Andamento', className: 'bg-green-100 text-green-700' },
  AGUARDANDO: { label: 'Aguardando', className: 'bg-yellow-100 text-yellow-700' },
  SUSPENSO: { label: 'Suspenso', className: 'bg-orange-100 text-orange-700' },
  ARQUIVADO: { label: 'Arquivado', className: 'bg-gray-100 text-gray-500' },
  ENCERRADO: { label: 'Encerrado', className: 'bg-red-100 text-red-700' },
};

/**
 * Extrai um subject rico da análise NIJA para busca de conhecimento
 */
function extractNijaSearchSubject(analysis: NijaFullAnalysisResult | null): string {
  if (!analysis) return "";
  
  const parts: string[] = [];
  
  // Ramo/área
  if (analysis.meta?.ramo) {
    parts.push(analysis.meta.ramo);
  }
  
  // Resumo tático (pegar palavras-chave)
  if (analysis.meta?.resumoTatico) {
    parts.push(analysis.meta.resumoTatico);
  }
  
  // Tipo de prescrição se houver
  if (analysis.prescricao?.haPrescricao && analysis.prescricao.tipo !== "NENHUMA") {
    parts.push(`prescrição ${analysis.prescricao.tipo.toLowerCase()}`);
  }
  
  // Vícios detectados (primeiros 2)
  if (analysis.vicios?.length) {
    const vicioLabels = analysis.vicios.slice(0, 2).map(v => v.label);
    parts.push(...vicioLabels);
  }
  
  // Sugestão de peça
  if (analysis.sugestaoPeca?.tipo) {
    parts.push(analysis.sugestaoPeca.tipo);
  }
  
  // Limitar tamanho para não sobrecarregar a busca
  const combined = parts.join(" ").trim();
  return combined.length > 300 ? combined.substring(0, 300) : combined;
}

export default function Cases() {
  const { user } = useAuth();
  const { role } = useOfficeRole();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Stable userId for deps
  const userId = user?.id ?? null;

  // Data state
  const [cases, setCases] = useState<Case[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<string, Client>>({});
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent concurrent fetches
  const inFlightRef = useRef(false);
  const fetchCountRef = useRef(0);

  // FSM state data
  const [allStates, setAllStates] = useState<CaseState[]>([]);
  const [statesMap, setStatesMap] = useState<Record<string, CaseState>>({});
  const [caseStatesMap, setCaseStatesMap] = useState<Record<string, CaseCurrentState>>({});
  const [selectedCaseState, setSelectedCaseState] = useState<CaseCurrentState | null>(null);

  // Selection state
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [selectedCaseDossier, setSelectedCaseDossier] = useState<any | null>(null);

  // Filters and pagination
  const [searchQuery, setSearchQuery] = useState('');
  
  // Knowledge search subject
  const [knowledgeSubject, setKnowledgeSubject] = useState('');
  const [sideFilter, setSideFilter] = useState<SideFilter>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Fetch dossier for selected case
  useEffect(() => {
    const fetchDossier = async () => {
      if (!selectedCase) {
        setSelectedCaseDossier(null);
        return;
      }
      
      const { data, error } = await supabase
        .from('process_dossiers')
        .select('*')
        .eq('case_id', selectedCase.id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (!error && data) {
        setSelectedCaseDossier(data);
      } else {
        setSelectedCaseDossier(null);
      }
    };
    
    fetchDossier();
  }, [selectedCase]);

  // Scope filter from URL
  const scopeFilter: ScopeFilter = (searchParams.get('scope') as ScopeFilter) || 'all';

  // Active tab in detail panel
  const [activeTab, setActiveTab] = useState('dados');

  // Permission state
  const [canEdit, setCanEdit] = useState(false);

  // Restore filters from localStorage on mount (only if no URL params)
  useEffect(() => {
    if (filtersInitialized) return;
    
    const hasUrlParams = searchParams.has('scope') || searchParams.has('side') || searchParams.has('state');
    
    if (!hasUrlParams) {
      try {
        const saved = localStorage.getItem(CASES_FILTERS_KEY);
        if (saved) {
          const filters: CasesFiltersStorage = JSON.parse(saved);
          if (filters.side) setSideFilter(filters.side);
          if (filters.state) setStateFilter(filters.state);
          if (filters.search) setSearchQuery(filters.search);
          if (filters.scope && filters.scope !== 'all') {
            const newParams = new URLSearchParams();
            newParams.set('scope', filters.scope);
            setSearchParams(newParams, { replace: true });
          }
        }
      } catch (e) {
        console.warn('Erro ao restaurar filtros:', e);
      }
    }
    
    setFiltersInitialized(true);
  }, [searchParams, setSearchParams, filtersInitialized]);

  // Persist filters to localStorage when they change
  useEffect(() => {
    if (!filtersInitialized) return;
    
    const filters: CasesFiltersStorage = {
      scope: scopeFilter !== 'all' ? scopeFilter : undefined,
      side: sideFilter !== 'all' ? sideFilter : undefined,
      state: stateFilter !== 'all' ? stateFilter : undefined,
      search: searchQuery.trim() || undefined,
    };
    
    try {
      localStorage.setItem(CASES_FILTERS_KEY, JSON.stringify(filters));
    } catch (e) {
      console.warn('Erro ao salvar filtros:', e);
    }
  }, [scopeFilter, sideFilter, stateFilter, searchQuery, filtersInitialized]);

  const fetchCases = useCallback(async () => {
    if (!userId) {
      if (import.meta.env.DEV) console.debug("[Cases] skip fetch: !userId");
      setLoading(false);
      return;
    }
    if (inFlightRef.current) {
      if (import.meta.env.DEV) console.debug("[Cases] skip fetch: already in flight");
      return;
    }

    inFlightRef.current = true;
    fetchCountRef.current += 1;
    const fetchNum = fetchCountRef.current;

    let watchdog: number | undefined;

    try {
      setLoading(true);
      if (import.meta.env.DEV) console.debug("[Cases] fetch start", { userId, fetchNum });

      if (import.meta.env.DEV) {
        watchdog = window.setTimeout(() => {
          console.warn("[Cases] watchdog: forcing loading=false after 10s", { fetchNum });
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

      // Fetch cases, clients, and FSM states in parallel
      const [casesResult, clientsResult, statesResult] = await Promise.all([
        supabase
          .from('cases')
          .select('*')
          .eq('office_id', memberData.office_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('clients')
          .select('*')
          .eq('office_id', memberData.office_id)
          .is('deleted_at', null)
          .order('full_name', { ascending: true }),
        getAllStates(),
      ]);

      if (casesResult.error) throw casesResult.error;
      if (clientsResult.error) throw clientsResult.error;

      const casesData = casesResult.data || [];
      setCases(casesData);
      setClients(clientsResult.data || []);
      setAllStates(statesResult);
      setStatesMap(buildStatesMap(statesResult));

      // Build clients map for quick lookup
      const map: Record<string, Client> = {};
      (clientsResult.data || []).forEach((c) => {
        map[c.id] = c;
      });
      setClientsMap(map);

      // Fetch FSM states for all cases via caseState service
      if (casesData.length > 0) {
        const caseIds = casesData.map((c) => c.id);
        const { data: caseStates } = await supabase
          .from('vw_case_current_state')
          .select('*')
          .in('case_id', caseIds) as { data: CaseCurrentState[] | null; error: unknown };

        const csMap: Record<string, CaseCurrentState> = {};
        (caseStates || []).forEach((s) => {
          csMap[s.case_id] = s;
        });
        setCaseStatesMap(csMap);
      }

      if (import.meta.env.DEV) console.debug("[Cases] fetch end", { fetchNum, count: casesData.length });
    } catch (err) {
      console.error('[Cases] Erro ao carregar:', err);
      setError('Erro ao carregar casos');
    } finally {
      setLoading(false);
      inFlightRef.current = false;
      if (watchdog) window.clearTimeout(watchdog);
    }
  }, [userId]);

  if (import.meta.env.DEV) console.debug("[PAGE STATE]", { page: "Cases", userId, loading, fetchCount: fetchCountRef.current });

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchCases();
  }, [userId, fetchCases]);

  // Fetch permission when case is selected
  useEffect(() => {
    if (!selectedCase) {
      setCanEdit(false);
      return;
    }
    setCanEdit(hasRole(role, 'ADMIN'));
  }, [selectedCase, role]);

  // Refresh FSM state for a specific case (used after transitions)
  const refreshCaseState = useCallback(async (caseId: string) => {
    const updated = await getCaseCurrentState(caseId);
    if (updated) {
      setCaseStatesMap(prev => ({ ...prev, [caseId]: updated }));
    }
  }, []);

  // Filter cases based on search, side, scope, and FSM state
  const filteredCases = useMemo(() => {
    let result = cases;

    // Scope filter (Meus Casos)
    if (scopeFilter === 'mine' && user?.id) {
      result = result.filter((c) => c.created_by === user.id);
    }

    // Side filter
    if (sideFilter !== 'all') {
      result = result.filter((c) => c.side === sideFilter);
    }

    // Source filter
    if (sourceFilter !== 'all') {
      result = result.filter((c) => (c as any).source === sourceFilter);
    }

    // FSM State filter
    if (stateFilter !== 'all') {
      result = result.filter((c) => {
        const caseState = caseStatesMap[c.id];
        return caseState?.current_state_id === stateFilter;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((caseItem) => {
        const titleMatch = caseItem.title?.toLowerCase().includes(query);
        const cnjMatch = caseItem.cnj_number?.toLowerCase().includes(query);
        const client = clientsMap[caseItem.client_id];
        const clientMatch = client?.full_name?.toLowerCase().includes(query);
        return titleMatch || cnjMatch || clientMatch;
      });
    }

    return result;
  }, [cases, searchQuery, sideFilter, stateFilter, sourceFilter, scopeFilter, user?.id, clientsMap, caseStatesMap]);

  // Pagination
  const totalPages = Math.ceil(filteredCases.length / PAGE_SIZE);
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCases.slice(start, start + PAGE_SIZE);
  }, [filteredCases, currentPage]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sideFilter, stateFilter, sourceFilter, scopeFilter]);

  // Handlers for scope toggle
  const handleScopeChange = (scope: ScopeFilter) => {
    const newParams = new URLSearchParams(searchParams);
    if (scope === 'all') {
      newParams.delete('scope');
    } else {
      newParams.set('scope', scope);
    }
    setSearchParams(newParams);
  };

  const handleSelectCase = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setActiveTab('dados');
  };

  const getClientName = (clientId: string) => {
    return clientsMap[clientId]?.full_name || 'Cliente não encontrado';
  };

  const getStageBadge = (stage: string) => {
    const config = STAGE_BADGES[stage] || { label: stage, className: 'bg-muted text-muted-foreground' };
    return <Badge variant="outline" className={`text-[10px] ${config.className}`}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_BADGES[status] || { label: status, className: 'bg-muted text-muted-foreground' };
    return <Badge className={`text-[10px] ${config.className}`}>{config.label}</Badge>;
  };

  const getSideBadge = (side: CaseSide) => {
    if (side === 'ATAQUE') {
      return <Badge className="text-[10px] bg-emerald-100 text-emerald-700">Autor</Badge>;
    }
    return <Badge className="text-[10px] bg-amber-100 text-amber-700">Réu</Badge>;
  };

  const handleCaseUpdated = async () => {
    toast({
      title: 'Caso atualizado',
      description: `Os dados do caso foram atualizados.`,
    });
    await fetchCases();
    // Update selected case if still exists
    if (selectedCase) {
      const { data } = await supabase
        .from('cases')
        .select('*')
        .eq('id', selectedCase.id)
        .maybeSingle();
      if (data) {
        setSelectedCase(data);
      }
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 lg:gap-4 overflow-hidden">
        {/* Left Column - Case List */}
        <div className={`w-full lg:w-1/3 xl:w-1/4 flex flex-col border-r border-border ${selectedCase ? 'hidden lg:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Casos
              </h1>
              <Badge variant="secondary" className="text-xs">
                {filteredCases.length} caso(s)
              </Badge>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar título, CNJ, cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10 h-9"
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

              {/* Scope Toggle */}
              <div className="flex gap-1 border rounded-md p-0.5">
                <Button
                  variant={scopeFilter === 'mine' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => handleScopeChange('mine')}
                >
                  Meus Casos
                </Button>
                <Button
                  variant={scopeFilter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => handleScopeChange('all')}
                >
                  Todos
                </Button>
              </div>

              {/* Filters Row */}
              <div className="flex gap-2">
                <Select value={sideFilter} onValueChange={(v) => setSideFilter(v as SideFilter)}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Lado" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIDE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os estados</SelectItem>
                    {allStates.map((state) => (
                      <SelectItem key={state.id} value={state.id}>{state.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as origens</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="escavador">Escavador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Case List */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="py-12 text-center px-4">
                <Scale className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-sm">{error}</p>
              </div>
            ) : paginatedCases.length === 0 ? (
              <div className="py-12 text-center px-4">
                <Scale className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-sm">
                  {cases.length === 0 ? 'Nenhum caso cadastrado' : 'Nenhum caso encontrado'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {paginatedCases.map((caseItem) => (
                  <div
                    key={caseItem.id}
                    onClick={() => handleSelectCase(caseItem)}
                    className={`p-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                      selectedCase?.id === caseItem.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      {/* Title + Actions */}
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-sm md:text-base leading-tight line-clamp-2 flex-1">
                          {caseItem.title}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleSelectCase(caseItem)}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Abrir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              handleSelectCase(caseItem);
                              setActiveTab('dados');
                            }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Trigger delete through the existing DeleteCaseButton logic
                                const deleteBtn = document.getElementById(`delete-case-${caseItem.id}`);
                                if (deleteBtn) deleteBtn.click();
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {/* Hidden delete button for programmatic trigger */}
                        <DeleteCaseButton
                          caseId={caseItem.id}
                          caseTitle={caseItem.title}
                          onDeleted={() => {
                            if (selectedCase?.id === caseItem.id) {
                              setSelectedCase(null);
                            }
                            fetchCases();
                          }}
                          triggerId={`delete-case-${caseItem.id}`}
                          hidden
                          navigateAfterDelete={false}
                        />
                      </div>

                      {/* Client Name */}
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {getClientName(caseItem.client_id)}
                      </p>

                      {/* CNJ if exists */}
                      {caseItem.cnj_number && (
                        <p className="text-xs text-muted-foreground truncate font-mono">
                          {caseItem.cnj_number}
                        </p>
                      )}

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {getSideBadge(caseItem.side)}
                        {getStatusBadge(caseItem.status)}
                        {getStageBadge(caseItem.stage)}
                        {(caseItem as any).source === 'escavador' || (caseItem as any).source === 'ESCAVADOR' ? (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-indigo-50 text-indigo-700 border-indigo-200">
                            Escavador
                          </Badge>
                        ) : null}
                      </div>
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
                Página {currentPage} de {totalPages}
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

        {/* Right Column - Case Detail */}
        <div className={`flex-1 flex flex-col overflow-hidden ${selectedCase ? 'flex' : 'hidden lg:flex'}`}>
          {selectedCase && officeId ? (
            <>
              {/* Mobile back button */}
              <div className="lg:hidden p-3 border-b border-border">
                <Button variant="ghost" size="sm" onClick={() => setSelectedCase(null)}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
              </div>

              {/* Case Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg md:text-xl font-semibold tracking-tight leading-tight">
                      {selectedCase.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {getClientName(selectedCase.client_id)}
                    </p>
                    {selectedCase.cnj_number && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        CNJ: {selectedCase.cnj_number}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {getSideBadge(selectedCase.side)}
                      <div className="w-48">
                        <CaseStateSelect 
                          caseId={selectedCase.id}
                          onTransition={() => refreshCaseState(selectedCase.id)}
                          disabled={!canEdit}
                        />
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <DeleteCaseButton
                      caseId={selectedCase.id}
                      caseTitle={selectedCase.title}
                      onDeleted={() => {
                        setSelectedCase(null);
                        fetchCases();
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Inline panels: FSM History + Case Alerts */}
              <div className="mt-3 px-4 grid gap-3 md:grid-cols-2">
                <CaseStateTimelineInline 
                  caseId={selectedCase.id}
                  onViewAll={() => setActiveTab("estados")}
                />
                <CaseNotificationsInline 
                  caseId={selectedCase.id}
                  onViewAll={() => setActiveTab("alertas")}
                />
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <div className="border-b border-border px-4 overflow-x-auto">
                  <TabsList className="h-auto bg-transparent w-full flex flex-nowrap gap-1 justify-start p-0">
                    <TabsTrigger
                      value="dados"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <Briefcase className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Dados</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="timeline"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <History className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Andamento</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="prazos"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <Clock className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Prazos</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="despesas"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <DollarSign className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Despesas</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="checklist"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <CheckSquare className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Checklist</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="documentos"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <FileText className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Documentos</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="estrategia"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <BookOpen className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Estratégia</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="estados"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <History className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Estados</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="alertas"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <Bell className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Alertas</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="plaud"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <Mic className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Plaud</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <ScrollArea className="flex-1">
                  {/* Tab: Dados */}
                  <TabsContent value="dados" className="p-4 m-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Informações do Caso</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="text-muted-foreground">Título:</span>
                            <p className="font-medium">{selectedCase.title}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cliente:</span>
                            <p className="font-medium">{getClientName(selectedCase.client_id)}</p>
                          </div>
                          {selectedCase.cnj_number && (
                            <div>
                              <span className="text-muted-foreground">Número CNJ:</span>
                              <p className="font-medium font-mono">{selectedCase.cnj_number}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Lado:</span>
                            <p className="font-medium">{selectedCase.side === 'ATAQUE' ? 'Autor (Ataque)' : 'Réu (Defesa)'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>
                            <p className="font-medium">{STATUS_BADGES[selectedCase.status]?.label || selectedCase.status}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Fase:</span>
                            <p className="font-medium">{STAGE_BADGES[selectedCase.stage]?.label || selectedCase.stage}</p>
                          </div>
                          {selectedCase.area && (
                            <div>
                              <span className="text-muted-foreground">Área:</span>
                              <p className="font-medium">{selectedCase.area}</p>
                            </div>
                          )}
                          {selectedCase.subtype && (
                            <div>
                              <span className="text-muted-foreground">Subtipo:</span>
                              <p className="font-medium">{selectedCase.subtype}</p>
                            </div>
                          )}
                        </div>

                        {/* Opponent info */}
                        {(selectedCase.opponent_name || selectedCase.opponent_doc) && (
                          <div className="pt-2 border-t border-border">
                            <h4 className="text-xs font-medium text-muted-foreground mb-2">PARTE ADVERSA</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {selectedCase.opponent_name && (
                                <div>
                                  <span className="text-muted-foreground">Nome:</span>
                                  <p className="font-medium">{selectedCase.opponent_name}</p>
                                </div>
                              )}
                              {selectedCase.opponent_doc && (
                                <div>
                                  <span className="text-muted-foreground">CPF/CNPJ:</span>
                                  <p className="font-medium">{selectedCase.opponent_doc}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Dates */}
                        <div className="pt-2 border-t border-border">
                          <h4 className="text-xs font-medium text-muted-foreground mb-2">DATAS</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <span className="text-muted-foreground">Criado em:</span>
                              <p className="font-medium">
                                {new Date(selectedCase.created_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Atualizado em:</span>
                              <p className="font-medium">
                                {new Date(selectedCase.updated_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            {selectedCase.judicialized_at && (
                              <div>
                                <span className="text-muted-foreground">Judicializado em:</span>
                                <p className="font-medium">
                                  {new Date(selectedCase.judicialized_at).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Resumo do Caso */}
                    {(selectedCase as Case & { summary?: string | null }).summary && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Resumo do Caso
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm whitespace-pre-line text-muted-foreground">
                            {(selectedCase as Case & { summary?: string | null }).summary}
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Case Interaction Panel */}
                    <CaseInteractionPanel caseId={selectedCase.id} />
                  </TabsContent>

                  {/* Tab: Timeline / Andamento */}
                  <TabsContent value="timeline" className="p-4 m-0 space-y-4">
                    {/* Andamentos do Processo (eventos detectados pelo NIJA) */}
                    <CaseProcessTimeline caseId={selectedCase.id} />
                    
                    {/* Timeline do Sistema (eventos internos) */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <History className="h-4 w-4" />
                          Timeline do Caso
                        </CardTitle>
                        <CardDescription>
                          Histórico de eventos e alterações do sistema
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <CaseTimeline caseId={selectedCase.id} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab: Prazos */}
                  <TabsContent value="prazos" className="p-4 m-0 space-y-4">
                    <CaseDeadlines caseId={selectedCase.id} canEdit={canEdit} />
                  </TabsContent>

                  {/* Tab: Despesas */}
                  <TabsContent value="despesas" className="p-4 m-0 space-y-4">
                    <CaseExpenses caseId={selectedCase.id} canEdit={canEdit} />
                  </TabsContent>

                  {/* Tab: Checklist */}
                  <TabsContent value="checklist" className="p-4 m-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CheckSquare className="h-4 w-4" />
                          Checklist do Caso
                        </CardTitle>
                        <CardDescription>
                          Tarefas e etapas do processo
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <CaseChecklist 
                          caseId={selectedCase.id} 
                          stage={selectedCase.stage}
                          canEdit={canEdit && selectedCase.stage !== 'arquivado'} 
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab: Documentos */}
                  <TabsContent value="documentos" className="p-4 m-0 space-y-4">
                    {/* Initial Documents */}
                    <CaseInitialDocs caseId={selectedCase.id} />

                    {/* Generated Documents */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Documentos Gerados
                        </CardTitle>
                        <CardDescription>
                          Histórico de documentos gerados para este caso
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <CaseGeneratedHistory caseId={selectedCase.id} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab: Estratégia / Fundamentos */}
                  <TabsContent value="estrategia" className="p-4 m-0 space-y-4">
                    {/* NIJA Full Analysis */}
                    <NijaFullAnalysisCard
                      caseId={selectedCase.id}
                      ramoHint={selectedCase.area}
                      faseHint={selectedCase.stage}
                      poloHint={selectedCase.side === "ATAQUE" ? "AUTOR" : "REU"}
                      initialData={selectedCase.nija_full_analysis as unknown as NijaFullAnalysisResult | null}
                    />

                    {/* Botão para gerar peça automática */}
                    <NijaAutoPetitionButton caseId={selectedCase.id} />
                    
                    <CaseKnowledgePanel
                      caseId={selectedCase.id}
                      subject={knowledgeSubject || extractNijaSearchSubject(selectedCase.nija_full_analysis as unknown as NijaFullAnalysisResult | null) || selectedCase.area || ""}
                      onSubjectChange={setKnowledgeSubject}
                    />
                  </TabsContent>

                  {/* Tab: Estados FSM */}
                  <TabsContent value="estados" className="p-4 m-0 space-y-4">
                    <CaseStateTimeline caseId={selectedCase.id} />
                  </TabsContent>

                  {/* Tab: Alertas/Notificações */}
                  <TabsContent value="alertas" className="p-4 m-0 space-y-4">
                    <CaseNotificationsFeed caseId={selectedCase.id} maxItems={20} />
                  </TabsContent>

                  {/* Tab: Plaud Integração */}
                  <TabsContent value="plaud" className="m-0">
                    {officeId && (
                      <CasePlaudPanel caseId={selectedCase.id} officeId={officeId} />
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </>
          ) : (
            /* Placeholder when no case selected */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Scale className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  Selecione um caso
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Escolha um caso na lista ao lado para visualizar os detalhes
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
