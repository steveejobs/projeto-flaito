import { useState, useEffect } from 'react';
import { FileText, Database, Code, Grid, Activity, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getDbSnapshot, getLatestSnapshots, getMatrix, type DbSnapshot, type AuditSnapshot, type MatrixAccess } from '@/system/audit/governanceClient';
import { buildFrontendManifest } from '@/system/audit/manifest';

export default function Auditoria() {
  const officeId = sessionStorage.getItem('lexos_office_id');
  const [loading, setLoading] = useState(false);
  const [dbSnapshot, setDbSnapshot] = useState<DbSnapshot | null>(null);
  const [snapshots, setSnapshots] = useState<AuditSnapshot[]>([]);
  const [matrix, setMatrix] = useState<MatrixAccess | null>(null);

  useEffect(() => {
    if (officeId) loadData();
  }, [officeId]);

  const loadData = async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const [db, snaps, mat] = await Promise.all([
        getDbSnapshot(officeId),
        getLatestSnapshots(officeId, 10),
        getMatrix(officeId),
      ]);
      setDbSnapshot(db);
      setSnapshots(snaps);
      setMatrix(mat);
    } catch (err) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const frontendManifest = buildFrontendManifest();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Auditoria do Sistema
          </h1>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="db">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="db"><Database className="h-4 w-4 mr-1" /> DB</TabsTrigger>
          <TabsTrigger value="frontend"><Code className="h-4 w-4 mr-1" /> Frontend</TabsTrigger>
          <TabsTrigger value="edge"><Activity className="h-4 w-4 mr-1" /> Edge</TabsTrigger>
          <TabsTrigger value="matrix"><Grid className="h-4 w-4 mr-1" /> Matriz</TabsTrigger>
          <TabsTrigger value="health"><Activity className="h-4 w-4 mr-1" /> Saúde</TabsTrigger>
          <TabsTrigger value="export"><Download className="h-4 w-4 mr-1" /> Exportar</TabsTrigger>
        </TabsList>

        <TabsContent value="db" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle>Tabelas</CardTitle></CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">{dbSnapshot?.tables?.length ?? 0}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Policies</CardTitle></CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">{dbSnapshot?.policies?.length ?? 0}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Funções</CardTitle></CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">{dbSnapshot?.functions?.length ?? 0}</span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tabelas</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(JSON.stringify(dbSnapshot?.tables, null, 2), 'Tabelas')}>
                Copiar
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {dbSnapshot?.tables?.map((t) => (
                    <div key={t.name} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="font-mono text-sm">{t.name}</span>
                      <div className="flex gap-2">
                        <Badge variant={t.rls_enabled ? 'default' : 'destructive'}>
                          {t.rls_enabled ? 'RLS' : 'NO RLS'}
                        </Badge>
                        <Badge variant="outline">{t.kind}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frontend" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Rotas ({frontendManifest.routes.length})</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(JSON.stringify(frontendManifest.routes, null, 2), 'Rotas')}>
                Copiar
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {frontendManifest.routes.map((r) => (
                    <div key={r.path} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="font-mono text-sm">{r.path}</span>
                      <div className="flex gap-2">
                        <Badge variant={r.protected ? 'default' : 'secondary'}>
                          {r.protected ? 'Protegida' : 'Pública'}
                        </Badge>
                        {r.minRole && <Badge variant="outline">{r.minRole}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edge" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Edge Functions</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {frontendManifest.services.governance.edges.map((e) => (
                    <div key={e} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="font-mono text-sm">{e}</span>
                      <Badge variant="outline">Edge</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Matriz RBAC × RLS</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {matrix?.matrix?.map((m) => (
                    <div key={m.table} className="p-3 bg-muted rounded space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium">{m.table}</span>
                        <Badge variant={m.rls_enabled ? 'default' : 'destructive'}>
                          {m.rls_enabled ? 'RLS' : 'NO RLS'}
                        </Badge>
                      </div>
                      {m.policies && m.policies.length > 0 && (
                        <div className="pl-4 space-y-1">
                          {m.policies.map((p, i) => (
                            <div key={i} className="text-sm text-muted-foreground">
                              {p.name} ({p.cmd})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Snapshots Recentes</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {snapshots.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div>
                        <span className="font-mono text-sm">{s.id.slice(0, 8)}...</span>
                        <span className="text-muted-foreground text-sm ml-2">
                          {new Date(s.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <Badge variant={s.status === 'DONE' ? 'default' : 'destructive'}>
                        {s.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Exportar Manifesto Completo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => copyToClipboard(JSON.stringify(frontendManifest, null, 2), 'Manifesto')}>
                Copiar JSON do Frontend
              </Button>
              <Button variant="outline" onClick={() => copyToClipboard(JSON.stringify(dbSnapshot, null, 2), 'DB Snapshot')}>
                Copiar JSON do DB
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
