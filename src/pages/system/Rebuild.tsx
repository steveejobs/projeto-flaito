import { useState, useEffect } from 'react';
import { Wrench, Play, Download, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getLatestSnapshots, createRebuildJob, exportKit, type AuditSnapshot, type ExportKit, type RebuildJob } from '@/system/audit/governanceClient';

export default function Rebuild() {
  const officeId = sessionStorage.getItem('lexos_office_id');
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<AuditSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>('');
  const [mode, setMode] = useState<'PLAN' | 'APPLY_SAFE' | 'EXPORT'>('PLAN');
  const [result, setResult] = useState<RebuildJob | ExportKit | null>(null);

  useEffect(() => {
    if (officeId) loadData();
  }, [officeId]);

  const loadData = async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const snaps = await getLatestSnapshots(officeId, 10);
      setSnapshots(snaps);
      if (snaps.length > 0) setSelectedSnapshot(snaps[0].id);
    } catch (err) {
      toast.error('Erro ao carregar snapshots');
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    if (!officeId || !selectedSnapshot) return;
    setLoading(true);
    try {
      if (mode === 'EXPORT') {
        const kit = await exportKit(officeId, selectedSnapshot);
        setResult(kit);
        toast.success('Kit exportado');
      } else {
        const job = await createRebuildJob(officeId, selectedSnapshot, null, mode);
        setResult(job);
        toast.success(`Job ${mode} criado`);
      }
    } catch (err) {
      toast.error('Erro ao executar');
    } finally {
      setLoading(false);
    }
  };

  const copyContent = (content: string, name: string) => {
    navigator.clipboard.writeText(content);
    toast.success(`${name} copiado`);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isExportKit = (r: RebuildJob | ExportKit): r is ExportKit => 'diagrams_md' in r;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="h-6 w-6" />
            Rebuild Engine
          </h1>
          <p className="text-muted-foreground">PLAN / APPLY_SAFE / Export</p>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Snapshot</label>
              <Select value={selectedSnapshot} onValueChange={setSelectedSnapshot}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um snapshot" />
                </SelectTrigger>
                <SelectContent>
                  {snapshots.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.id.slice(0, 8)}... - {new Date(s.created_at).toLocaleDateString('pt-BR')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Modo</label>
              <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLAN">PLAN (Apenas Planejar)</SelectItem>
                  <SelectItem value="APPLY_SAFE">APPLY_SAFE (Aplicar Seguro)</SelectItem>
                  <SelectItem value="EXPORT">EXPORT (Exportar Kit)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={handleRun} disabled={loading || !selectedSnapshot} className="w-full">
                <Play className="mr-2 h-4 w-4" />
                {loading ? 'Executando...' : 'Executar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isExportKit(result) ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">rebuild_plan.md</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => copyContent(result.rebuild_plan_md, 'Plan')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => downloadFile(result.rebuild_plan_md, 'rebuild_plan.md')}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs font-mono whitespace-pre-wrap">{result.rebuild_plan_md}</pre>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">schema.sql</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => copyContent(result.schema_sql, 'Schema')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => downloadFile(result.schema_sql, 'schema.sql')}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs font-mono whitespace-pre-wrap">{result.schema_sql}</pre>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">rls.sql</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => copyContent(result.rls_sql, 'RLS')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => downloadFile(result.rls_sql, 'rls.sql')}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs font-mono whitespace-pre-wrap">{result.rls_sql}</pre>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">diagrams.md</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => copyContent(result.diagrams_md, 'Diagrams')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => downloadFile(result.diagrams_md, 'diagrams.md')}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs font-mono whitespace-pre-wrap">{result.diagrams_md}</pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Resultado do Job</CardTitle>
                <CardDescription>
                  <Badge>{result.status}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <pre className="text-xs font-mono whitespace-pre-wrap">{result.rebuild_plan_md}</pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
