import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { Bell, Loader2, Play, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Tipo derivado da view vw_deadline_alerts_pending (fonte única)
interface PendingAlert {
  id: string;
  office_id: string;
  case_id: string | null;
  deadline_id: string;
  fire_at: string;
  channel: string;
  status: string;
  tries: number;
  last_error: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ProcessResult {
  processed: number;
  failed: number;
}

interface DeadlineAlertsPendingProps {
  officeId?: string;
  limit?: number;
}

export function DeadlineAlertsPending({ officeId, limit = 50 }: DeadlineAlertsPendingProps) {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<PendingAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // REMOVIDO: useEffect automático - agora é on-demand apenas
  // SUPABASE-FIRST: Listar exclusivamente da view vw_deadline_alerts_pending
  const fetchPendingAlerts = async () => {
    // GUARD: precisa de officeId
    if (!officeId) {
      toast({ title: 'Erro', description: 'Escritório não identificado', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vw_deadline_alerts_pending' as any)
        .select('id, office_id, case_id, deadline_id, fire_at, channel, status, tries, last_error, payload, created_at, updated_at')
        .eq('office_id', officeId)
        .order('fire_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      setAlerts((data as PendingAlert[]) || []);
      setLoaded(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar alertas';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // SUPABASE-FIRST: Processar exclusivamente via RPC lexos_process_deadline_alerts
  const handleProcessAlerts = async () => {
    // GUARD: precisa de officeId
    if (!officeId) {
      toast({ title: 'Erro', description: 'Escritório não identificado', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('lexos_process_deadline_alerts' as any, {
        p_limit: limit,
      });

      if (error) throw error;

      // RPC retorna array com um único objeto { processed, failed }
      const resultArray = data as { processed: number; failed: number }[];
      const result: ProcessResult = resultArray?.[0] || { processed: 0, failed: 0 };
      
      toast({
        title: 'Processamento concluído',
        description: `Processados: ${result.processed} | Falhas: ${result.failed}`,
        variant: result.failed > 0 ? 'destructive' : 'default',
      });

      // Refetch da view após processamento
      await fetchPendingAlerts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao processar alertas';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      PENDING: 'Pendente',
      ENQUEUED: 'Na fila',
      FAILED: 'Falhou',
    };
    return labels[status] || status;
  };

  const getChannelLabel = (channel: string): string => {
    const labels: Record<string, string> = {
      email: 'E-mail',
      push: 'Push',
      sms: 'SMS',
    };
    return labels[channel] || channel;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          Alertas Pendentes
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPendingAlerts}
            disabled={loading || !officeId}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {loaded ? 'Atualizar' : 'Carregar'}
          </Button>
          <Button
            size="sm"
            onClick={handleProcessAlerts}
            disabled={processing || alerts.length === 0 || !officeId}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            Processar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <p className="text-center text-muted-foreground py-6">
            Clique em "Carregar" para ver os alertas pendentes
          </p>
        ) : loading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Disparo</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tentativas (server)</TableHead>
                <TableHead>Último Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={3} columns={5} />
            </TableBody>
          </Table>
        ) : alerts.length === 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Disparo</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tentativas (server)</TableHead>
                <TableHead>Último Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmptyState colSpan={5} message="Nenhum alerta pendente." />
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Disparo</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tentativas (server)</TableHead>
                <TableHead>Último Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell className="table-cell-primary">
                    {formatDateTime(alert.fire_at)}
                  </TableCell>
                  <TableCell className="table-cell-secondary">{getChannelLabel(alert.channel)}</TableCell>
                  <TableCell className="table-cell-secondary">{getStatusLabel(alert.status)}</TableCell>
                  <TableCell className="table-cell-mono text-center">{alert.tries}</TableCell>
                  <TableCell className="max-w-[200px] truncate table-cell-secondary">
                    {alert.last_error || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
