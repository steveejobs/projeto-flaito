import { useState, useEffect, useCallback, useRef } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  Database, 
  Clock, 
  Activity, 
  RefreshCw, 
  StopCircle, 
  XCircle,
  PlusCircle,
  ShieldAlert,
  Copy,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  HelpCircle,
  FileText
} from 'lucide-react';

interface CronJob {
  jobid: number;
  active: boolean;
  schedule: string;
  command: string;
  last_run_status: string | null;
  last_run_start: string | null;
  last_run_end: string | null;
  last_run_duration: string | null;
  last_run_message: string | null;
}

interface DbStats {
  total_connections: number;
  active: number;
  idle: number;
  idle_in_transaction: number;
  waiting: number;
}

interface TopQuery {
  pid: number;
  state: string;
  wait_event: string | null;
  runtime: string;
  query_snippet: string;
}

// Jobs críticos de manutenção mensal (não incluir no "Parar TODOS")
const PROTECTED_JOB_IDS = [1, 2];

// Auto-refresh interval in ms
const AUTO_REFRESH_INTERVAL = 30000;

// Descrições amigáveis para comandos conhecidos
const getJobDescription = (command: string): string => {
  if (command.includes('lexos_process_deadline_alerts')) return 'Alertas de Prazos';
  if (command.includes('lexos_process_alert_queue')) return 'Fila de Alertas';
  if (command.includes('deadline')) return 'Prazos';
  if (command.includes('backup')) return 'Backup';
  if (command.includes('vacuum')) return 'VACUUM';
  if (command.includes('analyze')) return 'ANALYZE';
  return '';
};

export default function AdminMaintenance() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('cron');
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [topQueries, setTopQueries] = useState<TopQuery[]>([]);
  const [loadingCron, setLoadingCron] = useState(false);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [processingJob, setProcessingJob] = useState<number | null>(null);
  const [processingAll, setProcessingAll] = useState(false);
  const [creatingJob, setCreatingJob] = useState<string | null>(null);
  const [showOnlyFailed, setShowOnlyFailed] = useState(false);
  const [rpcNotInstalled, setRpcNotInstalled] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Kit Worker states
  const [runningKitWorker, setRunningKitWorker] = useState(false);
  const [kitWorkerResult, setKitWorkerResult] = useState<Record<string, unknown> | null>(null);
  const [kitJobs, setKitJobs] = useState<Array<{
    id: string;
    client_id: string;
    status: string;
    attempts: number;
    last_error: string | null;
    created_at: string;
    updated_at: string;
  }>>([]);
  const [loadingKitJobs, setLoadingKitJobs] = useState(false);

  const fetchCronJobs = useCallback(async () => {
    setLoadingCron(true);
    setRpcNotInstalled(false);
    try {
      const { data, error } = await (supabase.rpc as any)('lexos_get_cron_jobs_status');
      if (error) {
        console.error('Error fetching cron jobs:', error);
        if (error.message.includes('does not exist') || error.code === '42883') {
          setRpcNotInstalled(true);
        } else {
          toast.error('Erro ao carregar jobs: ' + error.message);
        }
        setCronJobs([]);
      } else {
        setCronJobs((data as CronJob[]) || []);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error('Error:', err);
      setRpcNotInstalled(true);
    } finally {
      setLoadingCron(false);
    }
  }, []);

  const fetchDiagnostics = useCallback(async () => {
    setLoadingDiag(true);
    setDiagError(null);
    try {
      const [statsRes, queriesRes] = await Promise.all([
        (supabase.rpc as any)('lexos_get_db_connection_stats'),
        (supabase.rpc as any)('lexos_get_top_queries'),
      ]);

      if (statsRes.error && queriesRes.error) {
        setDiagError('RPCs de diagnóstico não instaladas ou erro de permissão.');
        setDbStats(null);
        setTopQueries([]);
        return;
      }

      if (statsRes.error) {
        console.error('Error fetching stats:', statsRes.error);
        setDbStats(null);
      } else if (statsRes.data) {
        setDbStats(statsRes.data as DbStats);
      }

      if (queriesRes.error) {
        console.error('Error fetching queries:', queriesRes.error);
        setTopQueries([]);
      } else {
        setTopQueries((queriesRes.data as TopQuery[]) || []);
      }
    } catch (err) {
      console.error('Error:', err);
      setDiagError('Erro ao carregar diagnósticos. Tente novamente.');
    } finally {
      setLoadingDiag(false);
    }
  }, []);

  // Kit Worker: Buscar jobs
  const fetchKitJobs = useCallback(async () => {
    setLoadingKitJobs(true);
    try {
      const { data, error } = await supabase
        .from("kit_generation_jobs")
        .select("id, client_id, status, attempts, last_error, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setKitJobs(data || []);
    } catch (err) {
      console.error("Erro ao buscar kit jobs:", err);
    } finally {
      setLoadingKitJobs(false);
    }
  }, []);

  // Kit Worker: Executar via admin-run-kit-worker
  const handleRunKitWorker = async () => {
    setRunningKitWorker(true);
    setKitWorkerResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Sessão não encontrada");
      }

      const response = await fetch(
        "https://uxrakfbedmkiqhidruxx.supabase.co/functions/v1/admin-run-kit-worker",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
        }
      );
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Erro ao executar worker");
      }
      
      setKitWorkerResult(result);
      toast.success(`Kit Worker: ${result.done || 0} OK, ${result.error || 0} erros`);
      fetchKitJobs();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error("Erro ao executar: " + errMsg);
      setKitWorkerResult({ error: errMsg });
    } finally {
      setRunningKitWorker(false);
    }
  };

  // Parar (unschedule) um job específico
  const handleUnscheduleJob = async (jobid: number) => {
    setProcessingJob(jobid);
    try {
      const { data, error } = await (supabase.rpc as any)('lexos_cron_unschedule', {
        job_ids: [jobid],
      });

      if (error) {
        toast.error('Erro ao parar job: ' + error.message);
      } else {
        toast.success(data || `Job ${jobid} removido com sucesso`);
        fetchCronJobs();
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Erro ao parar job');
    } finally {
      setProcessingJob(null);
    }
  };

  // Parar TODOS os jobs (exceto os protegidos)
  const handleEmergencyStopAll = async () => {
    const jobsToStop = cronJobs
      .filter(j => !PROTECTED_JOB_IDS.includes(j.jobid))
      .map(j => j.jobid);

    if (jobsToStop.length === 0) {
      toast.info('Nenhum job para parar (apenas jobs protegidos restantes)');
      return;
    }

    setProcessingAll(true);
    try {
      const { data, error } = await (supabase.rpc as any)('lexos_cron_unschedule', {
        job_ids: jobsToStop,
      });

      if (error) {
        toast.error('Erro ao parar jobs: ' + error.message);
      } else {
        toast.success(data || `${jobsToStop.length} job(s) removido(s) com sucesso`);
        fetchCronJobs();
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Erro ao parar jobs');
    } finally {
      setProcessingAll(false);
    }
  };

  // Criar novo job via RPC
  const handleCreateJob = async (jobKey: string, schedule: string, command: string) => {
    setCreatingJob(jobKey);
    try {
      const { data, error } = await (supabase.rpc as any)('lexos_cron_schedule', {
        p_schedule: schedule,
        p_command: command,
      });

      if (error) {
        toast.error('Erro ao criar job: ' + error.message);
      } else {
        toast.success(`Job criado com sucesso! ID: ${data}`);
        fetchCronJobs();
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Erro ao criar job');
    } finally {
      setCreatingJob(null);
    }
  };

  // Copiar comando para clipboard
  const handleCopyCommand = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      toast.success('Comando copiado!');
    } catch {
      toast.error('Erro ao copiar comando');
    }
  };

  // Toggle error expansion
  const toggleErrorExpanded = (jobid: number) => {
    setExpandedErrors(prev => {
      const next = new Set(prev);
      if (next.has(jobid)) {
        next.delete(jobid);
      } else {
        next.add(jobid);
      }
      return next;
    });
  };

  // Auto-refresh setup
  useEffect(() => {
    if (isAdmin && activeTab === 'cron' && !rpcNotInstalled) {
      // Initial fetch
      fetchCronJobs();
      
      // Setup auto-refresh
      autoRefreshRef.current = setInterval(() => {
        fetchCronJobs();
      }, AUTO_REFRESH_INTERVAL);

      return () => {
        if (autoRefreshRef.current) {
          clearInterval(autoRefreshRef.current);
        }
      };
    } else if (isAdmin && activeTab === 'diagnostico') {
      fetchDiagnostics();
    } else if (isAdmin && activeTab === 'kit-worker') {
      fetchKitJobs();
    }
    
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [isAdmin, activeTab, rpcNotInstalled, fetchCronJobs, fetchDiagnostics, fetchKitJobs]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Somente administradores podem acessar esta página.</p>
        <Button variant="outline" asChild>
          <a href="/dashboard">Voltar ao Dashboard</a>
        </Button>
      </div>
    );
  }

  const isJobError = (job: CronJob) => {
    return (
      job.last_run_status === 'failed' ||
      (job.last_run_message && job.last_run_message.toUpperCase().includes('ERROR'))
    );
  };

  const truncateCommand = (cmd: string, maxLen = 50) => {
    if (cmd.length <= maxLen) return cmd;
    return cmd.substring(0, maxLen) + '...';
  };

  const filteredJobs = showOnlyFailed
    ? cronJobs.filter(isJobError)
    : cronJobs;

  const renderStatusBadge = (job: CronJob) => {
    if (job.last_run_status === null) {
      return (
        <Badge variant="outline" className="gap-1">
          <HelpCircle className="h-3 w-3" />
          PENDENTE
        </Badge>
      );
    }
    if (job.last_run_status === 'succeeded') {
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle className="h-3 w-3" />
          OK
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        FALHOU
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manutenção do Banco</h1>
          <p className="text-muted-foreground">
            Monitoramento e controle de jobs do pg_cron e diagnóstico do banco de dados.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="cron" className="gap-2">
              <Clock className="h-4 w-4" />
              Cron (pg_cron)
            </TabsTrigger>
            <TabsTrigger value="diagnostico" className="gap-2">
              <Activity className="h-4 w-4" />
              Diagnóstico
            </TabsTrigger>
            <TabsTrigger value="kit-worker" className="gap-2">
              <FileText className="h-4 w-4" />
              Kit Worker
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cron" className="space-y-4">
            {/* Mensagem se RPC não instalada */}
            {rpcNotInstalled ? (
              <Alert variant="destructive">
                <Database className="h-4 w-4" />
                <AlertTitle>RPCs de manutenção não instaladas</AlertTitle>
                <AlertDescription className="mt-2 flex flex-col gap-3">
                  <span>
                    As funções RPC necessárias (<code>lexos_get_cron_jobs_status</code>, 
                    <code>lexos_cron_unschedule</code>, <code>lexos_cron_schedule</code>) 
                    não estão instaladas no Supabase.
                  </span>
                  <Button variant="outline" size="sm" onClick={fetchCronJobs} className="w-fit">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Recarregar
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Alert informativo */}
                <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertTitle className="text-amber-600">Atenção</AlertTitle>
                  <AlertDescription className="text-muted-foreground">
                    O botão "Parar" remove o job permanentemente do pg_cron (unschedule). 
                    Para restaurar, use a seção "Criar Jobs Seguros" abaixo.
                  </AlertDescription>
                </Alert>

                {/* Controles: Filtro + Botão de Emergência + Refresh */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="filter-failed" 
                        checked={showOnlyFailed}
                        onCheckedChange={setShowOnlyFailed}
                      />
                      <Label htmlFor="filter-failed" className="text-sm">
                        Mostrar somente FALHOU
                      </Label>
                    </div>
                    {lastRefresh && (
                      <span className="text-xs text-muted-foreground">
                        Atualizado: {lastRefresh.toLocaleTimeString('pt-BR')} (auto: 30s)
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleEmergencyStopAll}
                      disabled={processingAll || cronJobs.length === 0}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      {processingAll ? 'Parando...' : 'Emergência: Parar TODOS'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={fetchCronJobs}
                      disabled={loadingCron}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loadingCron ? 'animate-spin' : ''}`} />
                      Atualizar agora
                    </Button>
                  </div>
                </div>

                {/* Tabela de Jobs */}
                <Card>
                  <CardHeader>
                    <CardTitle>Jobs do Cron</CardTitle>
                    <CardDescription>
                      Lista de jobs agendados e seu último status de execução.
                      {PROTECTED_JOB_IDS.length > 0 && (
                        <span className="block mt-1 text-xs">
                          Jobs protegidos (não incluídos em "Parar TODOS"): {PROTECTED_JOB_IDS.join(', ')}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingCron ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : filteredJobs.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        {showOnlyFailed 
                          ? 'Nenhum job com falha encontrado.'
                          : 'Nenhum job encontrado.'}
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">ID</TableHead>
                              <TableHead className="w-20">Ativo</TableHead>
                              <TableHead className="w-28">Schedule</TableHead>
                              <TableHead>Comando</TableHead>
                              <TableHead className="w-28">Status</TableHead>
                              <TableHead className="w-36">Última Execução</TableHead>
                              <TableHead className="w-20">Duração</TableHead>
                              <TableHead className="w-36">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredJobs.map((job) => {
                              const description = getJobDescription(job.command);
                              const isFailed = isJobError(job);
                              const isProtected = PROTECTED_JOB_IDS.includes(job.jobid);
                              const hasErrorMessage = isFailed && job.last_run_message;
                              const isExpanded = expandedErrors.has(job.jobid);
                              
                              return (
                                <TableRow
                                  key={job.jobid}
                                  className={isFailed ? 'bg-destructive/10' : ''}
                                >
                                  <TableCell className="font-mono">
                                    {job.jobid}
                                    {isProtected && (
                                      <Badge variant="outline" className="ml-1 text-xs">
                                        🛡
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={job.active ? 'default' : 'secondary'}>
                                      {job.active ? 'Sim' : 'Não'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{job.schedule}</TableCell>
                                  <TableCell className="text-xs max-w-xs">
                                    <div className="flex flex-col gap-1">
                                      {description && (
                                        <Badge variant="outline" className="w-fit text-xs">
                                          {description}
                                        </Badge>
                                      )}
                                      <span 
                                        className="font-mono truncate" 
                                        title={job.command}
                                      >
                                        {truncateCommand(job.command)}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      {renderStatusBadge(job)}
                                      {hasErrorMessage && (
                                        <Collapsible open={isExpanded} onOpenChange={() => toggleErrorExpanded(job.jobid)}>
                                          <CollapsibleTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                                              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                              Ver erro
                                            </Button>
                                          </CollapsibleTrigger>
                                          <CollapsibleContent className="mt-2">
                                            <div className="p-2 bg-destructive/10 rounded text-xs font-mono text-destructive max-w-xs break-words">
                                              {job.last_run_message}
                                            </div>
                                          </CollapsibleContent>
                                        </Collapsible>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {job.last_run_start
                                      ? new Date(job.last_run_start).toLocaleString('pt-BR')
                                      : '—'}
                                  </TableCell>
                                  <TableCell className="text-xs font-mono">
                                    {job.last_run_duration || '—'}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1 text-destructive hover:text-destructive h-8"
                                        onClick={() => handleUnscheduleJob(job.jobid)}
                                        disabled={processingJob === job.jobid}
                                        title="Parar (unschedule)"
                                      >
                                        <StopCircle className="h-3 w-3" />
                                        {processingJob === job.jobid ? '...' : 'Parar'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2"
                                        onClick={() => handleCopyCommand(job.command)}
                                        title="Copiar comando"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Seção: Criar Jobs Seguros */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PlusCircle className="h-5 w-5" />
                      Jobs Seguros Recomendados
                    </CardTitle>
                    <CardDescription>
                      Crie jobs usando os wrappers SAFE que incluem timeouts e tratamento de erros 
                      para nunca travar o banco.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Deadline Alerts SAFE */}
                      <div className="p-4 border rounded-lg space-y-2">
                        <h4 className="font-medium">Deadline Alerts SAFE</h4>
                        <p className="text-xs text-muted-foreground">
                          Processa alertas de prazos a cada 10 minutos com timeout seguro.
                        </p>
                        <code className="block text-xs bg-muted p-2 rounded font-mono">
                          */10 * * * * → lexos_process_deadline_alerts_cron_safe()
                        </code>
                        <Button
                          size="sm"
                          onClick={() => handleCreateJob(
                            'deadline',
                            '*/10 * * * *',
                            'select public.lexos_process_deadline_alerts_cron_safe();'
                          )}
                          disabled={creatingJob === 'deadline'}
                          className="w-full"
                        >
                          <PlusCircle className="h-4 w-4 mr-2" />
                          {creatingJob === 'deadline' ? 'Criando...' : 'Criar Deadline Alerts SAFE'}
                        </Button>
                      </div>

                      {/* Alert Queue SAFE */}
                      <div className="p-4 border rounded-lg space-y-2">
                        <h4 className="font-medium">Alert Queue SAFE</h4>
                        <p className="text-xs text-muted-foreground">
                          Processa fila de alertas a cada 10 minutos com timeout seguro.
                        </p>
                        <code className="block text-xs bg-muted p-2 rounded font-mono">
                          */10 * * * * → lexos_process_alert_queue_cron_safe()
                        </code>
                        <Button
                          size="sm"
                          onClick={() => handleCreateJob(
                            'alert_queue',
                            '*/10 * * * *',
                            'select public.lexos_process_alert_queue_cron_safe();'
                          )}
                          disabled={creatingJob === 'alert_queue'}
                          className="w-full"
                        >
                          <PlusCircle className="h-4 w-4 mr-2" />
                          {creatingJob === 'alert_queue' ? 'Criando...' : 'Criar Alert Queue SAFE'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="diagnostico" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" onClick={fetchDiagnostics} disabled={loadingDiag}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingDiag ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            {/* Erro de diagnóstico */}
            {diagError ? (
              <Alert variant="destructive">
                <Database className="h-4 w-4" />
                <AlertTitle>Erro ao carregar diagnósticos</AlertTitle>
                <AlertDescription className="mt-2 flex flex-col gap-3">
                  <span>{diagError}</span>
                  <Button variant="outline" size="sm" onClick={fetchDiagnostics} className="w-fit">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Cards de estatísticas */}
                <div className="grid gap-4 md:grid-cols-5">
                  {loadingDiag || !dbStats ? (
                    [1, 2, 3, 4, 5].map((i) => (
                      <Card key={i}>
                        <CardHeader className="pb-2">
                          <Skeleton className="h-4 w-24" />
                        </CardHeader>
                        <CardContent>
                          <Skeleton className="h-8 w-12" />
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Total Conexões</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">{dbStats.total_connections}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Ativas</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-green-600">{dbStats.active}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Aguardando</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-amber-600">{dbStats.waiting}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Idle in Transaction</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-orange-600">{dbStats.idle_in_transaction}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Idle</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-muted-foreground">{dbStats.idle}</p>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>

                {/* Tabela de queries */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Queries Não-Idle</CardTitle>
                    <CardDescription>
                      Queries ativas ou aguardando recursos no momento.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingDiag ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : topQueries.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhuma query ativa no momento.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">PID</TableHead>
                            <TableHead className="w-28">State</TableHead>
                            <TableHead className="w-32">Wait Event</TableHead>
                            <TableHead className="w-24">Runtime</TableHead>
                            <TableHead>Query</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topQueries.map((q) => (
                            <TableRow key={q.pid}>
                              <TableCell className="font-mono">{q.pid}</TableCell>
                              <TableCell>
                                <Badge variant={q.state === 'active' ? 'default' : 'secondary'}>
                                  {q.state}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">{q.wait_event || '—'}</TableCell>
                              <TableCell className="font-mono text-xs">{q.runtime}</TableCell>
                              <TableCell className="font-mono text-xs max-w-md truncate" title={q.query_snippet}>
                                {q.query_snippet}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Kit Worker Tab */}
          <TabsContent value="kit-worker" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Kit Worker
                </CardTitle>
                <CardDescription>
                  Processa fila de geração de documentos (PROC, DECL, CONTRATO) de forma assíncrona.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button 
                    onClick={handleRunKitWorker} 
                    disabled={runningKitWorker}
                  >
                    {runningKitWorker ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Executando...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Rodar Worker KIT (manual)
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={fetchKitJobs} disabled={loadingKitJobs}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingKitJobs ? 'animate-spin' : ''}`} />
                    Atualizar Lista
                  </Button>
                </div>

                {kitWorkerResult && (
                  <Alert variant={kitWorkerResult.error ? "destructive" : "default"}>
                    <AlertTitle>Resultado da Execução</AlertTitle>
                    <AlertDescription>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                        {JSON.stringify(kitWorkerResult, null, 2)}
                      </pre>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Últimos 10 Jobs</h4>
                  {loadingKitJobs ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : kitJobs.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum job encontrado</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Tentativas</TableHead>
                          <TableHead>Último Erro</TableHead>
                          <TableHead>Criado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {kitJobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell>
                              <Badge
                                variant={
                                  job.status === "done"
                                    ? "default"
                                    : job.status === "error"
                                    ? "destructive"
                                    : job.status === "running"
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {job.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{job.attempts}</TableCell>
                            <TableCell className="max-w-xs truncate text-xs" title={job.last_error || ""}>
                              {job.last_error || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {new Date(job.created_at).toLocaleString("pt-BR")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}
