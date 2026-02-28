import { useState, useEffect } from "react";
import {
  generateLexosArchitectureSnapshot,
  LexosArchitectureSnapshot,
} from "@/lexosArchitectureSnapshot";
import {
  runSystemAudit,
  AuditReport,
  AuditFinding,
  getSeverityColor,
  getSeverityIcon,
  scanAIEdgeUsage,
  AIEdgeUsage,
} from "@/lib/systemAudit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Shield,
  RefreshCw,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  FileWarning,
  Wrench,
  Lightbulb,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// For demonstration - in production this would be build-time file scanning
const getSimulatedFileContents = (): Map<string, string> => {
  // Return empty map since edge functions are now properly mapped in snapshot
  // This would only be used to detect CRITICAL direct API calls
  return new Map<string, string>();
};

export default function SystemAudit() {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<LexosArchitectureSnapshot | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [aiEdgeUsages, setAIEdgeUsages] = useState<AIEdgeUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const runAudit = () => {
    setLoading(true);
    try {
      const snap = generateLexosArchitectureSnapshot();
      setSnapshot(snap);
      
      // Scan for AI/Edge usage patterns
      const fileContents = getSimulatedFileContents();
      const files = Array.from(fileContents.keys());
      const usages = scanAIEdgeUsage(files, fileContents);
      setAIEdgeUsages(usages);
      
      // Run audit with AI/Edge usage data
      const auditReport = runSystemAudit(snap, usages);
      setReport(auditReport);
    } catch (error) {
      console.error("Erro ao executar auditoria:", error);
      toast.error("Erro ao executar auditoria do sistema");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  const handleCopyReport = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      toast.success("Relatório copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar relatório");
    }
  };

  const handleApplyCriticalFixes = () => {
    // Esta função apenas mostra instruções, pois não podemos modificar App.tsx em runtime
    toast.info(
      "Para aplicar as correções críticas, as rotas /nija e /documents/print/:id devem ser protegidas no App.tsx.",
      { duration: 8000 }
    );
    toast.success(
      "Instruções: Altere protected: false para protected: true nas rotas indicadas no arquivo src/lexosArchitectureSnapshot.ts e adicione ProtectedRoute no App.tsx",
      { duration: 10000 }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!report || !snapshot) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Erro</CardTitle>
            <CardDescription>Não foi possível executar a auditoria do sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runAudit}>Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const criticalFindings = report.findings.filter((f) => f.severity === "CRITICO");
  const highFindings = report.findings.filter((f) => f.severity === "ALTO");
  const mediumFindings = report.findings.filter((f) => f.severity === "MEDIO");
  const lowFindings = report.findings.filter((f) => f.severity === "BAIXO");

  const hasCritical = criticalFindings.length > 0;
  const hasAutoFixable = criticalFindings.some((f) => f.autoFixable);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div
            className={`p-2 md:p-3 rounded-xl ${hasCritical ? "bg-red-500/10" : "bg-green-500/10"}`}
          >
            {hasCritical ? (
              <ShieldAlert className="h-6 w-6 md:h-8 md:w-8 text-red-500" />
            ) : (
              <ShieldCheck className="h-6 w-6 md:h-8 md:w-8 text-green-500" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-xl md:text-3xl font-bold tracking-tight">Auditoria do Sistema</h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              {new Date(report.generatedAt).toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={runAudit}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reexecutar
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyReport}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
          {hasAutoFixable && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Wrench className="h-4 w-4 mr-2" />
                  Corrigir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Aplicar Correções Críticas</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <p>
                      As seguintes rotas precisam ser protegidas no código-fonte:
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {criticalFindings
                        .filter((f) => f.autoFixable)
                        .map((f) => (
                          <li key={f.id}>
                            <code className="bg-muted px-1 rounded">{f.resource}</code>
                          </li>
                        ))}
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      Para corrigir, edite o arquivo <code>src/App.tsx</code> e envolva
                      essas rotas com <code>&lt;ProtectedRoute&gt;</code>.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleApplyCriticalFixes}>
                    Ver Instruções
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`border-2 ${report.summary.critical > 0 ? "border-red-500/50 bg-red-500/5" : "border-border"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Crítico</p>
                <p className="text-3xl font-bold text-red-500">{report.summary.critical}</p>
              </div>
              <ShieldAlert className="h-8 w-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border-2 ${report.summary.high > 0 ? "border-orange-500/50 bg-orange-500/5" : "border-border"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alto</p>
                <p className="text-3xl font-bold text-orange-500">{report.summary.high}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border-2 ${report.summary.medium > 0 ? "border-yellow-500/50 bg-yellow-500/5" : "border-border"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Médio</p>
                <p className="text-3xl font-bold text-yellow-500">{report.summary.medium}</p>
              </div>
              <FileWarning className="h-8 w-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Baixo</p>
                <p className="text-3xl font-bold text-blue-500">{report.summary.low}</p>
              </div>
              <Shield className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Banner */}
      {report.summary.total === 0 ? (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="p-6 flex items-center gap-4">
            <ShieldCheck className="h-12 w-12 text-green-500" />
            <div>
              <h3 className="text-lg font-semibold text-green-600">Sistema Seguro</h3>
              <p className="text-muted-foreground">
                Nenhuma vulnerabilidade ou inconsistência detectada na auditoria.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <div>
              <h3 className="text-lg font-semibold text-destructive">
                {report.summary.total} problema(s) encontrado(s)
              </h3>
              <p className="text-muted-foreground">
                {report.summary.critical > 0 && (
                  <span className="text-red-500 font-medium">
                    {report.summary.critical} crítico(s)
                  </span>
                )}
                {report.summary.critical > 0 && report.summary.high > 0 && ", "}
                {report.summary.high > 0 && (
                  <span className="text-orange-500 font-medium">
                    {report.summary.high} alto(s)
                  </span>
                )}
                {(report.summary.critical > 0 || report.summary.high > 0) &&
                  report.summary.medium > 0 &&
                  ", "}
                {report.summary.medium > 0 && (
                  <span className="text-yellow-500 font-medium">
                    {report.summary.medium} médio(s)
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Findings List */}
      {report.summary.total > 0 && (
        <div className="space-y-4">
          {/* Critical */}
          {criticalFindings.length > 0 && (
            <FindingsSection
              title="Problemas Críticos"
              findings={criticalFindings}
              severity="CRITICO"
            />
          )}

          {/* High */}
          {highFindings.length > 0 && (
            <FindingsSection title="Problemas Altos" findings={highFindings} severity="ALTO" />
          )}

          {/* Medium */}
          {mediumFindings.length > 0 && (
            <FindingsSection title="Problemas Médios" findings={mediumFindings} severity="MEDIO" />
          )}

          {/* Low */}
          {lowFindings.length > 0 && (
            <FindingsSection title="Problemas Baixos" findings={lowFindings} severity="BAIXO" />
          )}
        </div>
      )}
    </div>
  );
}

function FindingsSection({
  title,
  findings,
  severity,
}: {
  title: string;
  findings: AuditFinding[];
  severity: "CRITICO" | "ALTO" | "MEDIO" | "BAIXO";
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span>{getSeverityIcon(severity)}</span>
          {title} ({findings.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className={findings.length > 5 ? "h-[300px]" : ""}>
          <div className="space-y-3">
            {findings.map((finding, index) => (
              <div key={finding.id}>
                {index > 0 && <Separator className="my-3" />}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={getSeverityColor(finding.severity)}>
                          {finding.severity}
                        </Badge>
                        <span className="font-medium">{finding.title}</span>
                        {finding.autoFixable && (
                          <Badge variant="outline" className="text-xs">
                            Auto-corrigível
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{finding.description}</p>
                    </div>
                  </div>
                  {finding.resource && (
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        {finding.resource}
                      </code>
                    </div>
                  )}
                  {finding.detectedFunctions && finding.detectedFunctions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {finding.detectedFunctions.slice(0, 8).map((fn) => (
                        <Badge key={fn} variant="secondary" className="text-xs font-mono">
                          {fn}
                        </Badge>
                      ))}
                      {finding.detectedFunctions.length > 8 && (
                        <Badge variant="outline" className="text-xs">
                          +{finding.detectedFunctions.length - 8} mais
                        </Badge>
                      )}
                    </div>
                  )}
                  {finding.recommendation && (
                    <div className="flex items-start gap-2 mt-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-primary">Ação Recomendada (Supabase-first)</p>
                        <p className="text-xs text-muted-foreground mt-1">{finding.recommendation}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
