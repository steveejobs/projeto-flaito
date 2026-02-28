import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Play, RefreshCw, FileText, Activity, GitBranch, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { runFullAudit, getLatestSnapshots, getHealth, type AuditSnapshot, type HealthData } from '@/system/audit/governanceClient';

export default function Governanca() {
  const navigate = useNavigate();
  const officeId = sessionStorage.getItem('lexos_office_id');
  const [loading, setLoading] = useState(false);
  const [latestSnapshot, setLatestSnapshot] = useState<AuditSnapshot | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    if (officeId) {
      loadData();
    }
  }, [officeId]);

  const loadData = async () => {
    if (!officeId) return;
    try {
      const [snapshots, healthData] = await Promise.all([
        getLatestSnapshots(officeId, 1),
        getHealth(officeId),
      ]);
      setLatestSnapshot(snapshots[0] || null);
      setHealth(healthData);
    } catch (err) {
      console.error('Error loading governance data:', err);
    }
  };

  const handleRunAudit = async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const result = await runFullAudit(officeId);
      toast.success('Auditoria completa gerada', { description: `Snapshot: ${result.snapshot_id.slice(0, 8)}...` });
      loadData();
    } catch (err) {
      toast.error('Erro ao gerar auditoria', { description: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    { title: 'Relatório', description: 'Relatório consolidado', icon: FileText, path: '/system/governance-report' },
    { title: 'Auditoria', description: 'DB, Frontend, Edge, Matriz', icon: FileText, path: '/system/auditoria' },
    { title: 'Diagramas', description: 'Mermaid e arquitetura', icon: GitBranch, path: '/system/diagramas' },
    { title: 'Matriz de Acesso', description: 'RBAC × RLS', icon: Lock, path: '/system/matriz-acesso' },
    { title: 'Integrações', description: 'Edge/RPC map', icon: Activity, path: '/system/integracoes' },
    { title: 'Rebuild', description: 'PLAN/APPLY/Export', icon: RefreshCw, path: '/system/rebuild' },
    { title: 'Saúde', description: 'KPIs e erros', icon: Activity, path: '/system/saude' },
    { title: 'Simulador', description: 'Testar políticas', icon: Shield, path: '/system/policy-simulator' },
    { title: 'Ambientes', description: 'DEV/STAGING/PROD', icon: GitBranch, path: '/system/environments' },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Centro de Governança
          </h1>
          <p className="text-muted-foreground mt-1">
            Auditoria contínua, simulação de políticas e controle de ambientes
          </p>
        </div>
        <Button onClick={handleRunAudit} disabled={loading} size="lg">
          <Play className="mr-2 h-4 w-4" />
          {loading ? 'Gerando...' : 'Rodar Auditoria Completa'}
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Último Snapshot</CardDescription>
            <CardTitle className="text-lg">
              {latestSnapshot ? new Date(latestSnapshot.created_at).toLocaleDateString('pt-BR') : 'Nenhum'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestSnapshot && (
              <Badge variant={latestSnapshot.status === 'DONE' ? 'default' : 'destructive'}>
                {latestSnapshot.status}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Clientes</CardDescription>
            <CardTitle className="text-2xl">{health?.kpis?.clients_count ?? '-'}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Casos Ativos</CardDescription>
            <CardTitle className="text-2xl">{health?.kpis?.cases_count ?? '-'}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Erros Recentes</CardDescription>
            <CardTitle className="text-2xl">{health?.recent_errors?.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card
            key={card.path}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate(card.path)}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <card.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{card.title}</CardTitle>
              </div>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
