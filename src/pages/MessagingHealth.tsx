import { useState, useEffect } from 'react';
import {
  Activity,
  RefreshCw,
  AlertCircle,
  Server,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function MessagingHealth() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    retrying: 0,
    failed: 0,
    failed_permanent: 0,
    sent_24h: 0
  });
  const [recentFailures, setRecentFailures] = useState<any[]>([]);
  const [workerStatus, setWorkerStatus] = useState<'online' | 'error' | 'idle'>('idle');

  const officeId = sessionStorage.getItem('lexos_office_id');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.warn("MessagingHealth: notificacoes_fila table no longer exists in schema");

      setStats({
        pending: 0,
        retrying: 0,
        failed: 0,
        failed_permanent: 0,
        sent_24h: 0
      });

      setRecentFailures([]);
      setWorkerStatus('idle');

      toast.warning('Monitoramento de mensageria indisponível — tabela removida do schema');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados de mensageria');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Saúde Mensageria
          </h1>
          <p className="text-muted-foreground">Monitoramento indisponível — tabela removida</p>
        </div>
        <Button onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Módulo Indisponível
          </CardTitle>
          <CardDescription>
            A tabela notificacoes_fila não existe mais no banco de dados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(stats).map(([key, value]) => (
              <Card key={key}>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{value}</div>
                  <p className="text-xs text-muted-foreground capitalize">{key}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
