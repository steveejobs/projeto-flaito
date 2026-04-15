import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, X, Clock, Send } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { Database } from '@/integrations/supabase/types';

type ChargeApproval = Database['public']['Tables']['charge_approvals']['Row'];

export default function BillingApprovalsPage() {
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<ChargeApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT_TO_ASAAS'>('PENDING');

  useEffect(() => { loadApprovals(); }, []);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: memberData } = await supabase
        .from('office_members').select('office_id')
        .eq('user_id', user.id).eq('is_active', true).limit(1).single();
      if (!memberData) { setLoading(false); return; }

      let query = supabase
        .from('charge_approvals').select('*')
        .eq('office_id', memberData.office_id)
        .order('created_at', { ascending: false });

      if (filter !== 'ALL') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setApprovals(data || []);
    } catch (e) {
      console.error('Error loading approvals:', e);
      toast({ title: 'Erro ao carregar aprovações', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const { data, error } = await supabase.functions.invoke('billing-approve', {
        body: { approval_id: id, approved: true },
      });
      if (error) throw error;
      toast({ title: data?.status === 'SENT_TO_ASAAS' ? 'Cobrança enviada para Asaas' : 'Cobrança aprovada' });
      loadApprovals();
    } catch (e) {
      toast({ title: 'Erro ao aprovar', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      toast({ title: 'Informe o motivo da recusa', variant: 'destructive' });
      return;
    }
    setActionLoading(id);
    try {
      const { data, error } = await supabase.functions.invoke('billing-approve', {
        body: { approval_id: id, approved: false, rejection_reason: rejectReason },
      });
      if (error) throw error;
      toast({ title: 'Cobrança recusada' });
      setRejectDialog(null);
      setRejectReason('');
      loadApprovals();
    } catch (e) {
      toast({ title: 'Erro ao recusar', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: React.ReactNode }> = {
      PENDING: { variant: 'default', label: 'Pendente', icon: <Clock className="h-3 w-3 mr-1" /> },
      APPROVED: { variant: 'outline', label: 'Aprovada', icon: <Check className="h-3 w-3 mr-1" /> },
      REJECTED: { variant: 'destructive', label: 'Recusada', icon: <X className="h-3 w-3 mr-1" /> },
      SENT_TO_ASAAS: { variant: 'secondary', label: 'Enviada', icon: <Send className="h-3 w-3 mr-1" /> },
    };
    const s = map[status] || { variant: 'outline' as const, label: status, icon: null };
    return <Badge variant={s.variant}>{s.icon}{s.label}</Badge>;
  };

  const filters: { value: typeof filter; label: string }[] = [
    { value: 'ALL', label: 'Todas' },
    { value: 'PENDING', label: 'Pendentes' },
    { value: 'APPROVED', label: 'Aprovadas' },
    { value: 'REJECTED', label: 'Recusadas' },
    { value: 'SENT_TO_ASAAS', label: 'Enviadas' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Aprovação de Cobranças</h2>
          <p className="text-muted-foreground">Revise e aprove cobranças pendentes</p>
        </div>
      </div>

      <div className="flex gap-2">
        {filters.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilter(f.value); loadApprovals(); }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {filter === 'PENDING' ? 'Nenhuma cobrança pendente de aprovação' : 'Nenhuma cobrança encontrada'}
                  </TableCell>
                </TableRow>
              ) : (
                approvals.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm">
                      {new Date(a.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium max-w-xs truncate">{a.description}</p>
                      {a.rejection_reason && (
                        <p className="text-xs text-destructive">Motivo: {a.rejection_reason}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{formatCurrency(a.value)}</TableCell>
                    <TableCell><Badge variant="outline">{a.billing_type}</Badge></TableCell>
                    <TableCell className="text-sm">{new Date(a.due_date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{statusBadge(a.status)}</TableCell>
                    <TableCell>
                      {a.status === 'PENDING' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm" variant="default"
                            disabled={actionLoading === a.id}
                            onClick={() => handleApprove(a.id)}
                          >
                            {actionLoading === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                            Aprovar
                          </Button>
                          <Button
                            size="sm" variant="destructive"
                            disabled={actionLoading === a.id}
                            onClick={() => setRejectDialog(a.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => { if (!open) { setRejectDialog(null); setRejectReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar Cobrança</DialogTitle>
            <DialogDescription>Informe o motivo da recusa</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo da recusa..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason(''); }}>Cancelar</Button>
            <Button variant="destructive" onClick={() => rejectDialog && handleReject(rejectDialog)} disabled={actionLoading === rejectDialog}>
              {actionLoading === rejectDialog ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
