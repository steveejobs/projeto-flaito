import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Link2, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface IntegrationJob {
  id: string;
  provider: string;
  kind: string;
  status: string;
  payload: any;
  result: any;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const PROVIDER_OPTIONS = [
  { value: 'datajud', label: 'DataJud (CNJ)' },
  { value: 'pje', label: 'PJe' },
  { value: 'esaj', label: 'e-SAJ' },
  { value: 'projudi', label: 'Projudi' },
  { value: 'webhook', label: 'Webhook Externo' },
];

const KIND_OPTIONS = [
  { value: 'sync_case', label: 'Sincronizar Caso' },
  { value: 'fetch_documents', label: 'Buscar Documentos' },
  { value: 'notify', label: 'Notificação' },
  { value: 'export', label: 'Exportação' },
];

export default function Integrations() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<IntegrationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    provider: 'datajud',
    kind: 'sync_case',
    payload: '{}',
  });

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: memberData } = await supabase
        .from('office_members')
        .select('office_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!memberData) throw new Error('Usuário sem escritório ativo');

      const { data, error } = await supabase
        .from('integration_jobs')
        .select('*')
        .eq('office_id', memberData.office_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setJobs(data || []);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleCreateJob = async () => {
    setSaving(true);
    try {
      let payloadObj = {};
      try {
        payloadObj = JSON.parse(formData.payload);
      } catch {
        toast({ title: 'Erro', description: 'Payload JSON inválido', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.rpc('enqueue_integration_job', {
        p_provider: formData.provider,
        p_kind: formData.kind,
        p_payload: payloadObj,
      });

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Job de integração criado' });
      setDialogOpen(false);
      setFormData({ provider: 'datajud', kind: 'sync_case', payload: '{}' });
      fetchJobs();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      queued: { className: 'bg-slate-100 text-slate-700', label: 'Na fila' },
      processing: { className: 'bg-blue-100 text-blue-700', label: 'Processando' },
      done: { className: 'bg-green-100 text-green-700', label: 'Concluído' },
      error: { className: 'bg-destructive/20 text-destructive', label: 'Erro' },
    };
    const c = config[status] || config.queued;
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Link2 className="h-6 w-6" />
            Integrações
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Novo Job
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-background">
                <DialogHeader>
                  <DialogTitle>Criar Job de Integração</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Provedor</Label>
                    <Select value={formData.provider} onValueChange={(v) => setFormData({ ...formData, provider: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {PROVIDER_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={formData.kind} onValueChange={(v) => setFormData({ ...formData, kind: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {KIND_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Payload (JSON)</Label>
                    <Textarea
                      value={formData.payload}
                      onChange={(e) => setFormData({ ...formData, payload: e.target.value })}
                      rows={4}
                      className="font-mono text-sm"
                    />
                  </div>
                  <Button onClick={handleCreateJob} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Criar Job
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Jobs de Integração</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">Nenhum job de integração criado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium capitalize">{job.provider}</TableCell>
                      <TableCell className="capitalize">{job.kind.replace('_', ' ')}</TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(job.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-destructive text-sm max-w-[200px] truncate">
                        {job.error || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
