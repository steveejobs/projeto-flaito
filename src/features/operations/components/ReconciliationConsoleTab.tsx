import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, RotateCcw, ShieldAlert, History, Activity, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export default function ReconciliationConsoleTab() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const { toast } = useToast();

  const handleRunReconciler = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("operational-reconciler", {
        body: { trigger_source: 'admin_dashboard' }
      });

      if (error) throw error;
      
      setLastResult(data);
      toast({
        title: "Reconciliador Concluído",
        description: `Processados: ${data.results.billing} cobranças, ${data.results.documents} docs, ${data.results.notifications} notificações.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Falha no Reconciliador",
        description: err.message,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Gatilho de Reconciliação Global
            </CardTitle>
            <CardDescription>
              Executa a lógica de sincronização forçada para todos os domínios (Asaas, ZapSign, Mensageria). 
              Seguro de rodar múltiplas vezes devido à idempotência nos adapters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row items-center gap-6 p-6 border rounded-lg bg-muted/20 relative overflow-hidden">
              <div className="flex-1 space-y-2">
                <h4 className="font-semibold text-sm">Ação de Alta Disponibilidade</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Utilize esta ferramenta quando identificar discrepâncias entre os provedores externos e o banco de dados do Flaito, ou após períodos de instabilidade de infraestrutura.
                </p>
              </div>
              <Button 
                onClick={handleRunReconciler} 
                disabled={isRunning}
                className="w-full md:w-auto min-w-[200px]"
                size="lg"
              >
                {isRunning ? (
                  <Activity className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {isRunning ? "Reconciliando..." : "Executar Agora"}
              </Button>
            </div>

            {lastResult && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Último Resultado</span>
                  <Badge variant="outline" className="font-mono text-[10px]">RID: {lastResult.correlationId?.slice(0,8)}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-background border rounded p-3 text-center">
                    <p className="text-2xl font-bold">{lastResult.results.billing}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Cobranças</p>
                  </div>
                  <div className="bg-background border rounded p-3 text-center">
                    <p className="text-2xl font-bold">{lastResult.results.documents}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Documentos</p>
                  </div>
                  <div className="bg-background border rounded p-3 text-center">
                    <p className="text-2xl font-bold">{lastResult.results.notifications}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Notificações</p>
                  </div>
                </div>
                {lastResult.results.errors?.length > 0 && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded p-3 text-xs text-destructive flex gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <ul className="list-disc ml-4 space-y-1">
                      {lastResult.results.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Histórico Operacional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex flex-col gap-4">
                <div className="border-l-2 border-primary/20 pl-4 py-1 space-y-1">
                  <p className="text-xs font-medium">Auto-Healing Cron</p>
                  <p className="text-[10px] text-muted-foreground italic">Executado pelo sistema há 15 min</p>
                </div>
                <div className="border-l-2 border-muted pl-4 py-1 space-y-1 opacity-50">
                  <p className="text-xs font-medium">Manual Trigger (Admin)</p>
                  <p className="text-[10px] text-muted-foreground italic">Executado há 2h por joao@flaito.com.br</p>
                </div>
                <div className="border-l-2 border-muted pl-4 py-1 space-y-1 opacity-50">
                  <p className="text-xs font-medium">Auto-Healing Cron</p>
                  <p className="text-[10px] text-muted-foreground italic">Executado há 4h</p>
                </div>
             </div>
             <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
               Ver Logs de Auditoria Completo
             </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-4 py-4">
           <Terminal className="h-5 w-5 text-primary opacity-50" />
           <p className="text-sm">
             <strong>Safe Mode:</strong> O reconciliador utiliza o sistema de <span className="underline decoration-primary/30">Idempotência Atômica</span>. Se um item já estiver sincronizado, ele será ignorado sem efeitos colaterais.
           </p>
        </CardContent>
      </Card>
    </div>
  );
}
