import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePendingStates } from "@/hooks/useOperations";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Tag, User, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PendingStatesTab() {
  const { data: pending, isLoading } = usePendingStates();

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'BILLING': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Financeiro</Badge>;
      case 'DOCUMENT': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Documental</Badge>;
      case 'NOTIFICATION': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Mensageria</Badge>;
      default: return <Badge variant="secondary">{category}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Backlog de Pendências (Pending States)</CardTitle>
          <CardDescription>
            Itens que falharam em sincronizar ou estão aguardando confirmação externa acima do tempo limite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead className="text-right">Mitigação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending?.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>{getCategoryBadge(item.category)}</TableCell>
                  <TableCell className="font-medium text-sm">{item.description}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                      <Clock className="h-3 w-3" />
                      {item.minutes_pending > 60 
                        ? `${Math.floor(item.minutes_pending / 60)}h ${Math.floor(item.minutes_pending % 60)}m` 
                        : `${Math.round(item.minutes_pending)}m`
                      }
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.severity === 'CRITICAL' ? 'destructive' : 'outline'}>
                      {item.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono max-w-[150px] truncate" title={item.correlation_ref}>
                    {item.correlation_ref || '---'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="h-8">
                       Reconciliar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!pending || pending.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 text-green-500 opacity-20" />
                      <p className="font-medium">Nenhuma pendência crítica.</p>
                      <p className="text-xs">Todos os fluxos assíncronos estão em dia.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="bg-muted/30 p-4 rounded border border-dashed text-xs text-muted-foreground flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          <strong>Observação:</strong> Itens em "BILLING" com severidade "CRITICAL" indicam que o pagamento foi possivelmente 
          criado no provedor mas o Flaito não recebeu a confirmação atômica. A reconciliação sincronizará o banco local.
        </p>
      </div>
    </div>
  );
}
