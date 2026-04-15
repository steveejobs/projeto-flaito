import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useActiveIncidents } from "@/hooks/useOperations";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Clock, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ActiveIncidentsTab() {
  const { data: incidents, isLoading } = useActiveIncidents();

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Incidentes Ativos
            {incidents && incidents.length > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {incidents.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Anomalias detectadas automaticamente baseadas em padrões de erro e degradação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Problema</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Último Erro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents?.map((incident, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{incident.service_name}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={incident.severity === 'CRITICAL' ? 'destructive' : 'secondary'}
                      className={incident.severity === 'WARNING' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''}
                    >
                      {incident.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate" title={incident.error_summary}>
                    {incident.error_summary}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {incident.duration_minutes ? `${incident.duration_minutes} min` : '< 1 min'}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(incident.last_seen).toLocaleTimeString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" title="Investigar Trace">
                        <Search className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Ver logs externos" disabled>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!incidents || incidents.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 text-green-500 opacity-20" />
                      <p className="font-medium">Nenhum incidente ativo detectado.</p>
                      <p className="text-xs">O sistema está operando dentro dos parâmetros de normalidade.</p>
                    </div>
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
