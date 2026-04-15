import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertCircle, 
  RotateCcw, 
  CheckCircle2, 
  ExternalLink, 
  Terminal,
  Clock,
  Skull,
  History,
  MessageSquare,
  ShieldAlert,
  ArrowUpRight,
  RefreshCw,
  Search,
  Filter,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function LearningLoopDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [metricsRes, incidentsRes, clustersRes] = await Promise.all([
        supabase.from('learning_loop_metrics').select('*').single(),
        supabase.from('production_incidents').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('detect_incident_regression_gaps').select('*')
      ]);

      if (metricsRes.error) throw metricsRes.error;
      setMetrics(metricsRes.data);
      setIncidents(incidentsRes.data || []);
      setClusters(clustersRes.data || []);
    } catch (err: any) {
      toast.error('Erro ao carregar dados do ciclo de aprendizado');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
            <History className="h-8 w-8 text-primary" />
            LEARNING LOOP (STG-15)
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">
            Governança operacional: transformando incidentes em melhorias permanentes.
          </p>
        </div>
        <div className="flex gap-2">
            <Button 
                variant="outline" 
                onClick={fetchData} 
                disabled={refreshing}
                className="rounded-xl border-white/10 hover:bg-white/5"
            >
                <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                Sincronizar
            </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <ShieldAlert className="h-6 w-6 text-red-500 mb-2" />
              <span className="text-3xl font-black tabular-nums">{metrics?.postmortem_debt || 0}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-500/60 mt-2">Dívida de Postmortem</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <AlertCircle className="h-6 w-6 text-amber-500 mb-2" />
              <span className="text-3xl font-black tabular-nums">{metrics?.regression_gap_clusters || 0}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/60 mt-2">Gaps de Regressão</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <Clock className="h-6 w-6 text-primary mb-2" />
              <span className="text-3xl font-black tabular-nums">{Math.round(metrics?.mttr_min || 0)}m</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mt-2">MTTR Médio</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <MessageSquare className="h-6 w-6 text-blue-500 mb-2" />
              <span className="text-3xl font-black tabular-nums">{metrics?.pending_feedback_count || 0}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500/60 mt-2">Feedback Pendente</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Incidents */}
        <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Registro de Incidentes
                </h2>
                <Badge variant="outline" className="text-[10px]">{incidents.length} recentes</Badge>
            </div>
            
            <Card className="border-white/5 bg-card/50 overflow-hidden">
                <ScrollArea className="h-[500px]">
                    <div className="divide-y divide-border/20">
                        {incidents.map((incident) => (
                            <div key={incident.id} className="p-4 hover:bg-muted/30 transition-all group flex items-start justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Badge className={cn(
                                            "text-[9px] font-black uppercase px-2 py-0",
                                            incident.severity === 'SEV-1' ? 'bg-red-500 text-white' : 
                                            incident.severity === 'SEV-2' ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'
                                        )}>
                                            {incident.severity}
                                        </Badge>
                                        <h3 className="text-sm font-bold tracking-tight">{incident.title}</h3>
                                    </div>
                                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                                        <span className="flex items-center gap-1"><Terminal className="h-3 w-3" /> {incident.subsystem}</span>
                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(incident.created_at), 'dd MMM, HH:mm', { locale: ptBR })}</span>
                                        <Badge variant="outline" className="text-[9px] uppercase">{incident.status}</Badge>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full border border-white/5">
                                        <ArrowUpRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </Card>
        </div>

        {/* Regression Gaps */}
        <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Skull className="h-4 w-4 text-red-500" />
                Dívida Técnica (Gaps)
            </h2>
            <Card className="border-red-500/10 bg-red-500/5 shadow-2xl shadow-red-500/5">
                <CardHeader>
                    <CardTitle className="text-sm font-black flex items-center gap-2">
                        Clusters sem Cobertura
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold">
                        Falhas recorrentes que não possuem testes de regressão vinculados.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {clusters.map((cluster) => (
                            <div key={cluster.cluster_id} className="p-3 rounded-lg bg-background/50 border border-white/5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-red-400">{cluster.cluster_title}</span>
                                    <Badge className="bg-red-500/20 text-red-400 border-none text-[10px]">{cluster.incident_count} furos</Badge>
                                </div>
                                <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                                    <span>Visto por último: {format(new Date(cluster.last_seen_at), 'dd/MM/yy', { locale: ptBR })}</span>
                                    <Button variant="link" size="sm" className="h-auto p-0 text-[10px] text-primary">Criar Teste</Button>
                                </div>
                            </div>
                        ))}
                        {clusters.length === 0 && (
                            <div className="text-center py-8">
                                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-primary opacity-20" />
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Saúde Ótima: 0 Gaps</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
