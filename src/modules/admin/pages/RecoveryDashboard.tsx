import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertCircle, 
  RotateCcw, 
  XCircle, 
  ExternalLink, 
  Search, 
  Filter,
  RefreshCw,
  Terminal,
  Clock,
  Skull
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

export default function RecoveryDashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFailedJobs = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('session_jobs')
        .select(`
          *,
          sessions (
            title,
            session_type
          )
        `)
        .in('status', ['failed', 'dead_lettered', 'claimed'])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (err: any) {
      toast.error('Erro ao carregar fila de recuperação');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFailedJobs();
  }, []);

  const handleRetry = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('session_jobs')
        .update({ 
          status: 'queued', 
          attempt_count: 0,
          last_error: null,
          scheduled_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) throw error;
      toast.success('Job reagendado com sucesso');
      fetchFailedJobs();
    } catch (err: any) {
      toast.error('Falha ao reagendar job');
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('session_jobs')
        .update({ status: 'cancelled' })
        .eq('id', jobId);

      if (error) throw error;
      toast.success('Job cancelado');
      fetchFailedJobs();
    } catch (err: any) {
      toast.error('Falha ao cancelar job');
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
            <Terminal className="h-8 w-8 text-primary" />
            RECUPERAÇÃO OPERACIONAL
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">
            Torre de comando para monitoria e recuperação de sessões travadas.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchFailedJobs} 
          disabled={refreshing}
          className="rounded-xl border-primary/20 hover:bg-primary/5"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Atualizar Lista
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI Cards */}
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <Skull className="h-8 w-8 text-red-500 mb-2" />
              <span className="text-4xl font-black tabular-nums">{jobs.filter(j => j.status === 'dead_lettered').length}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-500/60 mt-2">Dead Letters</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <Clock className="h-8 w-8 text-amber-500 mb-2" />
              <span className="text-4xl font-black tabular-nums">{jobs.filter(j => j.status === 'failed').length}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/60 mt-2">Falhas Temporárias</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <RefreshCw className="h-8 w-8 text-primary mb-2" />
              <span className="text-4xl font-black tabular-nums">{jobs.filter(j => j.status === 'claimed').length}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mt-2">Em Execução/Claimed</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/5 bg-card/50 overflow-hidden">
        <ScrollArea className="h-[600px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-muted/90 backdrop-blur-md z-20">
              <tr className="border-b border-border/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                <th className="px-6 py-4">Sessão / Job</th>
                <th className="px-6 py-4">Status / Tentativas</th>
                <th className="px-6 py-4">Último Erro</th>
                <th className="px-6 py-4">Última Atualização</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-muted-foreground">
                    <CheckCircle className="h-10 w-10 mx-auto mb-4 opacity-10" />
                    Nenhum job travado no momento. Excelente trabalho!
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm flex items-center gap-2">
                          {job.sessions?.title}
                          <Link to={`/sessions/${job.session_id}`} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="h-3 w-3 text-primary" />
                          </Link>
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase">{job.job_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn(
                          "text-[10px] px-1.5 py-0.5 font-bold uppercase",
                          job.status === 'dead_lettered' ? 'border-red-500 text-red-500 bg-red-500/5' : 
                          job.status === 'failed' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-primary text-primary'
                        )}>
                          {job.status}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Try {job.attempt_count}/{job.max_attempts}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] text-red-500/90 max-w-[300px] truncate group-hover:whitespace-normal font-mono bg-red-500/5 p-1 rounded">
                        {job.last_error || 'Sem logs de erro persistidos'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {format(new Date(job.updated_at), 'dd/MM/yy HH:mm:ss', { locale: ptBR })}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => handleRetry(job.id)}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" /> Retry
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 px-2 text-red-500 hover:text-red-500 hover:bg-red-500/10"
                          onClick={() => handleCancel(job.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Kill
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
    </div>
  );
}

import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
