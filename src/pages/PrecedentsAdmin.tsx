import { useState, useEffect, useCallback } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Scale,
  Database as DbIcon,
  ListTodo,
  Lightbulb,
  Search,
  ExternalLink,
  CheckCircle,
  RefreshCw,
  Trash2,
  ArrowUpCircle,
  Loader2,
  AlertCircle,
  Clock,
  Eye,
  Plus,
  History,
} from 'lucide-react';
import {
  KIND_OPTIONS,
  STATUS_OPTIONS,
  TRIBUNAIS_COMUNS,
  getKindLabel,
  getStatusLabel,
  type PrecedentKind,
  type PrecedentStatus,
  type PrecedentSourceKind,
} from '@/lib/precedentConstants';

// Types from Supabase
type LegalPrecedent = Database['public']['Tables']['legal_precedents']['Row'];
type PrecedentSource = Database['public']['Tables']['legal_precedent_sources']['Row'];
type PrecedentJob = Database['public']['Tables']['legal_precedent_jobs']['Row'];
type PrecedentSuggestion = Database['public']['Tables']['legal_precedent_suggestions']['Row'];
type PrecedentVersion = Database['public']['Tables']['legal_precedent_versions']['Row'];

// Constant for "all" filter value to avoid empty string issue
const ALL_FILTER_VALUE = '__ALL__';

export default function PrecedentsAdmin() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('catalogo');
  const [workerRunning, setWorkerRunning] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<{ processed: number; failed: number } | null>(null);
  const [enqueueRunning, setEnqueueRunning] = useState(false);
  const [enqueueLimit, setEnqueueLimit] = useState<number>(50);
  const [retryRunning, setRetryRunning] = useState(false);
  const [retryLimit, setRetryLimit] = useState<number>(50);
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncStjRunning, setSyncStjRunning] = useState(false);

  // Fetch pending count on mount and when jobsRefreshKey changes
  useEffect(() => {
    const fetchPendingCount = async () => {
      const { data, error } = await supabase.rpc('get_pending_jobs_count');
      if (!error && typeof data === 'number') {
        setPendingCount(data);
      }
    };
    fetchPendingCount();
  }, [jobsRefreshKey]);
  const handleRunWorker = async () => {
    setWorkerRunning(true);
    try {
      let totalProcessed = 0;
      let totalFailed = 0;

      for (let i = 0; i < 50; i++) { // trava de segurança
        const { data, error } = await supabase.functions.invoke('precedents-worker', {
          body: { limitJobs: 10 },
        });

        setJobsRefreshKey((k) => k + 1);

        if (error) {
          // Check for 409 conflict (worker already running)
          if (error.message?.includes('409') || error.message?.includes('já em execução')) {
            toast({
              title: 'Worker já em execução',
              description: 'Aguarde o worker atual terminar antes de iniciar outro.',
              variant: 'destructive',
            });
            return;
          }
          toast({
            title: 'Erro ao executar worker',
            description: error.message || 'Erro desconhecido',
            variant: 'destructive',
          });
          setActiveTab('jobs');
          return;
        }

        const processed = Number(data?.processed ?? 0);
        const failed = Number(data?.failed ?? 0);

        totalProcessed += processed;
        totalFailed += failed;

        // Update live status
        setWorkerStatus({ processed: totalProcessed, failed: totalFailed });

        // para quando não houver mais pendentes (ou nada foi processado)
        if (processed === 0) break;
      }

      if (totalFailed > 0) {
        toast({
          title: 'Worker executado com falhas',
          description: `Processados: ${totalProcessed} sucesso, ${totalFailed} falhas`,
          variant: 'destructive',
        });
        setActiveTab('jobs');
      } else {
        toast({
          title: 'Worker executado com sucesso',
          description: `Processados: ${totalProcessed} sucesso, 0 falhas`,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao executar worker',
        description: message,
        variant: 'destructive',
      });
      setJobsRefreshKey((k) => k + 1);
      setActiveTab('jobs');
    } finally {
      setWorkerRunning(false);
      setWorkerStatus(null);
    }
  };

  const handleEnqueueCheckSource = async (limit: number) => {
    setEnqueueRunning(true);
    try {
      const { data, error } = await supabase.rpc('enqueue_check_source_jobs', { p_limit: limit });
      
      if (error) {
        // Handle duplicate/idempotency gracefully
        const isDuplicateError = error.message?.toLowerCase().includes('duplicat') || 
                                  error.message?.toLowerCase().includes('already') ||
                                  error.message?.toLowerCase().includes('já existe');
        if (isDuplicateError) {
          toast({
            title: 'Jobs parcialmente enfileirados',
            description: 'Já existe job ativo para algumas fontes. Verifique a aba Jobs.',
          });
        } else {
          toast({
            title: 'Erro ao enfileirar jobs',
            description: error.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Jobs enfileirados',
          description: `${data || 0} jobs CHECK_SOURCE criados`,
        });
      }
      setJobsRefreshKey((k) => k + 1);
      setActiveTab('jobs');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao enfileirar',
        description: message,
        variant: 'destructive',
      });
      setJobsRefreshKey((k) => k + 1);
      setActiveTab('jobs');
    } finally {
      setEnqueueRunning(false);
    }
  };

  const handleSyncStjSumulas = async () => {
    setSyncStjRunning(true);
    try {
      // Step 1: Enqueue SYNC_SOURCE jobs
      const { data, error } = await supabase.rpc('enqueue_sync_source_jobs', { 
        p_court: 'STJ', 
        p_kind: 'SUMULA', 
        p_limit: 500 
      });
      
      if (error) {
        toast({
          title: 'Erro ao enfileirar Súmulas STJ',
          description: error.message || 'Erro desconhecido',
          variant: 'destructive',
        });
        setJobsRefreshKey((k) => k + 1);
        setActiveTab('jobs');
        return;
      }

      const jobsCreated = data || 0;
      
      if (jobsCreated === 0) {
        toast({
          title: 'Nenhum job criado',
          description: 'Já existe job ativo para a fonte STJ/SUMULA ou a fonte está desabilitada.',
        });
        setJobsRefreshKey((k) => k + 1);
        setActiveTab('jobs');
        return;
      }

      toast({
        title: 'Jobs enfileirados',
        description: `${jobsCreated} job(s) SYNC_SOURCE criado(s). Iniciando processamento...`,
      });
      
      setJobsRefreshKey((k) => k + 1);
      setActiveTab('jobs');

      // Step 2: Auto-run worker to process the jobs
      await handleRunWorkerInternal();
      
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao sincronizar STJ',
        description: message,
        variant: 'destructive',
      });
      setJobsRefreshKey((k) => k + 1);
      setActiveTab('jobs');
    } finally {
      setSyncStjRunning(false);
    }
  };

  // Internal worker runner (used by handleSyncStjSumulas)
  const handleRunWorkerInternal = async () => {
    setWorkerRunning(true);
    try {
      let totalProcessed = 0;
      let totalFailed = 0;

      for (let i = 0; i < 50; i++) { // safety limit
        const { data, error } = await supabase.functions.invoke('precedents-worker', {
          body: { limitJobs: 10 },
        });

        setJobsRefreshKey((k) => k + 1);

        if (error) {
          if (error.message?.includes('409') || error.message?.includes('já em execução')) {
            toast({
              title: 'Worker já em execução',
              description: 'Aguarde o worker atual terminar.',
              variant: 'destructive',
            });
            return;
          }
          toast({
            title: 'Erro no worker',
            description: error.message || 'Erro desconhecido',
            variant: 'destructive',
          });
          return;
        }

        const processed = Number(data?.processed ?? 0);
        const failed = Number(data?.failed ?? 0);

        totalProcessed += processed;
        totalFailed += failed;

        setWorkerStatus({ processed: totalProcessed, failed: totalFailed });

        if (processed === 0) break;
      }

      if (totalFailed > 0) {
        toast({
          title: 'Sincronização concluída com falhas',
          description: `Processados: ${totalProcessed} sucesso, ${totalFailed} falhas`,
          variant: 'destructive',
        });
      } else if (totalProcessed > 0) {
        toast({
          title: 'Sincronização concluída',
          description: `${totalProcessed} job(s) processado(s) com sucesso`,
        });
      }
    } finally {
      setWorkerRunning(false);
      setWorkerStatus(null);
      setJobsRefreshKey((k) => k + 1);
    }
  };

  const handleRetryFailed = async (limit: number) => {
    setRetryRunning(true);
    try {
      const { data, error } = await supabase.rpc('retry_failed_check_source_jobs', { p_limit: limit });
      
      if (error) {
        toast({
          title: 'Erro ao retry de jobs',
          description: error.message || 'Erro desconhecido',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Jobs reenfileirados',
          description: `${data || 0} jobs FAILED → PENDING`,
        });
      }
      setJobsRefreshKey((k) => k + 1);
      setActiveTab('jobs');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao retry',
        description: message,
        variant: 'destructive',
      });
      setJobsRefreshKey((k) => k + 1);
      setActiveTab('jobs');
    } finally {
      setRetryRunning(false);
    }
  };

  const handleReenableAllSources = async () => {
    try {
      const { data, error } = await supabase.rpc('reenable_all_sources');
      if (error) throw error;
      toast({
        title: 'Fontes reabilitadas',
        description: `${data || 0} fontes reativadas`,
      });
      setJobsRefreshKey((k) => k + 1);
    } catch (err) {
      toast({ title: 'Erro ao reabilitar fontes', variant: 'destructive' });
    }
  };

  if (roleLoading) {
    return (
      <div className="container mx-auto py-8 px-4 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-6 w-6" />
              <p className="font-medium">Acesso restrito a administradores.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Scale className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Precedentes (Global)</h1>
              <p className="text-muted-foreground">
                Gerencie o catálogo global de súmulas e precedentes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {workerRunning && workerStatus && (
              <Badge variant="secondary" className="gap-1 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                Processando… (sucesso: {workerStatus.processed}, falhas: {workerStatus.failed})
              </Badge>
            )}
            {!workerRunning && pendingCount > 0 && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
              </Badge>
            )}
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={10000}
                value={enqueueLimit}
                onChange={(e) => setEnqueueLimit(Math.max(1, parseInt(e.target.value) || 50))}
                className="w-20 h-8 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEnqueueCheckSource(enqueueLimit)}
                disabled={enqueueRunning}
                className="gap-2"
              >
                {enqueueRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Enfileirar CHECK_SOURCE
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={10000}
                value={retryLimit}
                onChange={(e) => setRetryLimit(Math.max(1, parseInt(e.target.value) || 50))}
                className="w-20 h-8 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRetryFailed(retryLimit)}
                disabled={retryRunning}
                className="gap-2"
              >
                {retryRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Retry FAILED
              </Button>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleRunWorker}
              disabled={workerRunning || pendingCount === 0}
              className="gap-2"
            >
              {workerRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {pendingCount > 0 ? `Processar Fila (${pendingCount})` : 'Processar Fila (Worker)'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReenableAllSources}
              className="gap-2"
              title="Reabilitar todas as fontes desabilitadas"
            >
              <ArrowUpCircle className="h-4 w-4" />
              Reabilitar Fontes
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSyncStjSumulas}
              disabled={syncStjRunning}
              className="gap-2"
            >
              {syncStjRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Scale className="h-4 w-4" />
              )}
              Baixar Súmulas STJ (primeira carga)
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="catalogo" className="gap-2">
              <DbIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Catálogo</span>
            </TabsTrigger>
            <TabsTrigger value="fontes" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Fontes</span>
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-2">
              <ListTodo className="h-4 w-4" />
              <span className="hidden sm:inline">Fila/Jobs</span>
            </TabsTrigger>
            <TabsTrigger value="sugestoes" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              <span className="hidden sm:inline">Sugestões</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo" className="mt-6">
            <CatalogoTab />
          </TabsContent>
          <TabsContent value="fontes" className="mt-6">
            <FontesTab />
          </TabsContent>
          <TabsContent value="jobs" className="mt-6">
            <JobsTab refreshKey={jobsRefreshKey} />
          </TabsContent>
          <TabsContent value="sugestoes" className="mt-6">
            <SugestoesTab />
          </TabsContent>
        </Tabs>
      </div>
  );
}

// ==========================
// Tab: Catálogo
// ==========================
function CatalogoTab() {
  const { toast } = useToast();
  const [precedents, setPrecedents] = useState<LegalPrecedent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourt, setFilterCourt] = useState<string>(ALL_FILTER_VALUE);
  const [filterKind, setFilterKind] = useState<string>(ALL_FILTER_VALUE);
  const [filterStatus, setFilterStatus] = useState<string>(ALL_FILTER_VALUE);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  const [selectedPrecedent, setSelectedPrecedent] = useState<LegalPrecedent | null>(null);
  const [versions, setVersions] = useState<PrecedentVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const fetchPrecedents = useCallback(async (reset = false) => {
    const currentPage = reset ? 0 : page;
    if (reset) setPage(0);
    setLoading(true);

    try {
      let query = supabase
        .from('legal_precedents')
        .select('*')
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (searchTerm.trim()) {
        // Use real columns from legal_precedents table
        query = query.or(
          `tribunal.ilike.%${searchTerm}%,titulo.ilike.%${searchTerm}%,numero.ilike.%${searchTerm}%,ementa.ilike.%${searchTerm}%`
        );
      }
      if (filterCourt && filterCourt !== ALL_FILTER_VALUE) {
        query = query.eq('tribunal', filterCourt);
      }
      if (filterKind && filterKind !== ALL_FILTER_VALUE) {
        query = query.eq('tipo', filterKind);
      }
      if (filterStatus && filterStatus !== ALL_FILTER_VALUE) {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      const newData = data || [];
      if (reset) {
        setPrecedents(newData);
      } else {
        setPrecedents((prev) => [...prev, ...newData]);
      }
      setHasMore(newData.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching precedents:', err);
      toast({
        title: 'Erro ao carregar precedentes',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filterCourt, filterKind, filterStatus, toast]);

  useEffect(() => {
    fetchPrecedents(true);
  }, [searchTerm, filterCourt, filterKind, filterStatus]);

  const fetchVersions = async (precedentId: string) => {
    setVersionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('legal_precedent_versions')
        .select('*')
        .eq('precedent_id', precedentId)
        .order('captured_at', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (err) {
      console.error('Error fetching versions:', err);
      toast({
        title: 'Erro ao carregar versões',
        variant: 'destructive',
      });
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleVerify = async (precedent: LegalPrecedent) => {
    try {
      const { error } = await supabase
        .from('legal_precedents')
        .update({
          is_curated: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', precedent.id);

      if (error) throw error;

      toast({ title: 'Precedente marcado como verificado' });
      setPrecedents((prev) =>
        prev.map((p) => (p.id === precedent.id ? { ...p, is_curated: true } : p))
      );
      if (selectedPrecedent?.id === precedent.id) {
        setSelectedPrecedent({ ...precedent, is_curated: true });
      }
    } catch (err) {
      toast({
        title: 'Erro ao verificar',
        description: err instanceof Error ? err.message : 'Erro',
        variant: 'destructive',
      });
    }
  };

  const loadMore = () => {
    setPage((p) => p + 1);
    fetchPrecedents(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label htmlFor="search" className="sr-only">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar por tribunal, título, número..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterCourt} onValueChange={setFilterCourt}>
              <SelectTrigger>
                <SelectValue placeholder="Tribunal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
                {TRIBUNAIS_COMUNS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterKind} onValueChange={setFilterKind}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
                {KIND_OPTIONS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tribunal</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead className="hidden lg:table-cell">Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Verificado</TableHead>
                  <TableHead className="table-cell-actions">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && precedents.length === 0 ? (
                  <TableSkeleton rows={5} columns={7} />
                ) : precedents.length === 0 ? (
                  <TableEmptyState colSpan={7} message="Nenhum precedente encontrado." />
                ) : (
                  precedents.map((p) => (
                    <TableRow 
                      key={p.id} 
                      className="cursor-pointer hover:bg-muted/50" 
                      onClick={() => {
                        setSelectedPrecedent(p);
                        setShowVersions(false);
                      }}
                    >
                      <TableCell className="table-cell-primary">{p.tribunal}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getKindLabel(p.tipo) || getKindLabel(p.kind)}</Badge>
                      </TableCell>
                      <TableCell className="table-cell-mono">{p.numero || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[200px] truncate table-cell-secondary">
                        {p.titulo || p.title || p.ementa?.substring(0, 50) || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'VIGENTE' || p.status === 'ATIVA' ? 'default' : 'secondary'}>
                          {getStatusLabel(p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {p.is_curated ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="table-cell-actions">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPrecedent(p);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          {hasMore && precedents.length > 0 && (
            <div className="p-4 border-t">
              <Button variant="outline" className="w-full" onClick={loadMore} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Carregar mais
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedPrecedent} onOpenChange={(open) => !open && setSelectedPrecedent(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedPrecedent && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedPrecedent.tribunal} - {selectedPrecedent.numero || 'S/N'}
                  {selectedPrecedent.is_curated && (
                    <Badge variant="default" className="ml-2">Verificado</Badge>
                  )}
                </SheetTitle>
                <SheetDescription>
                  {getKindLabel(selectedPrecedent.tipo) || getKindLabel(selectedPrecedent.kind)} • {getStatusLabel(selectedPrecedent.status)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {(selectedPrecedent.titulo || selectedPrecedent.title) && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Título</Label>
                    <p className="text-sm font-medium">{selectedPrecedent.titulo || selectedPrecedent.title}</p>
                  </div>
                )}

                {selectedPrecedent.thesis && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Tese</Label>
                    <p className="text-sm">{selectedPrecedent.thesis}</p>
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground text-xs">Ementa</Label>
                  <p className="text-sm whitespace-pre-wrap">{selectedPrecedent.ementa}</p>
                </div>

                {selectedPrecedent.official_text && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Texto Oficial</Label>
                    <ScrollArea className="h-[150px] border rounded p-2">
                      <p className="text-sm whitespace-pre-wrap">{selectedPrecedent.official_text}</p>
                    </ScrollArea>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {!selectedPrecedent.is_curated && (
                    <Button size="sm" onClick={() => handleVerify(selectedPrecedent)}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Marcar como Verificado
                    </Button>
                  )}
                  {(selectedPrecedent.link || selectedPrecedent.link_oficial) && (
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={selectedPrecedent.link_oficial || selectedPrecedent.link || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir Fonte
                      </a>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowVersions(true);
                      fetchVersions(selectedPrecedent.id);
                    }}
                  >
                    <History className="h-4 w-4 mr-2" />
                    Ver Versões
                  </Button>
                </div>

                {showVersions && (
                  <div className="border-t pt-4 mt-4">
                    <Label className="text-muted-foreground text-xs mb-2 block">Histórico de Versões</Label>
                    {versionsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : versions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma versão registrada.</p>
                    ) : (
                      <div className="space-y-2">
                        {versions.map((v) => (
                          <Card key={v.id} className="p-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>{new Date(v.captured_at).toLocaleString('pt-BR')}</span>
                              {v.status && <Badge variant="outline">{v.status}</Badge>}
                            </div>
                            {v.text_snapshot && (
                              <p className="text-xs line-clamp-2">{v.text_snapshot.substring(0, 200)}...</p>
                            )}
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs text-muted-foreground pt-4 border-t">
                  <p>Fonte: {selectedPrecedent.source || 'manual'}</p>
                  <p>Criado: {new Date(selectedPrecedent.created_at).toLocaleString('pt-BR')}</p>
                  <p>Atualizado: {new Date(selectedPrecedent.updated_at).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ==========================
// Tab: Fontes
// ==========================
function FontesTab() {
  const { toast } = useToast();
  const [sources, setSources] = useState<PrecedentSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSource, setEditingSource] = useState<PrecedentSource | null>(null);
  const [saving, setSaving] = useState(false);

  const [formCourt, setFormCourt] = useState('');
  const [formKind, setFormKind] = useState<PrecedentKind>('SUMULA');
  const [formUrl, setFormUrl] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formInterval, setFormInterval] = useState(24);

  const fetchSources = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('legal_precedent_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSources(data || []);
    } catch (err) {
      toast({ title: 'Erro ao carregar fontes', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const openDialog = (source?: PrecedentSource) => {
    if (source) {
      setEditingSource(source);
      setFormCourt(source.court);
      setFormKind(source.kind);
      setFormUrl(source.source_url);
      setFormEnabled(source.enabled);
      setFormInterval(source.check_interval_hours);
    } else {
      setEditingSource(null);
      setFormCourt('');
      setFormKind('SUMULA');
      setFormUrl('');
      setFormEnabled(true);
      setFormInterval(24);
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formCourt || !formKind || !formUrl) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingSource) {
        const { error } = await supabase
          .from('legal_precedent_sources')
          .update({
            court: formCourt,
            kind: formKind,
            source_url: formUrl,
            enabled: formEnabled,
            check_interval_hours: formInterval,
          })
          .eq('id', editingSource.id);

        if (error) throw error;
        toast({ title: 'Fonte atualizada' });
      } else {
        const sourceKind: PrecedentSourceKind = 'OFICIAL';
        const { error } = await supabase
          .from('legal_precedent_sources')
          .insert([{
            court: formCourt,
            kind: formKind,
            source_url: formUrl,
            source_kind: sourceKind,
            enabled: formEnabled,
            check_interval_hours: formInterval,
          }]);

        if (error) throw error;
        toast({ title: 'Fonte criada' });
      }
      setShowDialog(false);
      fetchSources();
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Erro',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (source: PrecedentSource) => {
    if (!confirm('Deseja excluir esta fonte?')) return;

    try {
      const { error } = await supabase
        .from('legal_precedent_sources')
        .delete()
        .eq('id', source.id);

      if (error) throw error;
      toast({ title: 'Fonte excluída' });
      fetchSources();
    } catch (err) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const enqueueCheck = async (source: PrecedentSource) => {
    try {
      const { error } = await supabase
        .from('legal_precedent_jobs')
        .insert([{
          source_id: source.id,
          job_type: 'CHECK_SOURCE',
          payload: { source_id: source.id } as unknown as Database['public']['Tables']['legal_precedent_jobs']['Insert']['payload'],
          status: 'PENDING',
        }]);

      if (error) throw error;
      toast({ title: 'Verificação enfileirada' });
    } catch (err) {
      toast({ title: 'Erro ao enfileirar', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Fontes de Dados</h3>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Fonte
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tribunal</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden md:table-cell">URL</TableHead>
                <TableHead className="text-center">Ativo</TableHead>
                <TableHead>Intervalo</TableHead>
                <TableHead className="hidden lg:table-cell">Última Execução</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : sources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma fonte cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                sources.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.court}</TableCell>
                    <TableCell>{getKindLabel(s.kind)}</TableCell>
                    <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                      <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {s.source_url}
                      </a>
                    </TableCell>
                    <TableCell className="text-center">
                      {s.enabled ? (
                        <Badge variant="default">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>{s.check_interval_hours}h</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                      {s.last_run_at ? new Date(s.last_run_at).toLocaleString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => enqueueCheck(s)} title="Enfileirar verificação">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openDialog(s)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(s)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSource ? 'Editar Fonte' : 'Nova Fonte'}</DialogTitle>
            <DialogDescription>Configure a fonte de dados para precedentes</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tribunal</Label>
              <Select value={formCourt || ALL_FILTER_VALUE} onValueChange={(v) => setFormCourt(v === ALL_FILTER_VALUE ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>Selecione...</SelectItem>
                  {TRIBUNAIS_COMUNS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formKind} onValueChange={(v) => setFormKind(v as PrecedentKind)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>URL da Fonte</Label>
              <Input
                placeholder="https://..."
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Intervalo de Verificação (horas)</Label>
              <Input
                type="number"
                min={1}
                value={formInterval}
                onChange={(e) => setFormInterval(Number(e.target.value))}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={formEnabled} onCheckedChange={setFormEnabled} id="enabled" />
              <Label htmlFor="enabled">Ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================
// Tab: Jobs
// ==========================
function JobsTab({ refreshKey = 0 }: { refreshKey?: number }) {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<PrecedentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('legal_precedent_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      toast({ title: 'Erro ao carregar jobs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs, refreshKey]);

  const handleRetryJob = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      const { data, error } = await supabase.rpc('retry_single_job', { p_job_id: jobId });
      if (error) throw error;
      if (data) {
        toast({ title: 'Job reenfileirado para retry' });
      } else {
        toast({ title: 'Não foi possível retry (job já ativo ou não FAILED)', variant: 'destructive' });
      }
      fetchJobs();
    } catch (err) {
      toast({ title: 'Erro ao retry job', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      const { data, error } = await supabase.rpc('cancel_job', { p_job_id: jobId });
      if (error) throw error;
      if (data) {
        toast({ title: 'Job cancelado' });
      } else {
        toast({ title: 'Não foi possível cancelar (job não está PENDING)', variant: 'destructive' });
      }
      fetchJobs();
    } catch (err) {
      toast({ title: 'Erro ao cancelar job', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (jobStatus: string) => {
    switch (jobStatus) {
      case 'PENDING':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'RUNNING':
        return <Badge variant="default"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Executando</Badge>;
      case 'SUCCESS':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Sucesso</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case 'CANCELLED':
        return <Badge variant="secondary"><Trash2 className="h-3 w-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{jobStatus}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Fila de Jobs</h3>
        <Button variant="outline" onClick={fetchJobs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Criado</TableHead>
                  <TableHead className="hidden lg:table-cell">Iniciado</TableHead>
                  <TableHead className="hidden lg:table-cell">Finalizado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum job na fila
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((j) => {
                    const truncatedError = j.last_error 
                      ? (j.last_error.length > 80 ? j.last_error.slice(0, 80) + '…' : j.last_error)
                      : null;
                    return (
                      <>
                        <TableRow key={j.id}>
                          <TableCell className="font-medium">{j.job_type}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {getStatusBadge(j.status)}
                              {truncatedError && (
                                <span 
                                  className="text-xs text-destructive/80 max-w-[200px] truncate cursor-pointer hover:text-destructive"
                                  onClick={() => setExpandedErrorId(expandedErrorId === j.id ? null : j.id)}
                                  title={j.last_error || ''}
                                >
                                  {truncatedError}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {new Date(j.created_at).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {j.started_at ? new Date(j.started_at).toLocaleString('pt-BR') : '—'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {j.finished_at ? new Date(j.finished_at).toLocaleString('pt-BR') : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {j.status === 'FAILED' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRetryJob(j.id)}
                                    disabled={actionLoading === j.id}
                                    title="Retry este job"
                                  >
                                    {actionLoading === j.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </Button>
                                  {j.last_error && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setExpandedErrorId(expandedErrorId === j.id ? null : j.id)}
                                      title="Ver erro completo"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                              {j.status === 'PENDING' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCancelJob(j.id)}
                                  disabled={actionLoading === j.id}
                                  title="Cancelar job"
                                  className="text-destructive hover:text-destructive"
                                >
                                  {actionLoading === j.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {j.last_error && expandedErrorId === j.id && (
                          <TableRow key={`${j.id}-error`}>
                            <TableCell colSpan={6} className="bg-destructive/5 border-l-4 border-destructive">
                              <div className="p-2">
                                <p className="text-xs font-medium text-destructive mb-1">Detalhes do Erro:</p>
                                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all bg-muted/50 p-2 rounded max-h-40 overflow-auto">
                                  {j.last_error}
                                </pre>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================
// Tab: Sugestões
// ==========================
function SugestoesTab() {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<PrecedentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCaseId, setFilterCaseId] = useState('');
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [promoteStatus, setPromoteStatus] = useState<PrecedentStatus>('ATIVA');
  const [selectedSuggestion, setSelectedSuggestion] = useState<PrecedentSuggestion | null>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('legal_precedent_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterCaseId.trim()) {
        query = query.eq('case_id', filterCaseId.trim());
      }

      const { data, error } = await query;

      if (error) throw error;
      setSuggestions(data || []);
    } catch (err) {
      toast({ title: 'Erro ao carregar sugestões', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [filterCaseId]);

  const handlePromote = async () => {
    if (!selectedSuggestion) return;

    setPromotingId(selectedSuggestion.id);
    try {
      const { error } = await supabase.rpc('promote_suggestion_to_precedent', {
        p_suggestion_id: selectedSuggestion.id,
        p_status: promoteStatus,
      });

      if (error) throw error;

      toast({ title: 'Sugestão promovida ao catálogo' });
      setShowPromoteDialog(false);
      setSelectedSuggestion(null);
      fetchSuggestions();
    } catch (err) {
      toast({
        title: 'Erro ao promover',
        description: err instanceof Error ? err.message : 'Erro',
        variant: 'destructive',
      });
    } finally {
      setPromotingId(null);
    }
  };

  const handleDelete = async (suggestion: PrecedentSuggestion) => {
    if (!confirm('Deseja excluir esta sugestão?')) return;

    try {
      const { error } = await supabase
        .from('legal_precedent_suggestions')
        .delete()
        .eq('id', suggestion.id);

      if (error) throw error;
      toast({ title: 'Sugestão excluída' });
      fetchSuggestions();
    } catch (err) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const openPromoteDialog = (suggestion: PrecedentSuggestion) => {
    setSelectedSuggestion(suggestion);
    setPromoteStatus('ATIVA');
    setShowPromoteDialog(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 items-center">
          <Label htmlFor="filterCase" className="sr-only">Filtrar por Case ID</Label>
          <Input
            id="filterCase"
            placeholder="Filtrar por Case ID (opcional)"
            value={filterCaseId}
            onChange={(e) => setFilterCaseId(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <Button variant="outline" onClick={fetchSuggestions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tribunal</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead className="hidden lg:table-cell">Título</TableHead>
                  <TableHead className="hidden md:table-cell">Criado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : suggestions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma sugestão pendente
                    </TableCell>
                  </TableRow>
                ) : (
                  suggestions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.court || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getKindLabel(s.kind)}</Badge>
                      </TableCell>
                      <TableCell>{s.number || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[200px] truncate">
                        {s.title || s.text_full?.substring(0, 50) || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => openPromoteDialog(s)}
                            disabled={promotingId === s.id}
                          >
                            {promotingId === s.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowUpCircle className="h-4 w-4 mr-1" />
                            )}
                            <span className="hidden sm:inline">Promover</span>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(s)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promover Sugestão para Catálogo</DialogTitle>
            <DialogDescription>
              Selecione o status do precedente ao ser promovido
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {selectedSuggestion && (
              <div className="border rounded p-3 bg-muted/50">
                <p className="font-medium">{selectedSuggestion.court} - {selectedSuggestion.number || 'S/N'}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedSuggestion.title || selectedSuggestion.text_full?.substring(0, 100)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Status do Precedente</Label>
              <Select value={promoteStatus} onValueChange={(v) => setPromoteStatus(v as PrecedentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromoteDialog(false)}>Cancelar</Button>
            <Button onClick={handlePromote} disabled={!!promotingId}>
              {promotingId && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Promover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
