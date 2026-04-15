import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck,
  RefreshCw,
  Download,
  Copy,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface AuditMeta {
  tables_count?: number;
  policies_count?: number;
  functions_count?: number;
  views_count?: number;
  extensions_count?: number;
  generated_at?: string;
}

interface AuditRisk {
  CRÍTICO?: number;
  ALTO?: number;
  MÉDIO?: number;
  BAIXO?: number;
}

interface AuditSnapshot {
  id: string;
  created_at: string;
  created_by: string;
  status: string;
  meta: AuditMeta;
  risk: AuditRisk;
  report_md?: string;
}

interface AuditSnapshotRaw {
  id: string;
  created_at: string;
  created_by: string;
  status: string;
  meta: Json;
  risk: Json;
  report_md?: string;
}

// Parse raw data to typed snapshot
function parseSnapshot(raw: AuditSnapshotRaw): AuditSnapshot {
  return {
    id: raw.id,
    created_at: raw.created_at,
    created_by: raw.created_by,
    status: raw.status,
    meta: (typeof raw.meta === 'object' && raw.meta !== null ? raw.meta : {}) as AuditMeta,
    risk: (typeof raw.risk === 'object' && raw.risk !== null ? raw.risk : {}) as AuditRisk,
    report_md: raw.report_md,
  };
}

export default function AuditoriaTecnicaPage() {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<AuditSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<AuditSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  // Carregar lista de snapshots
  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_snapshots')
        .select('id, created_at, created_by, status, meta, risk')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        if (error.code === '42501' || error.message?.includes('permission')) {
          toast.error('Acesso restrito a Administradores/Proprietários do escritório.');
        } else {
          toast.error('Erro ao carregar auditorias', { description: error.message });
        }
        return;
      }

      setSnapshots(((data as any) || []).map(parseSnapshot));
    } catch (err) {
      console.error('[AuditoriaTecnica] Fetch error:', err);
      toast.error('Erro inesperado ao carregar auditorias');
    } finally {
      setLoading(false);
    }
  };

  // Carregar report_md de um snapshot específico
  const loadSnapshotReport = async (snapshot: AuditSnapshot) => {
    if (snapshot.report_md) {
      setSelectedSnapshot(snapshot);
      return;
    }

    setLoadingReport(true);
    try {
      const { data, error } = await supabase
        .from('audit_snapshots')
        .select('report_md')
        .eq('id', snapshot.id)
        .single();

      if (error) {
        toast.error('Erro ao carregar relatório', { description: error.message });
        return;
      }

      setSelectedSnapshot({ ...snapshot, report_md: (data as any)?.report_md || '' });
    } catch (err) {
      console.error('[AuditoriaTecnica] Load report error:', err);
      toast.error('Erro inesperado ao carregar relatório');
    } finally {
      setLoadingReport(false);
    }
  };

  // Gerar nova auditoria
  const generateAudit = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('lexos-audit-snapshot', {
        body: {},
      });

      if (error) {
        if (error.message?.includes('403') || error.message?.includes('Access denied')) {
          toast.error('Acesso restrito a Administradores/Proprietários do escritório.');
        } else {
          toast.error('Erro ao gerar auditoria', { description: error.message });
        }
        return;
      }

      toast.success('Auditoria gerada com sucesso!');
      
      // Atualizar lista e selecionar o novo snapshot
      await fetchSnapshots();
      
      if (data?.snapshot_id) {
        const newSnapshot: AuditSnapshot = {
          id: data.snapshot_id,
          created_at: data.created_at,
          created_by: user?.id || '',
          status: 'DONE',
          meta: {},
          risk: data.risk_summary || {},
          report_md: data.report_md,
        };
        setSelectedSnapshot(newSnapshot);
      }
    } catch (err) {
      console.error('[AuditoriaTecnica] Generate error:', err);
      toast.error('Erro inesperado ao gerar auditoria');
    } finally {
      setGenerating(false);
    }
  };

  // Copiar relatório
  const copyReport = () => {
    if (!selectedSnapshot?.report_md) {
      toast.error('Nenhum relatório selecionado');
      return;
    }
    navigator.clipboard.writeText(selectedSnapshot.report_md);
    toast.success('Relatório copiado para a área de transferência');
  };

  // Baixar relatório como .md
  const downloadReport = () => {
    if (!selectedSnapshot?.report_md) {
      toast.error('Nenhum relatório selecionado');
      return;
    }

    const blob = new Blob([selectedSnapshot.report_md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-lexos-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Relatório baixado');
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  // Formatar data
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calcular total de riscos
  const getTotalRisks = (risk: AuditSnapshot['risk']) => {
    return (risk?.CRÍTICO || 0) + (risk?.ALTO || 0) + (risk?.MÉDIO || 0) + (risk?.BAIXO || 0);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Auditoria Técnica
          </h1>
          <p className="text-muted-foreground mt-1">
            Gera um snapshot do estado de segurança e governança do banco de dados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchSnapshots}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            onClick={generateAudit}
            disabled={generating}
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Gerar Auditoria
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Painel de Risco do Snapshot Selecionado */}
      {selectedSnapshot && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Resumo de Riscos</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyReport}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={downloadReport}>
                  <Download className="h-4 w-4 mr-1" />
                  Baixar .md
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Badge variant="destructive" className="text-sm px-3 py-1">
                <XCircle className="h-4 w-4 mr-1" />
                Crítico: {selectedSnapshot.risk?.CRÍTICO || 0}
              </Badge>
              <Badge className="bg-orange-500 hover:bg-orange-600 text-sm px-3 py-1">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Alto: {selectedSnapshot.risk?.ALTO || 0}
              </Badge>
              <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm px-3 py-1">
                <Info className="h-4 w-4 mr-1" />
                Médio: {selectedSnapshot.risk?.MÉDIO || 0}
              </Badge>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Baixo: {selectedSnapshot.risk?.BAIXO || 0}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Snapshots */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Auditorias</CardTitle>
            <CardDescription>Últimas 20 auditorias geradas</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : snapshots.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma auditoria encontrada.</p>
                  <p className="text-sm mt-1">Clique em "Gerar Auditoria" para criar a primeira.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {snapshots.map((snapshot) => (
                    <button
                      key={snapshot.id}
                      onClick={() => loadSnapshotReport(snapshot)}
                      className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                        selectedSnapshot?.id === snapshot.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">
                          {formatDate(snapshot.created_at)}
                        </span>
                        <Badge
                          variant={snapshot.status === 'DONE' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {snapshot.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{getTotalRisks(snapshot.risk)} riscos detectados</span>
                      </div>
                      {snapshot.risk?.CRÍTICO && snapshot.risk.CRÍTICO > 0 && (
                        <Badge variant="destructive" className="mt-2 text-xs">
                          {snapshot.risk.CRÍTICO} crítico(s)
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Visualizador de Relatório */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Relatório</CardTitle>
            <CardDescription>
              {selectedSnapshot
                ? `Auditoria de ${formatDate(selectedSnapshot.created_at)}`
                : 'Selecione uma auditoria para visualizar o relatório'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingReport ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : selectedSnapshot?.report_md ? (
              <ScrollArea className="h-[600px] rounded-md border p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                  {selectedSnapshot.report_md}
                </pre>
              </ScrollArea>
            ) : (
              <div className="h-[600px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <ShieldCheck className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p>Selecione uma auditoria na lista</p>
                  <p className="text-sm mt-1">ou gere uma nova auditoria</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
