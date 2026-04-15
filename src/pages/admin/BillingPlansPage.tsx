import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface BillingPlan {
  id: string;
  office_id: string;
  name: string;
  description: string | null;
  value: number;
  billing_type: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | null;
  due_days: number | null;
  recurrence: 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | null;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function BillingPlansPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    value: '',
    billing_type: 'BOLETO' as 'BOLETO' | 'PIX' | 'CREDIT_CARD',
    due_days: '5',
    recurrence: 'NONE' as 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
    active: true,
  });

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: memberData } = await supabase
        .from('office_members').select('office_id')
        .eq('user_id', user.id).eq('is_active', true).limit(1).single();
      if (!memberData) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('billing_plans').select('*')
        .eq('office_id', memberData.office_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPlans(data || []);
    } catch (e) {
      console.error('Error loading plans:', e);
      toast({ title: 'Erro ao carregar planos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingPlan(null);
    setFormData({
      name: '', description: '', value: '',
      billing_type: 'BOLETO', due_days: '5',
      recurrence: 'NONE', active: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (plan: BillingPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      value: String(plan.value),
      billing_type: plan.billing_type || 'BOLETO',
      due_days: String(plan.due_days || 5),
      recurrence: plan.recurrence || 'NONE',
      active: plan.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.value) {
      toast({ title: 'Preencha nome e valor', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { data: memberData } = await supabase
        .from('office_members').select('office_id')
        .eq('user_id', user.id).eq('is_active', true).limit(1).single();
      if (!memberData) throw new Error('Escritório não encontrado');

      const payload = {
        office_id: memberData.office_id,
        name: formData.name,
        description: formData.description || null,
        value: parseFloat(formData.value),
        billing_type: formData.billing_type,
        due_days: parseInt(formData.due_days) || null,
        recurrence: formData.recurrence === 'NONE' ? null : formData.recurrence,
        active: formData.active,
      };

      if (editingPlan) {
        const { error } = await supabase.from('billing_plans').update(payload).eq('id', editingPlan.id);
        if (error) throw error;
        toast({ title: 'Plano atualizado' });
      } else {
        const { error } = await supabase.from('billing_plans').insert(payload);
        if (error) throw error;
        toast({ title: 'Plano criado' });
      }

      setDialogOpen(false);
      loadPlans();
    } catch (e) {
      toast({ title: 'Erro ao salvar plano', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este plano?')) return;
    const { error } = await supabase.from('billing_plans').update({ active: false }).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } else {
      toast({ title: 'Plano desativado' });
      loadPlans();
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Planos e Serviços</h2>
          <p className="text-muted-foreground">Gerencie os planos de cobrança do escritório</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo Plano
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Recorrência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum plano configurado. Crie o primeiro plano de cobrança.
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{plan.name}</p>
                        {plan.description && <p className="text-sm text-muted-foreground truncate max-w-xs">{plan.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{formatCurrency(plan.value)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{plan.billing_type || 'Padrão'}</Badge>
                    </TableCell>
                    <TableCell>{plan.due_days ? `${plan.due_days} dias` : 'Padrão'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{plan.recurrence || 'Única'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={plan.active ? 'default' : 'secondary'}>
                        {plan.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
            <DialogDescription>
              {editingPlan ? 'Atualize os dados do plano' : 'Crie um novo plano de cobrança'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do plano</Label>
              <Input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Consultoria Jurídica" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Descrição para a cobrança" />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0.01" value={formData.value} onChange={(e) => setFormData(p => ({ ...p, value: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de cobrança</Label>
                <Select value={formData.billing_type} onValueChange={(v: 'BOLETO' | 'PIX' | 'CREDIT_CARD') => setFormData(p => ({ ...p, billing_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dias para vencimento</Label>
                <Input type="number" min="1" max="90" value={formData.due_days} onChange={(e) => setFormData(p => ({ ...p, due_days: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Recorrência</Label>
              <Select value={formData.recurrence} onValueChange={(v: 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY') => setFormData(p => ({ ...p, recurrence: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Nenhuma (cobrança única)</SelectItem>
                  <SelectItem value="MONTHLY">Mensal</SelectItem>
                  <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                  <SelectItem value="YEARLY">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Plano ativo</Label>
              <Switch checked={formData.active} onCheckedChange={(v) => setFormData(p => ({ ...p, active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingPlan ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
