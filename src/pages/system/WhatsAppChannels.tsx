import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeSession } from "@/hooks/useOfficeSession";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, 
  Settings2, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  Zap,
  Star,
  RefreshCw,
  Info
} from "lucide-react";
import { toast } from 'sonner';

const WhatsAppChannels = () => {
  const { user } = useAuth();
  const { officeId } = useOfficeSession(user?.id);
  const [instances, setInstances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [formData, setFormData] = useState({
    id: null,
    label: '',
    instance_id: '',
    instance_token: '',
    is_active: true,
    is_primary: false
  });

  const fetchInstances = async () => {
    if (!officeId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-admin', {
        body: { action: 'list', officeId }
      });
      if (error) throw error;
      setInstances(data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar instâncias: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, [officeId]);

  const handleVerify = async () => {
    if (!formData.instance_id || !formData.instance_token) {
      toast.error("Preencha ID e Token para testar.");
      return;
    }
    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-admin', {
        body: { 
          action: 'verify', 
          officeId,
          instanceId: formData.instance_id,
          token: formData.instance_token 
        }
      });

      if (error || !data.success) throw new Error(data?.error?.message || "Erro na validação.");
      
      toast.success("Conexão validada! Dispositivo: " + (data.data?.value || "Conectado"));
    } catch (err: any) {
      toast.error("Falha no teste: " + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase.functions.invoke('whatsapp-admin', {
        body: { 
          action: 'save', 
          officeId,
          data: formData
        }
      });
      if (error) throw error;
      toast.success("Canais atualizados com sucesso!");
      setIsFormOpen(false);
      fetchInstances();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Phone className="h-8 w-8 text-emerald-500" />
            Canais WhatsApp
          </h1>
          <p className="text-muted-foreground">Gerencie suas conexões Z-API e defina a instância principal de atendimento do escritório.</p>
        </div>
        <Button 
          onClick={() => {
            setFormData({ id: null, label: '', instance_id: '', instance_token: '', is_active: true, is_primary: instances.length === 0 });
            setIsFormOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl"
        >
          <Plus className="h-4 w-4" /> Novo Canal
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {instances.map(inst => (
          <Card key={inst.id} className="bg-white/[0.02] border-white/5 hover:border-emerald-500/30 transition-all group overflow-hidden">
            <div className={`h-1.5 w-full ${inst.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <CardHeader className="p-4">
              <div className="flex justify-between items-start">
                <Badge variant="outline" className={`text-[10px] uppercase tracking-tighter ${inst.is_primary ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-white/5'}`}>
                  {inst.is_primary ? 'Principal' : 'Secundário'}
                </Badge>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                    setFormData(inst);
                    setIsFormOpen(true);
                  }}>
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardTitle className="text-lg font-bold mt-2 text-white flex items-center gap-2">
                 {inst.label || 'Instância Z-API'}
                 {inst.is_primary && <Star className="h-4 w-4 fill-emerald-500 text-emerald-500" />}
              </CardTitle>
              <CardDescription className="font-mono text-xs opacity-60">ID: {inst.instance_id}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="flex items-center justify-between text-xs p-2 bg-white/5 rounded-lg border border-white/5">
                <span className="text-muted-foreground">Token Mascarado</span>
                <span className="text-emerald-500 font-mono tracking-widest">{inst.instance_token}</span>
              </div>
              
              <div className="flex items-center justify-between gap-4">
                 <div className="flex flex-col">
                   <span className="text-[10px] uppercase font-bold text-muted-foreground">Status</span>
                   <span className={`text-xs font-bold ${inst.is_active ? 'text-emerald-500' : 'text-red-500'}`}>
                      {inst.is_active ? 'Ativo' : 'Inativo'}
                   </span>
                 </div>
                 <div className="flex flex-col text-right">
                   <span className="text-[10px] uppercase font-bold text-muted-foreground">Último Webhook</span>
                   <span className="text-xs text-white/70">
                      {inst.updated_at ? new Date(inst.updated_at).toLocaleDateString() : '--'}
                   </span>
                 </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {instances.length === 0 && !isLoading && (
          <div className="col-span-full py-20 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-muted-foreground">
             <Info className="h-10 w-10 mb-4 opacity-20" />
             <p className="uppercase text-xs tracking-widest font-bold">Nenhum canal configurado</p>
             <p className="text-sm mt-1">Adicione uma instância Z-API para começar.</p>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <Card className="w-full max-w-lg bg-[#09090b] border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500" />
              <CardHeader className="p-6">
                <CardTitle className="text-xl font-bold flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6 text-emerald-500" />
                  {formData.id ? 'Editar Canal' : 'Configurar Novo Canal'}
                </CardTitle>
                <CardDescription>Insira as credenciais da sua instância Z-API. O token será mascarado após salvo.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nome Amigável / Rótulo</label>
                  <Input 
                    value={formData.label} 
                    onChange={e => setFormData({...formData, label: e.target.value})}
                    placeholder="Ex: Comercial, Operacional..."
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Instance ID</label>
                    <Input 
                      value={formData.instance_id} 
                      onChange={e => setFormData({...formData, instance_id: e.target.value})}
                      placeholder="3C..."
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Instance Token</label>
                    <Input 
                      type="password"
                      value={formData.instance_token} 
                      onChange={e => setFormData({...formData, instance_token: e.target.value})}
                      placeholder="Token Z-API"
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6 p-4 bg-white/5 rounded-xl border border-white/5">
                   <div className="flex items-center gap-3 flex-1">
                      <Switch 
                        checked={formData.is_active} 
                        onCheckedChange={v => setFormData({...formData, is_active: v})} 
                      />
                      <div>
                        <p className="text-xs font-bold text-white">Canal Ativo</p>
                        <p className="text-[10px] text-muted-foreground">Habilitar recebimento e envio</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3 flex-1">
                      <Switch 
                        checked={formData.is_primary} 
                        onCheckedChange={v => setFormData({...formData, is_primary: v})} 
                      />
                      <div>
                        <p className="text-xs font-bold text-white">Instância Principal</p>
                        <p className="text-[10px] text-muted-foreground">Fallback automático para envios</p>
                      </div>
                   </div>
                </div>

                <div className="pt-2">
                  <Button 
                    variant="outline" 
                    className="w-full gap-2 border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-500"
                    onClick={handleVerify}
                    disabled={isVerifying}
                  >
                    {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Testar Conexão Oficial (/me)
                  </Button>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                   <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                   <Button onClick={handleSave} className="bg-white text-black hover:bg-white/90 px-8">Salvar Configuração</Button>
                </div>
              </CardContent>
           </Card>
        </div>
      )}
    </div>
  );
};

export default WhatsAppChannels;
