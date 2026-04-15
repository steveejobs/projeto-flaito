import React, { useState, useEffect } from "react";
import { useEscavador } from "@/hooks/useEscavador";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, Monitor, History, Wallet, RefreshCw, Send, Plus, Link, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function EscavadorDashboard() {
  const { searchProcesso, getSaldo, listMonitoramentos, removeMonitoramento, loading } = useEscavador();
  const [saldo, setSaldo] = useState<any>(null);
  const [monitoramentos, setMonitoramentos] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [searchCnj, setSearchCnj] = useState("");

  const refreshData = async () => {
    try {
      const [saldoData, monData] = await Promise.all([
        getSaldo(),
        listMonitoramentos()
      ]);
      setSaldo(saldoData);
      setMonitoramentos(monData.data || []);
      
      const { data: histData } = await supabase
        .from("escavador_search_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      setHistory(histData || []);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCnj) return;
    try {
      const result = await searchProcesso(searchCnj);
      toast({ title: "Busca Realizada", description: "O resultado foi carregado com sucesso." });
      refreshData();
      // Em produção aqui abriria um modal com o JSON detalhado
    } catch (err) {
      // Erro já tratado pelo hook
    }
  };

  const handleDeleteMonitoring = async (id: string, extId: string) => {
    if (!confirm("Deseja remover este monitoramento?")) return;
    try {
      await removeMonitoramento(id, extId);
      toast({ title: "Monitoramento Removido" });
      refreshData();
    } catch (err) {}
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Escavador Legal Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">Integração operacional de alta performance para o time jurídico.</p>
        </div>
        
        <Card className="bg-muted/50 border-none shadow-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Saldo Disponível</p>
              <p className="text-xl font-bold font-mono">
                {saldo ? `R$ ${saldo.saldo_centavos / 100}` : "---"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={refreshData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lado Esquerdo: Busca e Histórico */}
        <div className="lg:col-span-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Busca Rápida de Processo</CardTitle>
              <CardDescription>Consulte movimentações em diários e tribunais via CNJ.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input 
                    placeholder="0000000-00.0000.0.00.0000" 
                    className="pl-10 h-12 text-lg font-mono"
                    value={searchCnj}
                    onChange={(e) => setSearchCnj(e.target.value)}
                  />
                </div>
                <Button size="lg" className="h-12 px-8" disabled={loading}>
                  {loading ? <RefreshCw className="animate-spin mr-2" /> : <Send className="mr-2" />}
                  Buscar
                </Button>
              </form>
            </CardContent>
          </Card>

          <Tabs defaultValue="history" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="history">
                <History className="w-4 h-4 mr-2" />
                Histórico de Consultas
              </TabsTrigger>
              <TabsTrigger value="monitoring">
                <Monitor className="w-4 h-4 mr-2" />
                Monitoramento Ativo
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="history" className="space-y-4 pt-4">
              {history.length === 0 ? (
                <div className="text-center p-12 border-2 border-dashed rounded-lg text-muted-foreground">
                  Nenhuma busca registrada recentemente.
                </div>
              ) : (
                <div className="border rounded-md">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Processo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Data</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {history.map((req) => (
                        <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-sm">{req.numero_processo}</td>
                          <td className="px-4 py-3">
                            <Badge variant={req.status === 'COMPLETED' ? 'default' : req.status === 'FAILED' ? 'destructive' : 'secondary'}>
                              {req.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(req.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                             <Button variant="outline" size="sm" title="Criar Caso">
                               <Plus className="w-4 h-4" />
                             </Button>
                             <Button variant="outline" size="sm" title="Vincular Cliente">
                               <Link className="w-4 h-4" />
                             </Button>
                             <Button variant="outline" size="sm" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" title="Enviar para NIJA">
                               <RefreshCw className="w-4 h-4" />
                             </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-4 pt-4">
               <div className="flex justify-end">
                 <Button size="sm">
                   <Plus className="w-4 h-4 mr-1" /> Novo Monitoramento
                 </Button>
               </div>
               {monitoramentos.length === 0 ? (
                <div className="text-center p-12 border-2 border-dashed rounded-lg text-muted-foreground">
                  Nenhum processo sendo monitorado.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {monitoramentos.map((mon) => (
                    <Card key={mon.id}>
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-mono text-sm font-bold">{mon.numero_processo}</p>
                          <p className="text-xs text-muted-foreground">ID Externo: {mon.external_id}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteMonitoring(mon.id, mon.external_id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Lado Direito: Actions Express */}
        <div className="lg:col-span-4 space-y-6">
           <Card className="bg-blue-600 text-white">
             <CardHeader>
               <CardTitle className="text-lg">Power Suite Jurídico</CardTitle>
               <CardDescription className="text-blue-100">
                 Ações integradas com a Inteligência Flaito.
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <Button className="w-full bg-white text-blue-600 hover:bg-blue-50 justify-start h-auto py-3">
                 <div className="text-left">
                   <p className="font-bold flex items-center"><RefreshCw className="mr-2 w-4 h-4" /> Auditoria NIJA</p>
                   <p className="text-xs font-normal opacity-80">Gera relatório forense do processo buscado.</p>
                 </div>
               </Button>
               <Button className="w-full bg-blue-700 hover:bg-blue-800 border-none justify-start h-auto py-3">
                 <div className="text-left">
                   <p className="font-bold flex items-center"><Plus className="mr-2 w-4 h-4" /> Novo Dossier</p>
                   <p className="text-xs font-normal opacity-80">Inicia montagem automática do dossiê do processo.</p>
                 </div>
               </Button>
             </CardContent>
           </Card>

           <Card>
             <CardHeader>
                <CardTitle className="text-sm uppercase font-bold text-muted-foreground tracking-widest">Status SRE</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span>Latency Avg</span>
                  <span className="font-mono text-green-600 font-bold">~420ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate</span>
                  <span className="font-mono text-green-600 font-bold">99.8%</span>
                </div>
                <div className="flex justify-between">
                  <span>Webhooks Processed</span>
                  <span className="font-mono font-bold">1,240</span>
                </div>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
