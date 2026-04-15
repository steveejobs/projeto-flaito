import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Info, ShieldInfo, Cpu, Network, Database } from "lucide-react";
import { useTraceExplorer } from "@/hooks/useOperations";
import { Skeleton } from "@/components/ui/skeleton";

export default function TraceExplorerTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTraceId, setActiveTraceId] = useState("");
  const { data: logs, isLoading } = useTraceExplorer(activeTraceId);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setActiveTraceId(searchTerm.trim());
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">SUCCESS</Badge>;
      case 'ERROR': return <Badge variant="destructive">ERROR</Badge>;
      case 'RETRY': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">RETRY</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('asaas')) return <Database className="h-3 w-3" />;
    if (action.includes('adapter')) return <Network className="h-3 w-3" />;
    if (action.includes('ai')) return <Cpu className="h-3 w-3" />;
    return <Info className="h-3 w-3" />;
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Rastreamento de Eventos (E2E Trace)
          </CardTitle>
          <CardDescription>
            Insira um Correlation ID ou External Event ID para visualizar a jornada completa da requisição em todos os sistemas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input 
              placeholder="Ex: 8a9d2f... ou pay_91238..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="font-mono text-sm max-w-xl"
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Buscando..." : "Explorar Trace"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      )}

      {activeTraceId && !isLoading && logs && logs.length > 0 && (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <CardHeader className="border-b bg-muted/10 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <ShieldInfo className="h-4 w-4 text-blue-500" />
                TRACE_SESSÃO: {activeTraceId}
              </CardTitle>
              <Badge variant="outline">{logs.length} Eventos</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/5">
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead>Ação / Contexto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mensagem / Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log, idx) => (
                  <TableRow key={idx} className="group cursor-default">
                    <TableCell className="text-[10px] font-mono whitespace-nowrap text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium text-xs">
                        <span className="p-1 rounded bg-muted">
                          {getActionIcon(log.action)}
                        </span>
                        {log.action}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="max-w-[400px]">
                      <div className="space-y-1">
                        <p className="text-xs line-clamp-2">{log.details || '---'}</p>
                        {log.metadata_json && (
                          <div className="hidden group-hover:block transition-all pt-2">
                             <pre className="text-[10px] bg-muted/50 p-2 rounded border font-mono overflow-auto max-h-[200px]">
                               {JSON.stringify(log.metadata_json, null, 2)}
                             </pre>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTraceId && !isLoading && (!logs || logs.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-lg border-2 border-dashed">
           <Search className="h-10 w-10 text-muted-foreground opacity-20 mb-4" />
           <h3 className="text-lg font-semibold">Nenhum log encontrado</h3>
           <p className="text-sm text-muted-foreground text-center max-w-sm">
             O Correlation ID informado não possui registros na tabela de auditoria técnica. Verifique se o ID está correto.
           </p>
        </div>
      )}

      {!activeTraceId && (
        <div className="flex flex-col items-center justify-center py-32 bg-muted/5 rounded-lg border-2 border-dashed border-muted">
           <div className="p-4 rounded-full bg-primary/5 mb-4">
             <Info className="h-8 w-8 text-primary opacity-40" />
           </div>
           <h3 className="text-lg font-medium opacity-60">Aguardando busca...</h3>
           <p className="text-sm text-muted-foreground">O Trace Explorer é uma ferramenta de busca sob demanda para otimizar performance.</p>
        </div>
      )}
    </div>
  );
}
