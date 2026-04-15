import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useServiceHealth, useResetCircuitBreaker } from "@/hooks/useOperations";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function ServiceHealthTab() {
  const { data: services, isLoading } = useServiceHealth();
  const resetCircuit = useResetCircuitBreaker();
  const { toast } = useToast();

  const handleReset = async (serviceName: string) => {
    try {
      await resetCircuit.mutateAsync(serviceName);
      toast({
        title: "Circuito Resetado",
        description: `O serviço ${serviceName} foi restaurado para o estado CLOSED.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Falha ao Resetar",
        description: err.message,
      });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Saúde dos Serviços Externos</CardTitle>
          <CardDescription>
            Monitoramento em tempo real de latência, erros e estado dos adaptadores resilientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead>Circuito</TableHead>
                <TableHead>Falhas (5m)</TableHead>
                <TableHead>Latência p95</TableHead>
                <TableHead>Total (24h)</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services?.map((service) => (
                <TableRow key={service.service_name}>
                  <TableCell className="font-semibold">{service.service_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       {service.circuit_state === 'CLOSED' ? (
                         <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                           <CheckCircle2 className="h-3 w-3" /> Fechado
                         </Badge>
                       ) : service.circuit_state === 'OPEN' ? (
                         <Badge variant="destructive" className="gap-1">
                           <XCircle className="h-3 w-3" /> ABERTO
                         </Badge>
                       ) : (
                         <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 gap-1">
                           <AlertCircle className="h-3 w-3" /> Meio Aberto
                         </Badge>
                       )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={service.error_rate_5m > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                      {(service.error_rate_5m * 100).toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs whitespace-nowrap">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {service.avg_latency_ms ? `${Math.round(service.avg_latency_ms)}ms` : '---'}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{service.total_calls_24h}</TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                      onClick={() => handleReset(service.service_name)}
                      disabled={service.circuit_state === 'CLOSED' || resetCircuit.isPending}
                      title="Forçar Fechamento (Reset)"
                    >
                      <RefreshCw className={`h-4 w-4 ${resetCircuit.isPending ? "animate-spin" : ""}`} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!services || services.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                    Nenhum serviço monitorado registrado no banco de dados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
