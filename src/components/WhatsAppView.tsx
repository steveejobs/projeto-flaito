import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCcw, Trash2, CheckCircle2, AlertCircle, QrCode, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface WhatsAppInstance {
  id: string;
  status: string;
  is_connected: boolean;
  instance_name: string;
  server_url: string;
  instance_token: string;
  last_connection_at?: string;
}

export function WhatsAppView({ officeId }: { officeId: string }) {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  const loadInstance = useCallback(async (action: "get-or-create" | "qrcode" = "get-or-create") => {
    try {
      if (action === "get-or-create") setLoading(true);
      setError(null);
      
      const { data: dbInstances, error: dbErr } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, server_url, instance_token, status, is_connected, last_connection_at")
        .eq("office_id", officeId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (dbErr) {
        throw new Error("Erro ao consultar o banco de dados. " + dbErr.message);
      }

      let currentInstance: WhatsAppInstance | null = dbInstances && dbInstances.length > 0 ? dbInstances[0] as unknown as WhatsAppInstance : null;

      if (action === "get-or-create" && !currentInstance) {
        setGenerating(true);
        console.log("[WhatsApp] Nenhuma instância encontrada. Criando via API externa...");
        
        const createRes = await fetch("https://grlwciflaotripbumhve.supabase.co/functions/v1/create-instance-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: "okkrnvHHUdwz6TwKiNIOG28h82dc4ZKEcyxD",
            name: `wapi-${officeId.substring(0, 8)}`,
            deviceName: "Flaito CRM"
          })
        });

        if (!createRes.ok) throw new Error(`Falha ao criar na API: ${createRes.status}`);

        const apiData = await createRes.json();
        const webhookUrl = `${window.location.origin}/functions/v1/whatsapp-webhook?office_id=${officeId}`;
        
        const { data: userData } = await supabase.auth.getUser();
        
        const newInstanceData = {
          office_id: officeId,
          user_id: userData.user?.id,
          instance_name: apiData.instance?.name || `wapi-${officeId.substring(0, 8)}`,
          device_name: "Flaito CRM",
          server_url: apiData.server_url,
          instance_token: apiData["Instance Token"],
          token: apiData.token,
          webhook_url: webhookUrl,
          status: "created",
          is_connected: false,
          updated_at: new Date().toISOString()
        };

        const { data: saveRes, error: saveErr } = await supabase
          .from("whatsapp_instances")
          .insert(newInstanceData)
          .select("id, instance_name, server_url, instance_token, status, is_connected, last_connection_at")
          .single();

        if (saveErr) throw new Error("Falha ao salvar no banco: " + saveErr.message);
        currentInstance = saveRes as unknown as WhatsAppInstance;
      }

      setInstance(currentInstance);

      if (currentInstance && (!currentInstance.is_connected || action === "qrcode")) {
        setGenerating(true);
        try {
          const qrRes = await fetch(`${currentInstance.server_url}/instance/connect`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": currentInstance.instance_token,
            },
            body: JSON.stringify({})
          });

          if (qrRes.ok) {
            const qrJson = await qrRes.json();
            const connected = qrJson?.connected === true || qrJson?.instance?.status === "connected";
            
            if (connected) {
              setQrCode(null);
              setInstance(prev => prev ? { ...prev, is_connected: true, status: 'connected' } : null);
              
              await supabase.from("whatsapp_instances")
                .update({ is_connected: true, status: 'connected', last_connection_at: new Date().toISOString() })
                .eq("id", currentInstance.id);
                
              if (action === "qrcode") toast.success("WhatsApp conectado com sucesso!");
            } else {
              const base64Qr = qrJson?.instance?.qrcode || qrJson?.qrcode;
              if (base64Qr) {
                 setQrCode(base64Qr);
              }
            }
          }
        } catch (qrErr) {
          console.error("Erro ao buscar QR Code na API externa:", qrErr);
        }
      }

    } catch (err: any) {
      console.error("[WhatsApp Error]:", err);
      setError(err.message || "Erro de conexão com o serviço de WhatsApp.");
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, [officeId]);

  const fetchQrCode = useCallback(() => {
    loadInstance("qrcode");
  }, [loadInstance]);

  const handleDelete = async () => {
    if (!instance) return;
    if (!confirm("Isso apagará a instância atual do seu banco de dados e permitirá criar uma nova. Tem certeza?")) return;
    
    try {
      setLoading(true);
      const serverUrl = instance.server_url;
      if (serverUrl) {
        try {
          await fetch(`${serverUrl}/instance/logout`, {
            method: 'DELETE',
            headers: { 'token': instance.instance_token }
          });
        } catch (e) { /* ignora se falhar */ }
      }

      const { error } = await supabase.from("whatsapp_instances").delete().eq("id", instance.id);
      if (error) throw error;

      setInstance(null);
      setQrCode(null);
      toast.success("Instância removida com sucesso.");
    } catch (err) {
      toast.error("Erro ao remover a instância do banco.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!instance) return;
    try {
      setLoading(true);
      const serverUrl = instance.server_url;
      if (serverUrl) {
        await fetch(`${serverUrl}/instance/logout`, {
          method: 'DELETE',
          headers: { 'token': instance.instance_token }
        });
      }
      
      await supabase.from("whatsapp_instances").update({ is_connected: false, status: 'disconnected' }).eq("id", instance.id);
      setInstance(prev => prev ? { ...prev, is_connected: false, status: 'disconnected' } : null);
      setQrCode(null);
      toast.info("Aparelho desconectado.");
      fetchQrCode();
    } catch (err) {
      toast.error("Não foi possível desconectar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!instance || instance.is_connected) return;
    const interval = setInterval(() => {
      loadInstance("qrcode");
    }, 15000);
    return () => clearInterval(interval);
  }, [instance, loadInstance]);

  useEffect(() => {
    if (lockRef.current) return;
    lockRef.current = true;
    loadInstance("get-or-create");
  }, [loadInstance]);

  if (loading && !instance && !qrCode) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Sincronizando com a rede...</p>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="p-16 flex flex-col items-center justify-center space-y-6 bg-background rounded-3xl border border-border shadow-sm text-center">
        <div className={`h-24 w-24 rounded-full ${error ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'} flex items-center justify-center mb-2 shadow-inner`}>
          {error ? <AlertCircle className="h-10 w-10" /> : <QrCode className="h-10 w-10" />}
        </div>
        <div className="space-y-3">
          <h3 className="text-2xl font-bold tracking-tight text-foreground">{error ? "Ops! Algo deu errado" : "Configurando Conexão"}</h3>
          <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            {error ? error : "Aguarde enquanto preparamos seu ambiente dedicado e seguro para o WhatsApp."}
          </p>
        </div>
        <Button 
          onClick={() => loadInstance("get-or-create")} 
          disabled={loading || generating}
          size="lg"
          className="gap-2 mt-4 rounded-full px-8 shadow-md"
        >
          {loading || generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCcw className="h-5 w-5" />}
          {error ? "Tentar Novamente" : "Criando Ambiente..."}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-card rounded-2xl border border-border shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="flex items-center gap-5 z-10 w-full sm:w-auto">
          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner transition-colors duration-300 ${instance.is_connected ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20'}`}>
            {instance.is_connected ? <CheckCircle2 className="h-7 w-7" /> : <Smartphone className="h-7 w-7" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h4 className="text-lg font-bold text-card-foreground">{instance.instance_name}</h4>
              <Badge variant={instance.is_connected ? "default" : "secondary"} className={`uppercase text-[10px] tracking-wider font-bold ${instance.is_connected ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}`}>
                {instance.is_connected ? "Ativo e Sincronizado" : "Aguardando Aparelho"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-border" />
              Gateway: <span className="font-mono text-xs">{instance.server_url.replace('https://', '')}</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-4 sm:mt-0 z-10 w-full sm:w-auto justify-end">
          <Button variant="outline" size="sm" onClick={fetchQrCode} disabled={generating} className="gap-2 rounded-full font-medium">
            <RefreshCcw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} /> {generating ? 'Sincronizando...' : 'Atualizar'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-full h-9 w-9 p-0 flex-shrink-0">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Apagar Instância</span>
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
        
        {instance.is_connected ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-6 text-center">
            <div className="h-24 w-24 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2 relative">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping opacity-20" />
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-extrabold tracking-tight text-foreground">Aparelho Conectado</h3>
              <p className="text-base text-muted-foreground max-w-sm mx-auto">
                Sua rede está criptografada e pronta para orquestrar o envio e recebimento de mensagens.
              </p>
            </div>
            <Button variant="outline" onClick={handleDisconnect} className="mt-8 rounded-full border-border hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-all font-medium px-8 h-12">
              Desconectar Sessão Atual
            </Button>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="p-10 md:w-1/2 flex flex-col justify-center space-y-8 bg-muted/10">
              <div>
                <h3 className="text-2xl font-extrabold tracking-tight text-foreground mb-2">Conecte o Dispositivo</h3>
                <p className="text-muted-foreground">Para garantir a segurança ponta-a-ponta, faça a leitura do código através do seu aplicativo original.</p>
              </div>
              
              <ol className="space-y-6">
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">1</div>
                  <p className="text-sm font-medium pt-1.5 text-foreground">Abra o WhatsApp no seu celular</p>
                </li>
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">2</div>
                  <p className="text-sm font-medium text-foreground">Vá em Configurações <span className="block text-muted-foreground text-xs mt-1 font-normal">No Android (⋮) ou no iOS (Engrenagem)</span></p>
                </li>
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">3</div>
                  <p className="text-sm font-medium pt-1.5 text-foreground">Acesse <strong>Aparelhos Conectados</strong> e aponte a câmera</p>
                </li>
              </ol>
            </div>

            <div className="p-10 md:w-1/2 flex flex-col items-center justify-center bg-card">
              <div className="relative p-6 bg-white rounded-3xl border border-border shadow-lg">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl -translate-x-2 -translate-y-2 opacity-50" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl translate-x-2 -translate-y-2 opacity-50" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl -translate-x-2 translate-y-2 opacity-50" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl translate-x-2 translate-y-2 opacity-50" />

                {qrCode ? (
                  <img src={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-64 h-64 object-contain rounded-lg mix-blend-multiply" />
                ) : (
                  <div className="w-64 h-64 flex flex-col items-center justify-center space-y-4 bg-muted/30 rounded-xl">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-widest">Negociando Chaves...</p>
                  </div>
                )}
                
                {generating && qrCode && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center rounded-3xl z-10">
                    <div className="bg-white shadow-xl p-4 rounded-full flex gap-3 items-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">Atualizando</span>
                    </div>
                  </div>
                )}
              </div>

              <Button variant="ghost" onClick={fetchQrCode} className="mt-8 text-muted-foreground hover:text-foreground font-medium rounded-full">
                Não conseguiu ler? Gerar novo código
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
