import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { Badge } from '@/components/ui/badge';
import { Plus, DollarSign, Trash2, Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Expense {
  id: string;
  case_id: string | null;
  description: string;
  kind: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  receipt_url: string | null;
  created_at: string;
}

interface CaseExpensesProps {
  caseId: string;
  canEdit: boolean;
}

const KIND_OPTIONS = [
  { value: 'custas', label: 'Custas Judiciais' },
  { value: 'honorarios', label: 'Honorários Periciais' },
  { value: 'diligencias', label: 'Diligências' },
  { value: 'certidoes', label: 'Certidões' },
  { value: 'outros', label: 'Outros' },
];

export function CaseExpenses({ caseId, canEdit }: CaseExpensesProps) {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    kind: 'custas',
    amount: '',
  });

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('case_expenses')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [caseId]);

  const handleCreate = async () => {
    if (!formData.description.trim()) {
      toast({ title: 'Erro', description: 'Descrição é obrigatória', variant: 'destructive' });
      return;
    }

    const amount = parseFloat(formData.amount.replace(',', '.')) || 0;

    setSaving(true);
    try {
      const { error } = await supabase.from('case_expenses').insert({
        case_id: caseId,
        description: formData.description.trim(),
        kind: formData.kind,
        amount,
      });

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Despesa registrada' });
      setDialogOpen(false);
      setFormData({ description: '', kind: 'custas', amount: '' });
      fetchExpenses();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('case_expenses')
        .update({ paid: true, paid_at: new Date().toISOString().split('T')[0] })
        .eq('id', expenseId);

      if (error) throw error;
      fetchExpenses();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('case_expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Despesa excluída' });
      fetchExpenses();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const paidAmount = expenses.filter((e) => e.paid).reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5" />
            Custas e Despesas
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Total: {formatCurrency(totalAmount)} | Pago: {formatCurrency(paidAmount)}
          </p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nova Despesa
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background">
              <DialogHeader>
                <DialogTitle>Nova Despesa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Descrição *</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Custas iniciais"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                    <Label>Valor (R$)</Label>
                    <Input
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Registrar Despesa
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="table-cell-actions">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={3} columns={5} />
            </TableBody>
          </Table>
        ) : expenses.length === 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="table-cell-actions">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmptyState colSpan={5} message="Nenhuma despesa registrada." />
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="table-cell-actions">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="table-cell-primary">{e.description}</TableCell>
                  <TableCell className="table-cell-secondary capitalize">{e.kind}</TableCell>
                  <TableCell className="table-cell-mono">{formatCurrency(Number(e.amount))}</TableCell>
                  <TableCell>
                    {e.paid ? (
                      <Badge variant="outline" className="bg-green-100 text-green-700">Pago</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-100 text-amber-700">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="table-cell-actions">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && !e.paid && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMarkPaid(e.id)}
                          title="Marcar como pago"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(e.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
