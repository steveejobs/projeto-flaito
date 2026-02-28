import { useState, useEffect } from 'react';
import { Link2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getDbSnapshot, type DbSnapshot } from '@/system/audit/governanceClient';
import { buildFrontendManifest } from '@/system/audit/manifest';

export default function Integracoes() {
  const officeId = sessionStorage.getItem('lexos_office_id');
  const [loading, setLoading] = useState(false);
  const [dbSnapshot, setDbSnapshot] = useState<DbSnapshot | null>(null);

  useEffect(() => {
    if (officeId) loadData();
  }, [officeId]);

  const loadData = async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const db = await getDbSnapshot(officeId);
      setDbSnapshot(db);
    } catch (err) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const manifest = buildFrontendManifest();
  const services = manifest.services;
  const workflows = manifest.workflows;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6" />
            Mapa de Integrações
          </h1>
          <p className="text-muted-foreground">Edge Functions e RPCs por tela/serviço</p>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Serviços</CardTitle>
            <CardDescription>Mapeamento tela → RPCs/Edge</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {Object.entries(services).map(([key, value]) => (
                  <div key={key} className="p-3 bg-muted rounded space-y-2">
                    <div className="font-medium capitalize">{key}</div>
                    <div className="flex flex-wrap gap-1">
                      {value.rpcs.map((rpc, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          RPC: {rpc}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {value.edges.map((edge, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          Edge: {edge}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflows</CardTitle>
            <CardDescription>Fluxos de trabalho e integrações</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {Object.entries(workflows).map(([key, wf]) => (
                  <div key={key} className="p-3 bg-muted rounded space-y-2">
                    <div className="font-medium">{wf.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Etapas: {wf.steps.join(' → ')}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {wf.edges.map((edge, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {edge}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Funções RPC ({dbSnapshot?.functions?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {dbSnapshot?.functions?.map((f) => (
                  <div key={f.name} className="p-2 bg-muted rounded text-sm">
                    <div className="font-mono truncate">{f.name}</div>
                    <Badge 
                      variant={f.security_definer ? 'destructive' : 'default'} 
                      className="text-xs mt-1"
                    >
                      {f.security_definer ? 'DEFINER' : 'INVOKER'}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
