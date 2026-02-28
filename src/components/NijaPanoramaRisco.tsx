import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Shield, TrendingUp, Zap, CheckCircle } from "lucide-react";

interface NijaPanoramaRiscoProps {
  highestSeverity?: string;
  defectsCount: number;
  mode: "AUTOMATIC" | "SUPERVISED";
  mainStrategiesCount: number;
  secondaryStrategiesCount: number;
  ramoLabel?: string;
  isAnalyzing?: boolean;
}

function severityLabelColor(severity?: string) {
  switch (severity) {
    case "CRITICA":
      return "bg-red-600 text-white";
    case "ALTA":
      return "bg-orange-500 text-white";
    case "MEDIA":
      return "bg-yellow-500 text-black";
    case "BAIXA":
      return "bg-green-600 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function severityProgress(severity?: string): number {
  switch (severity) {
    case "CRITICA":
      return 100;
    case "ALTA":
      return 75;
    case "MEDIA":
      return 50;
    case "BAIXA":
      return 25;
    default:
      return 0;
  }
}

function severityProgressColor(severity?: string): string {
  switch (severity) {
    case "CRITICA":
      return "[&>div]:bg-red-600";
    case "ALTA":
      return "[&>div]:bg-orange-500";
    case "MEDIA":
      return "[&>div]:bg-yellow-500";
    case "BAIXA":
      return "[&>div]:bg-green-600";
    default:
      return "[&>div]:bg-muted";
  }
}

export function NijaPanoramaRisco({
  highestSeverity,
  defectsCount,
  mode,
  mainStrategiesCount,
  secondaryStrategiesCount,
  ramoLabel,
  isAnalyzing,
}: NijaPanoramaRiscoProps) {
  const totalStrategies = mainStrategiesCount + secondaryStrategiesCount;

  if (isAnalyzing) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
              <Zap className="absolute inset-0 m-auto h-5 w-5 text-primary animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Analisando documentos...</p>
              <p className="text-sm text-muted-foreground">O NIJA está identificando vícios e estratégias</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Panorama de Risco</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {mode === "AUTOMATIC" ? "Automático" : "Supervisionado"}
          </Badge>
        </div>
        <CardDescription>
          Diagnóstico processual baseado na análise do NIJA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Severidade máxima com progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Severidade máxima
            </span>
            <Badge className={`${severityLabelColor(highestSeverity)} px-3 py-1 text-xs font-bold`}>
              {highestSeverity ?? "Não analisado"}
            </Badge>
          </div>
          <Progress 
            value={severityProgress(highestSeverity)} 
            className={`h-2 ${severityProgressColor(highestSeverity)}`}
          />
        </div>

        {/* Grid de métricas */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{defectsCount}</p>
            <p className="text-xs text-muted-foreground">Vícios</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-primary">{mainStrategiesCount}</p>
            <p className="text-xs text-muted-foreground">Principais</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{secondaryStrategiesCount}</p>
            <p className="text-xs text-muted-foreground">Secundárias</p>
          </div>
        </div>

        {/* Ramo do direito */}
        {ramoLabel && (
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Ramo prevalente
            </span>
            <span className="text-sm font-medium">{ramoLabel}</span>
          </div>
        )}

        {/* Status visual */}
        {defectsCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
            <span>Análise concluída • {totalStrategies} estratégia(s) disponível(is)</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
