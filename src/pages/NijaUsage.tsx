import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight,
  Zap,
  Calendar,
  Activity,
  Download,
  FileText,
  AlertCircle,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface QuotaStatus {
  ok: boolean;
  reason?: string;
  office_id?: string;
  plan?: string;
  month?: string;
  limit?: number;
  used?: number;
  remaining?: number;
  soft_limit_reached?: boolean;
  hard_limit_reached?: boolean;
}

interface NijaUsageRecord {
  id: string;
  created_at: string;
  module: string;
  case_id: string | null;
  executed_by: string | null;
}

interface NijaLogRecord {
  id: string;
  created_at: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  source: string;
  action: string;
  case_id: string | null;
  session_id: string | null;
  duration_ms: number | null;
  error: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
}

const MODULE_LABELS: Record<string, string> = {
  prescricao: 'Prescrição',
  decadencia: 'Decadência',
  strategy_compare: 'Comparar Teses',
};

const PAGE_SIZE = 10;
const LOGS_PAGE_SIZE = 20;

export default function NijaUsage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('usage');
  const [loadingQuota, setLoadingQuota] = useState(true);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [usageRecords, setUsageRecords] = useState<NijaUsageRecord[]>([]);
  const [logRecords, setLogRecords] = useState<NijaLogRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [logsCount, setLogsCount] = useState(0);
  const [page, setPage] = useState(0);
  const [logsPage, setLogsPage] = useState(0);
  const [logsLevelFilter, setLogsLevelFilter] = useState<string>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  const fetchQuotaStatus = useCallback(async () => {
    setLoadingQuota(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_nija_quota_status');
      if (rpcError) throw rpcError;
      const result = data as unknown as QuotaStatus;
      setQuotaStatus(result);
      return result;
    } catch (err: any) {
      console.error('[NijaUsage] Error fetching quota:', err);
      setError('Erro ao carregar status de quota');
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível carregar o status de uso.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoadingQuota(false);
    }
  }, [toast]);

  const fetchUsageRecords = useCallback(async (officeId: string, pageNum: number) => {
    setLoadingUsage(true);
    try {
      // Get count first
      const { count, error: countError } = await supabase
        .from('nija_usage')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId);

      if (countError) throw countError;
      setTotalCount(count || 0);

      // Get paginated data
      const { data, error: fetchError } = await supabase
        .from('nija_usage')
        .select('id, created_at, module, case_id, executed_by')
        .eq('office_id', officeId)
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (fetchError) throw fetchError;
      setUsageRecords(data || []);
    } catch (err: any) {
      console.error('[NijaUsage] Error fetching usage records:', err);
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível carregar os registros de uso.',
        variant: 'destructive',
      });
    } finally {
      setLoadingUsage(false);
    }
  }, [toast]);

  const fetchLogRecords = useCallback(async (officeId: string, pageNum: number, levelFilter: string) => {
    setLoadingLogs(true);
    try {
      // Build query with optional level filter
      let countQuery = supabase
        .from('nija_logs')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId);
      
      if (levelFilter !== 'ALL') {
        countQuery = countQuery.eq('level', levelFilter);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setLogsCount(count || 0);

      // Get paginated data
      let dataQuery = supabase
        .from('nija_logs')
        .select('id, created_at, level, source, action, case_id, session_id, duration_ms, error, payload, result')
        .eq('office_id', officeId)
        .order('created_at', { ascending: false })
        .range(pageNum * LOGS_PAGE_SIZE, (pageNum + 1) * LOGS_PAGE_SIZE - 1);

      if (levelFilter !== 'ALL') {
        dataQuery = dataQuery.eq('level', levelFilter);
      }

      const { data, error: fetchError } = await dataQuery;
      if (fetchError) throw fetchError;
      setLogRecords((data || []) as NijaLogRecord[]);
    } catch (err: any) {
      console.error('[NijaUsage] Error fetching logs:', err);
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível carregar os logs.',
        variant: 'destructive',
      });
    } finally {
      setLoadingLogs(false);
    }
  }, [toast]);

  const handleRefresh = useCallback(async () => {
    const quota = await fetchQuotaStatus();
    if (quota?.office_id) {
      await fetchUsageRecords(quota.office_id, page);
      if (activeTab === 'logs') {
        await fetchLogRecords(quota.office_id, logsPage, logsLevelFilter);
      }
    }
  }, [fetchQuotaStatus, fetchUsageRecords, fetchLogRecords, page, logsPage, logsLevelFilter, activeTab]);

  useEffect(() => {
    const init = async () => {
      const quota = await fetchQuotaStatus();
      if (quota?.office_id) {
        await fetchUsageRecords(quota.office_id, 0);
      }
    };
    init();
  }, [fetchQuotaStatus, fetchUsageRecords]);

  useEffect(() => {
    if (quotaStatus?.office_id) {
      fetchUsageRecords(quotaStatus.office_id, page);
    }
  }, [page, quotaStatus?.office_id, fetchUsageRecords]);

  // Fetch logs when tab changes to logs or filters change
  useEffect(() => {
    if (activeTab === 'logs' && quotaStatus?.office_id) {
      fetchLogRecords(quotaStatus.office_id, logsPage, logsLevelFilter);
    }
  }, [activeTab, logsPage, logsLevelFilter, quotaStatus?.office_id, fetchLogRecords]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const totalLogsPages = Math.ceil(logsCount / LOGS_PAGE_SIZE);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getModuleLabel = (module: string) => {
    return MODULE_LABELS[module] || module;
  };

  const getUsagePercentage = () => {
    if (!quotaStatus?.limit || quotaStatus.limit === 0) return 0;
    return Math.round(((quotaStatus.used || 0) / quotaStatus.limit) * 100);
  };

  const getProgressColor = () => {
    const pct = getUsagePercentage();
    if (pct >= 100) return 'bg-destructive';
    if (pct >= 80) return 'bg-yellow-500';
    return 'bg-primary';
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'WARN':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getLevelBadgeVariant = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'destructive' as const;
      case 'WARN':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  const handleExportCsv = useCallback(async () => {
    if (!quotaStatus?.office_id || !quotaStatus?.month) {
      toast({
        title: 'Erro',
        description: 'Dados de escritório não disponíveis.',
        variant: 'destructive',
      });
      return;
    }

    setExportingCsv(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('v_nija_monthly_report' as any)
        .select('month, total_execucoes, prescricao, decadencia, ambos')
        .eq('office_id', quotaStatus.office_id)
        .eq('month', quotaStatus.month);

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        toast({
          title: 'Sem dados',
          description: 'Não há dados para exportar neste período.',
        });
        return;
      }

      // Generate CSV
      const headers = ['month', 'total_execucoes', 'prescricao', 'decadencia', 'ambos'];
      const csvRows = [
        headers.join(';'),
        ...data.map((row: any) =>
          headers.map((h) => row[h] ?? '').join(';')
        ),
      ];
      const csvContent = csvRows.join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nija-uso-${quotaStatus.month}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Exportado',
        description: 'CSV baixado com sucesso.',
      });
    } catch (err: any) {
      console.error('[NijaUsage] Error exporting CSV:', err);
      toast({
        title: 'Erro ao exportar',
        description: err.message || 'Não foi possível exportar o CSV.',
        variant: 'destructive',
      });
    } finally {
      setExportingCsv(false);
    }
  }, [quotaStatus, toast]);

  return (
    <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Uso NIJA</h1>
            <p className="text-muted-foreground">
              Acompanhe o consumo e logs do NIJA
            </p>
          </div>
          <div className="flex gap-2">
            {activeTab === 'usage' && (
              <Button
                variant="outline"
                onClick={handleExportCsv}
                disabled={loadingQuota || exportingCsv || !quotaStatus?.office_id}
              >
                <Download className={`h-4 w-4 mr-2 ${exportingCsv ? 'animate-pulse' : ''}`} />
                Exportar CSV
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loadingQuota || loadingUsage || loadingLogs}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(loadingQuota || loadingUsage || loadingLogs) ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="usage" className="gap-2">
              <Activity className="h-4 w-4" />
              Consumo
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <FileText className="h-4 w-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usage" className="space-y-6 mt-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Used */}
              <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Análises Usadas</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingQuota ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{quotaStatus?.used ?? 0}</div>
              )}
            </CardContent>
          </Card>

          {/* Limit */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Limite Mensal</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingQuota ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{quotaStatus?.limit ?? 0}</div>
              )}
            </CardContent>
          </Card>

          {/* Remaining */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Restantes</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingQuota ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-primary">{quotaStatus?.remaining ?? 0}</div>
              )}
            </CardContent>
          </Card>

          {/* Month */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Período</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingQuota ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{quotaStatus?.month ?? '-'}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Progress and Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Consumo do Mês</CardTitle>
                <CardDescription>Plano: {quotaStatus?.plan || '-'}</CardDescription>
              </div>
              <div className="flex gap-2">
                {loadingQuota ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <>
                    {quotaStatus?.hard_limit_reached && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Limite Atingido
                      </Badge>
                    )}
                    {quotaStatus?.soft_limit_reached && !quotaStatus?.hard_limit_reached && (
                      <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-300">
                        <AlertTriangle className="h-3 w-3" />
                        Próximo do Limite
                      </Badge>
                    )}
                    {!quotaStatus?.soft_limit_reached && !quotaStatus?.hard_limit_reached && (
                      <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 border-green-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Normal
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingQuota ? (
              <Skeleton className="h-4 w-full" />
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{quotaStatus?.used ?? 0} de {quotaStatus?.limit ?? 0} análises</span>
                  <span>{getUsagePercentage()}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${getProgressColor()}`}
                    style={{ width: `${Math.min(getUsagePercentage(), 100)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Uso</CardTitle>
            <CardDescription>
              Últimas análises NIJA realizadas pelo escritório
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingUsage ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : usageRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma análise NIJA realizada ainda.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Caso ID</TableHead>
                      <TableHead>Executado por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(record.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getModuleLabel(record.module)}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {record.case_id ? record.case_id.slice(0, 8) + '...' : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {record.executed_by ? record.executed_by.slice(0, 8) + '...' : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Página {page + 1} de {totalPages} ({totalCount} registros)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0 || loadingUsage}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1 || loadingUsage}
                      >
                        Próxima
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Logs do NIJA
                    </CardTitle>
                    <CardDescription>
                      Histórico de operações e erros do sistema NIJA
                    </CardDescription>
                  </div>
                  <Select value={logsLevelFilter} onValueChange={(v) => { setLogsLevelFilter(v); setLogsPage(0); }}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Filtrar nível" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos</SelectItem>
                      <SelectItem value="INFO">Info</SelectItem>
                      <SelectItem value="WARN">Warn</SelectItem>
                      <SelectItem value="ERROR">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loadingLogs ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : logRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum log encontrado.
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Nível</TableHead>
                          <TableHead className="w-[150px]">Data/Hora</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead className="w-[80px]">Duração</TableHead>
                          <TableHead>Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logRecords.map((log) => (
                          <TableRow key={log.id} className={log.level === 'ERROR' ? 'bg-destructive/5' : ''}>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {getLevelIcon(log.level)}
                                <Badge variant={getLevelBadgeVariant(log.level)} className="text-xs">
                                  {log.level}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {formatDateTime(log.created_at)}
                            </TableCell>
                            <TableCell className="font-mono text-xs max-w-[150px] truncate" title={log.source}>
                              {log.source}
                            </TableCell>
                            <TableCell className="font-mono text-xs max-w-[150px] truncate" title={log.action}>
                              {log.action}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px]">
                              {log.error ? (
                                <span className="text-destructive truncate block" title={JSON.stringify(log.error)}>
                                  {(log.error as any).message || JSON.stringify(log.error).slice(0, 50)}
                                </span>
                              ) : log.case_id ? (
                                <span className="text-muted-foreground truncate block" title={log.case_id}>
                                  Case: {log.case_id.slice(0, 8)}...
                                </span>
                              ) : log.session_id ? (
                                <span className="text-muted-foreground truncate block">
                                  Session: {log.session_id.slice(0, 8)}...
                                </span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    {totalLogsPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">
                          Página {logsPage + 1} de {totalLogsPages} ({logsCount} logs)
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLogsPage((p) => Math.max(0, p - 1))}
                            disabled={logsPage === 0 || loadingLogs}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Anterior
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLogsPage((p) => Math.min(totalLogsPages - 1, p + 1))}
                            disabled={logsPage >= totalLogsPages - 1 || loadingLogs}
                          >
                            Próxima
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}
