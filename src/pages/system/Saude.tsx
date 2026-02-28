import { useState, useEffect } from 'react';
import { Activity, RefreshCw, AlertTriangle, Users, Briefcase, FileText, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getHealth, type HealthData } from '@/system/audit/governanceClient';

export default function Saude() {
  const officeId = sessionStorage.getItem('lexos_office_id');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    if (officeId) loadData();
  }, [officeId]);

  const loadData = async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const data = await getHealth(officeId);
      setHealth(data);
    } catch (err) {
      toast.error('Erro ao carregar dados de saúde');
    } finally {
      setLoading(false);
    }
  };

  const kpis = health?.kpis;
  const errors = health?.recent_errors || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Saúde do Sistema
          </h1>
          <p className="text-muted-foreground">KPIs, erros e performance</p>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Clientes</CardDescription>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis?.clients_count ?? '-'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Casos Ativos</CardDescription>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis?.cases_count ?? '-'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Documentos</CardDescription>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis?.documents_count ?? '-'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Membros</CardDescription>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis?.members_count ?? '-'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Erros Recentes ({errors.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum erro recente registrado
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {errors.map((error, i) => (
                  <div key={i} className="p-3 bg-muted rounded space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant={error.kind === 'UI_ERROR' ? 'destructive' : 'secondary'}>
                        {error.kind}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(error.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <pre className="text-xs font-mono overflow-x-auto">
                      {JSON.stringify(error.payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
