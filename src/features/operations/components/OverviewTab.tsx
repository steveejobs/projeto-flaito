import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Activity, Clock, ShieldAlert } from "lucide-react";
import { useOperationsOverview, useServiceHealth } from "@/hooks/useOperations";
import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewTab() {
  const { data: overview, isLoading: loadingOverview } = useOperationsOverview();
  const { data: services, isLoading: loadingServices } = useServiceHealth();

  if (loadingOverview || loadingServices) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  // Identificar Alertas Críticos (Top Alerts)
  const openCircuits = services?.filter(s => s.circuit_state === 'OPEN') || [];
  const highErrorRate = services?.filter(s => s.error_rate_5m > 0.1) || [];

  return (
    <div className="space-y-6">
      {/* Top Alerts Section */}
      {(openCircuits.length > 0 || highErrorRate.length > 0) && (
        <div className="grid grid-cols-1 gap-4">
          <Card className="border-destructive bg-destructive/5">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive font-bold">Alertas Críticos de Produção</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {openCircuits.map(s => (
                <div key={s.service_name} className="flex items-center justify-between p-2 bg-white/50 rounded border border-destructive/20">
                  <span className="font-semibold text-destructive">Circuito ABERTO: {s.service_name}</span>
                  <Badge variant="destructive">Bloqueando Requisições</Badge>
                </div>
              ))}
              {highErrorRate.map(s => (
                <div key={s.service_name} className="flex items-center justify-between p-2 bg-white/50 rounded border border-warning/20">
                  <span className="font-semibold text-orange-600">Alta Taxa de Erro (5m): {s.service_name}</span>
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    {(s.error_rate_5m * 100).toFixed(1)}% de falha
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Operatinal KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Incidentes Ativos</CardDescription>
            <AlertCircle className={`h-4 w-4 ${overview?.active_incidents > 0 ? 'text-destructive' : 'text-green-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.active_incidents ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Críticos ou em degradação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Saúde Global</CardDescription>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.global_uptime_24h ? `${overview.global_uptime_24h}%` : '---'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Uptime médio (24h)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Pendências Externas</CardDescription>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.pending_payments_count ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Aguardando confirmação (Asaas)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Assinaturas Pendentes</CardDescription>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.pending_signatures_count ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">ZapSign (não sincronizado)</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted/30 p-4 rounded-lg border border-dashed text-center">
        <p className="text-sm text-muted-foreground italic">
          "Monitorar não é apenas ver o erro, é antecipar a degradação." — OCC Flaito
        </p>
      </div>
    </div>
  );
}
