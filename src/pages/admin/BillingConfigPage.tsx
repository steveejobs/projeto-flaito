import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, RefreshCw, Shield, Eye, EyeOff, History, AlertTriangle } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { Database } from '@/integrations/supabase/types';

type BillingConfig = Database['public']['Tables']['billing_configs']['Row'];
type ConfigHistory = Database['public']['Tables']['billing_config_history']['Row'];

export default function BillingConfigPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [history, setHistory] = useState<ConfigHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookToken, setShowWebhookToken] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [formData, setFormData] = useState({
    enabled: true,
    environment: 'sandbox' as 'sandbox' | 'production',
    asaas_api_key: '',
    asaas_webhook_token: '',
    default_billing_type: 'BOLETO' as 'BOLETO' | 'PIX' | 'CREDIT_CARD',
    default_due_days: 5,
    default_description_template: 'Serviço: {{service}} - Cliente: {{client_name}}',
    require_manual_approval: false,
    auto_send_after_approval: true,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from('office_members')
        .select('office_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!memberData) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('billing_configs')
        .select('*')
        .eq('office_id', memberData.office_id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading billing config:', error);
        toast({ title: 'Erro ao carregar configuração', variant: 'destructive' });
      }

      if (data) {
        setConfig(data);
        setFormData({
          enabled: data.enabled,
          environment: data.environment,
          asaas_api_key: '',
          asaas_webhook_token: '',
          default_billing_type: data.default_billing_type,
          default_due_days: data.default_due_days,
          default_description_template: data.default_description_template || '',
          require_manual_approval: data.require_manual_approval,
          auto_send_after_approval: data.auto_send_after_approval,
        });

        const { data: histData } = await supabase
          .from('billing_config_history')
          .select('*')
          .eq('config_id', data.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (histData) setHistory(histData);
      }
    } catch (e) {
      console.error('Error loading config:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: memberData } = await supabase
        .from('office_members')
        .select('office_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!memberData) throw new Error('Escritório não encontrado');

      if (config) {
        const { error } = await supabase
          .from('billing_configs')
          .update({
            enabled: formData.enabled,
            environment: formData.environment,
            default_billing_type: formData.default_billing_type,
            default_due_days: formData.default_due_days,
            default_description_template: formData.default_description_template,
            require_manual_approval: formData.require_manual_approval,
            auto_send_after_approval: formData.auto_send_after_approval,
            updated_by: user.id,
          })
          .eq('id', config.id);

        if (error) throw error;
        toast({ title: 'Configuração atualizada com sucesso' });
      } else {
        const { data: newConfig, error } = await supabase
          .from('billing_configs')
          .insert({
            office_id: memberData.office_id,
            enabled: formData.enabled,
            environment: formData.environment,
            default_billing_type: formData.default_billing_type,
            default_due_days: formData.default_due_days,
            default_description_template: formData.default_description_template,
            require_manual_approval: formData.require_manual_approval,
            auto_send_after_approval: formData.auto_send_after_approval,
            updated_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        setConfig(newConfig);
        toast({ title: 'Configuração criada com sucesso' });
      }

      loadConfig();
    } catch (e) {
      console.error('Error saving config:', e);
      toast({
        title: 'Erro ao salvar configuração',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    toast({ title: 'Testando conexão...', description: 'Funcionalidade em desenvolvimento' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configuração de Cobrança</h2>
          <p className="text-muted-foreground">Gerencie a integração com Asaas para cobrança automática</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4 mr-1" />
            Histórico
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Integração */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Integração Asaas
            </CardTitle>
            <CardDescription>Configure a conexão com o gateway de pagamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Habilitar integração</Label>
                <p className="text-sm text-muted-foreground">Ativa/desativa cobrança via Asaas</p>
              </div>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, enabled: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select
                value={formData.environment}
                onValueChange={(v: 'sandbox' | 'production') =>
                  setFormData(prev => ({ ...prev, environment: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (Testes)</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>API Key do Asaas</Label>
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="$aas_..."
                  value={formData.asaas_api_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, asaas_api_key: e.target.value }))}
                />
                <Button variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure como secret no Supabase Dashboard para produção
              </p>
            </div>

            <div className="space-y-2">
              <Label>Webhook Token</Label>
              <div className="flex gap-2">
                <Input
                  type={showWebhookToken ? 'text' : 'password'}
                  placeholder="Token de 32-255 caracteres"
                  value={formData.asaas_webhook_token}
                  onChange={(e) => setFormData(prev => ({ ...prev, asaas_webhook_token: e.target.value }))}
                />
                <Button variant="outline" size="icon" onClick={() => setShowWebhookToken(!showWebhookToken)}>
                  {showWebhookToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={handleTestConnection}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Testar conexão
            </Button>
          </CardContent>
        </Card>

        {/* Padrões de Cobrança */}
        <Card>
          <CardHeader>
            <CardTitle>Padrões de Cobrança</CardTitle>
            <CardDescription>Valores padrão para novas cobranças</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo padrão</Label>
              <Select
                value={formData.default_billing_type}
                onValueChange={(v: 'BOLETO' | 'PIX' | 'CREDIT_CARD') =>
                  setFormData(prev => ({ ...prev, default_billing_type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dias para vencimento</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={formData.default_due_days}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  default_due_days: parseInt(e.target.value) || 5,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Template de descrição</Label>
              <Textarea
                value={formData.default_description_template}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  default_description_template: e.target.value,
                }))}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Placeholders: {'{{service}}'}, {'{{client_name}}'}, {'{{case_title}}'}, {'{{date}}'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Fluxo de Aprovação */}
        <Card>
          <CardHeader>
            <CardTitle>Fluxo de Aprovação</CardTitle>
            <CardDescription>Controle de aprovação antes de gerar cobranças</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Exigir aprovação manual</Label>
                <p className="text-sm text-muted-foreground">Cobranças aguardam aprovação antes de serem geradas</p>
              </div>
              <Switch
                checked={formData.require_manual_approval}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, require_manual_approval: v }))}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Envio automático após aprovação</Label>
                <p className="text-sm text-muted-foreground">Envia para Asaas automaticamente após aprovar</p>
              </div>
              <Switch
                checked={formData.auto_send_after_approval}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, auto_send_after_approval: v }))}
                disabled={!formData.require_manual_approval}
              />
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status da Integração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Integração</span>
              <Badge variant={formData.enabled ? 'default' : 'secondary'}>
                {formData.enabled ? 'Ativa' : 'Desativada'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ambiente</span>
              <Badge variant={formData.environment === 'production' ? 'destructive' : 'outline'}>
                {formData.environment === 'production' ? 'Produção' : 'Sandbox'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Aprovação manual</span>
              <Badge variant={formData.require_manual_approval ? 'default' : 'outline'}>
                {formData.require_manual_approval ? 'Obrigatória' : 'Automática'}
              </Badge>
            </div>

            {formData.environment === 'production' && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                <p className="text-sm text-destructive">
                  Ambiente de produção. Cobranças reais serão geradas.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Alterações</DialogTitle>
            <DialogDescription>Últimas modificações na configuração de cobrança</DialogDescription>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma alteração registrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Alteração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm">
                      {new Date(h.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{h.change_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono max-w-xs truncate">
                      {h.change_type === 'TOGGLED'
                        ? `enabled: ${h.old_value?.enabled} → ${h.new_value?.enabled}`
                        : h.change_type === 'CREATED'
                          ? 'Configuração inicial criada'
                          : 'Configuração atualizada'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
