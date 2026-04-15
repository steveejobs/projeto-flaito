import React, { useState, useEffect } from "react";
import { useEscavador } from "@/hooks/useEscavador";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Link as LinkIcon, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Plus, 
  Monitor,
  Ban,
  RefreshCw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EscavadorClientDockProps {
  clientId: string;
  clientName: string;
}

export default function EscavadorClientDock({ clientId, clientName }: EscavadorClientDockProps) {
  const { searchByClient, linkToClient, rejectSuggestion, getMetrics, autoProvisionCase, loading } = useEscavador();
  const [results, setResults] = useState<any[]>([]);
  const [linkedProcesses, setLinkedProcesses] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [searchUsed, setSearchUsed] = useState("");

  const loadCurrentLinks = async () => {
    const { data } = await supabase
      .from("client_linked_processes")
      .select("numero_processo")
      .eq("client_id", clientId);
    
    if (data) setLinkedProcesses(data.map(d => d.numero_processo));
  };

  const handleScan = async () => {
    try {
      const resp = await searchByClient(clientId);
      setResults(resp.data?.processos || resp.data?.items || []);
      setSearchUsed(resp.searchUsed);
      // Fetch metrics after scan
      const freshMetrics = await getMetrics();
      if (freshMetrics) setMetrics(freshMetrics);
      toast({ title: "Scanner Concluído", description: `Busca realizada via ${resp.searchUsed}.` });
    } catch (err) {}
  };

  const handleReject = async (link_id: string, is_permanent: boolean) => {
    try {
      if (is_permanent && !confirm("O processo será ignorado permanentemente para este cliente. Confirma?")) return;
      await rejectSuggestion(link_id, is_permanent);
      // Update local state: remove from results or mark as rejected
      setResults(prev => prev.filter(p => (p.link_id || p.id) !== link_id));
      toast({ title: is_permanent ? "Ignorado" : "Rejeitado", description: "Feedback enviado com sucesso." });
    } catch (err) {}
  };

  const handleAutoCreateCase = async (proc: any) => {
    try {
      if (!proc.link_id && !proc.id) throw new Error("ID de vínculo não disponível.");
      const res = await autoProvisionCase(proc.link_id || proc.id);
      if (res?.data?.id) {
        toast({ title: "Caso Criado", description: "O caso foi provisionado automaticamente com dados do Escavador." });
      }
    } catch (err) {
      toast({ title: "Erro na Automação", description: "Não foi possível criar o caso automaticamente.", variant: "destructive" });
    }
  };

  const handleLink = async (proc: any) => {
    const cnj = proc.numero_cnj || proc.numero;
    
    // Regra Tech Lead: Confirmação humana para NOME ou OAB
    const requiresManualConfirm = searchUsed === 'NOME' || searchUsed === 'OAB';
    
    if (requiresManualConfirm) {
      if (!confirm(`O vínculo para "${clientName}" foi sugerido por nome (Confiança Baixa). Confirma que o processo ${cnj} pertence a este cliente?`)) {
        return;
      }
    }

    try {
      await linkToClient({
        client_id: clientId,
        numero_processo: cnj,
        match_input_type: searchUsed as any,
        external_id: proc.id?.toString()
      });
      toast({ title: "Processo Vinculado", description: "O vínculo foi registrado no CRM." });
      loadCurrentLinks();
    } catch (err) {}
  };

  useEffect(() => {
    loadCurrentLinks();
  }, [clientId]);

  return (
    <Card className="h-full flex flex-col border-l shadow-none rounded-none">
      <CardHeader className="pb-3 px-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-bold flex items-center">
            <Search className="w-4 h-4 mr-2 text-primary" />
            Scanner Escavador
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleScan} disabled={loading}>
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Escanear"}
          </Button>
        </div>
        <CardDescription className="text-xs">
          Buscando processos vinculados a <strong>{clientName}</strong>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[calc(100vh-250px)] px-4">
          <div className="space-y-3 pb-4">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs">Nenhum processo sugerido.<br/>Clique em Escanear para buscar.</p>
              </div>
            ) : (
              results.map((proc, idx) => {
                const cnj = proc.numero_cnj || proc.numero;
                const isLinked = linkedProcesses.includes(cnj);
                
                // Heurística Visual de Score (Fase 3.2)
                const score = searchUsed === 'CPF_CNPJ' || searchUsed === 'CNJ' ? 100 : (searchUsed === 'OAB' ? 80 : 30);
                const scoreColor = score >= 90 ? 'bg-green-500' : score >= 70 ? 'bg-amber-500' : 'bg-red-400';
                const confidenceLabel = score >= 90 ? 'ELEVADA' : score >= 70 ? 'MÉDIA' : 'BAIXA';

                return (
                  <Card key={idx} className={`border ${isLinked ? 'bg-green-50/30' : ''} transition-all duration-300 hover:shadow-md`}>
                    <CardContent className="p-3 space-y-2">
                       <div className="flex justify-between items-start">
                          <code className="text-[10px] font-bold text-primary">{cnj}</code>
                          <Badge variant={score >= 90 ? 'default' : score >= 70 ? 'secondary' : 'outline'} className="text-[9px] h-4">
                            {confidenceLabel}
                          </Badge>
                       </div>

                       {/* Progress Bar de Confiança */}
                       <div className="space-y-1">
                          <div className="flex justify-between items-center text-[9px] text-muted-foreground uppercase tracking-tight">
                            <span>Confiança</span>
                            <span>{score}%</span>
                          </div>
                          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${scoreColor} transition-all duration-500`} 
                              style={{ width: `${score}%` }}
                            />
                          </div>
                       </div>
                       
                       <div className="text-[10px] text-muted-foreground line-clamp-2">
                         {proc.titulo_polo_ativo || proc.titulo || "Pólo não identificado"}
                       </div>

                       <div className="flex gap-1 pt-1">
                         {isLinked ? (
                            <div className="flex flex-col w-full gap-1">
                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 gap-1 w-full justify-center py-1">
                                <CheckCircle2 className="w-3 h-3" /> Vinculado
                                </Badge>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-7 text-[10px] w-full border-blue-100 text-blue-600 hover:bg-blue-50"
                                    onClick={() => handleAutoCreateCase(proc)}
                                >
                                    <Plus className="w-3 h-3 mr-1" /> Criar Caso Automático
                                </Button>
                            </div>
                         ) : (
                            <>
                              <Button size="sm" variant="default" className="h-7 text-[10px] flex-1" onClick={() => handleLink(proc)}>
                                <LinkIcon className="w-3 h-3 mr-1" /> Vincular
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 w-7 p-0 text-amber-600 border-amber-100 hover:bg-amber-50" 
                                title="Rejeitar Sugestão"
                                onClick={() => handleReject(proc.link_id || proc.id, false)}
                              >
                                <AlertCircle className="w-3 h-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 w-7 p-0 text-red-600 border-red-100 hover:bg-red-50" 
                                title="Ignorar Permanentemente"
                                onClick={() => handleReject(proc.link_id || proc.id, true)}
                              >
                                <Ban className="w-3 h-3" />
                              </Button>
                            </>
                         )}
                       </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
      
      {metrics && (
        <div className="px-4 py-2 border-t bg-slate-50/50 flex justify-between items-center text-[9px] text-muted-foreground">
          <span className="flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-1 text-green-600" />
            Taxa de Vínculo: <strong>{metrics.conversion_rate?.toFixed(1)}%</strong>
          </span>
          <span className="flex items-center">
            <RefreshCw className="w-3 h-3 mr-1 text-blue-600" />
            Sugestões: <strong>{metrics.total_suggestions}</strong>
          </span>
        </div>
      )}
      
      <div className="p-4 border-t bg-muted/30">
        <div className="grid grid-cols-2 gap-2">
           <Button variant="outline" size="sm" className="text-[10px] h-8">
             <Plus className="w-3 h-3 mr-1" /> Criar Caso
           </Button>
           <Button variant="outline" size="sm" className="text-[10px] h-8">
             <Monitor className="w-3 h-3 mr-1" /> Monitorar All
           </Button>
        </div>
      </div>
    </Card>
  );
}
