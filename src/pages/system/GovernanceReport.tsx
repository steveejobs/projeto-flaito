import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileText, Download, Copy, ArrowLeft, Shield, AlertTriangle, CheckCircle, XCircle, Activity, Lock, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  getLatestSnapshots,
  getDbSnapshot,
  getMatrix,
  getHealth,
  type AuditSnapshot,
  type DbSnapshot,
  type MatrixAccess,
  type HealthData,
} from '@/system/audit/governanceClient';

interface ConsolidatedReport {
  generated_at: string;
  office_id: string;
  snapshot: AuditSnapshot | null;
  db: DbSnapshot | null;
  matrix: MatrixAccess | null;
  health: HealthData | null;
}

export default function GovernanceReport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const snapshotId = searchParams.get('snapshot');
  const officeId = sessionStorage.getItem('lexos_office_id');

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ConsolidatedReport | null>(null);

  useEffect(() => {
    if (officeId) {
      loadReport();
    }
  }, [officeId, snapshotId]);

  const loadReport = async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const [snapshots, db, matrix, health] = await Promise.all([
        getLatestSnapshots(officeId, 10),
        getDbSnapshot(officeId),
        getMatrix(officeId),
        getHealth(officeId),
      ]);

      const selectedSnapshot = snapshotId
        ? snapshots.find((s) => s.id === snapshotId) || snapshots[0]
        : snapshots[0];

      setReport({
        generated_at: new Date().toISOString(),
        office_id: officeId,
        snapshot: selectedSnapshot || null,
        db,
        matrix,
        health,
      });
    } catch (err) {
      console.error('Error loading report:', err);
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  const generateMarkdownReport = (): string => {
    if (!report) return '';

    const riskData = report.snapshot?.risk as Record<string, number> | undefined;
    const tablesWithoutRls = report.db?.tables.filter((t) => !t.rls_enabled) || [];
    const securityDefinerFns = report.db?.functions.filter((f) => f.security_definer) || [];

    return `# Relatório Consolidado de Governança

**Gerado em:** ${new Date(report.generated_at).toLocaleString('pt-BR')}
**Office ID:** ${report.office_id}
${report.snapshot ? `**Snapshot ID:** ${report.snapshot.id}` : ''}

---

## 1. Resumo Executivo

### 1.1 Status Geral
${report.snapshot?.status === 'DONE' ? '✅ Sistema auditado com sucesso' : '⚠️ Auditoria pendente'}

### 1.2 Indicadores de Risco
| Nível | Quantidade |
|-------|------------|
| 🔴 Crítico | ${riskData?.critical ?? 0} |
| 🟠 Alto | ${riskData?.high ?? 0} |
| 🟡 Médio | ${riskData?.medium ?? 0} |
| 🟢 Baixo | ${riskData?.low ?? 0} |

### 1.3 KPIs do Sistema
| Métrica | Valor |
|---------|-------|
| Clientes | ${report.health?.kpis?.clients_count ?? '-'} |
| Casos | ${report.health?.kpis?.cases_count ?? '-'} |
| Documentos | ${report.health?.kpis?.documents_count ?? '-'} |
| Membros | ${report.health?.kpis?.members_count ?? '-'} |

---

## 2. Estrutura do Banco de Dados

### 2.1 Tabelas (${report.db?.tables.length ?? 0} total)
| Tabela | RLS Ativado | Tipo |
|--------|-------------|------|
${report.db?.tables.map((t) => `| ${t.name} | ${t.rls_enabled ? '✅' : '❌'} | ${t.kind} |`).join('\n') || 'Nenhuma tabela'}

### 2.2 Tabelas SEM RLS (${tablesWithoutRls.length})
${tablesWithoutRls.length > 0 ? tablesWithoutRls.map((t) => `- ⚠️ \`${t.name}\``).join('\n') : '✅ Todas as tabelas possuem RLS ativado'}

### 2.3 Políticas RLS (${report.db?.policies.length ?? 0} total)
| Tabela | Política | Comando | Tipo |
|--------|----------|---------|------|
${report.db?.policies.slice(0, 50).map((p) => `| ${p.table} | ${p.name} | ${p.cmd} | ${p.permissive} |`).join('\n') || 'Nenhuma política'}
${(report.db?.policies.length ?? 0) > 50 ? `\n*... e mais ${(report.db?.policies.length ?? 0) - 50} políticas*` : ''}

### 2.4 Functions (${report.db?.functions.length ?? 0} total)
| Function | SECURITY DEFINER |
|----------|------------------|
${report.db?.functions.slice(0, 30).map((f) => `| ${f.name} | ${f.security_definer ? '⚠️ Sim' : 'Não'} |`).join('\n') || 'Nenhuma function'}
${(report.db?.functions.length ?? 0) > 30 ? `\n*... e mais ${(report.db?.functions.length ?? 0) - 30} functions*` : ''}

---

## 3. Matriz de Acesso (RBAC × RLS)

### 3.1 Roles Identificados
${report.matrix?.roles.map((r) => `- \`${r}\``).join('\n') || 'Nenhum role'}

### 3.2 Cobertura por Tabela
| Tabela | RLS | Políticas |
|--------|-----|-----------|
${report.matrix?.matrix.slice(0, 30).map((m) => `| ${m.table} | ${m.rls_enabled ? '✅' : '❌'} | ${m.policies?.length ?? 0} |`).join('\n') || 'Sem dados'}

---

## 4. Saúde do Sistema

### 4.1 Erros Recentes (${report.health?.recent_errors?.length ?? 0})
${
  report.health?.recent_errors?.length
    ? report.health.recent_errors.slice(0, 10).map((e) => `- **${e.kind}** - ${new Date(e.created_at).toLocaleString('pt-BR')}`).join('\n')
    : '✅ Nenhum erro recente'
}

---

## 5. Recomendações

${tablesWithoutRls.length > 0 ? `### ⚠️ Ativar RLS nas seguintes tabelas:
${tablesWithoutRls.map((t) => `- \`${t.name}\``).join('\n')}` : ''}

${securityDefinerFns.length > 0 ? `### ⚠️ Revisar functions com SECURITY DEFINER:
${securityDefinerFns.map((f) => `- \`${f.name}\``).join('\n')}` : ''}

${riskData?.critical || riskData?.high ? `### 🔴 Riscos Críticos/Altos Identificados
Revisar o snapshot de auditoria para detalhes completos.` : ''}

---

## 6. Relatório Técnico do Snapshot

${report.snapshot?.report_md || '*Nenhum relatório técnico disponível*'}

---

*Relatório gerado automaticamente pelo Centro de Governança Lexos*
`;
  };

  const handleCopy = async () => {
    const md = generateMarkdownReport();
    await navigator.clipboard.writeText(md);
    toast.success('Relatório copiado para área de transferência');
  };

  const handleDownload = () => {
    const md = generateMarkdownReport();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `governanca-report-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório baixado');
  };

  const handleDownloadJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `governanca-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Dados JSON baixados');
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Gerando relatório consolidado...</p>
        </div>
      </div>
    );
  }

  const riskData = report?.snapshot?.risk as Record<string, number> | undefined;
  const tablesWithoutRls = report?.db?.tables.filter((t) => !t.rls_enabled) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/system/governanca')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Relatório Consolidado de Governança
            </h1>
            <p className="text-muted-foreground text-sm">
              Gerado em {new Date().toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar MD
          </Button>
          <Button variant="outline" onClick={handleDownloadJSON}>
            <Download className="mr-2 h-4 w-4" />
            JSON
          </Button>
          <Button onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download MD
          </Button>
        </div>
      </div>

      {/* Risk Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className={riskData?.critical ? 'border-destructive' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-destructive" />
              Crítico
            </CardDescription>
            <CardTitle className="text-3xl">{riskData?.critical ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={riskData?.high ? 'border-orange-500' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Alto
            </CardDescription>
            <CardTitle className="text-3xl">{riskData?.high ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Médio
            </CardDescription>
            <CardTitle className="text-3xl">{riskData?.medium ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Baixo
            </CardDescription>
            <CardTitle className="text-3xl">{riskData?.low ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle>
              <Badge variant={report?.snapshot?.status === 'DONE' ? 'default' : 'destructive'}>
                {report?.snapshot?.status || 'N/A'}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPIs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              KPIs do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{report?.health?.kpis?.clients_count ?? '-'}</div>
              <div className="text-sm text-muted-foreground">Clientes</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{report?.health?.kpis?.cases_count ?? '-'}</div>
              <div className="text-sm text-muted-foreground">Casos</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{report?.health?.kpis?.documents_count ?? '-'}</div>
              <div className="text-sm text-muted-foreground">Documentos</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{report?.health?.kpis?.members_count ?? '-'}</div>
              <div className="text-sm text-muted-foreground">Membros</div>
            </div>
          </CardContent>
        </Card>

        {/* Database Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Banco de Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Tabelas</span>
              <Badge variant="secondary">{report?.db?.tables.length ?? 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Políticas RLS</span>
              <Badge variant="secondary">{report?.db?.policies.length ?? 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Functions</span>
              <Badge variant="secondary">{report?.db?.functions.length ?? 0}</Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-destructive">Tabelas sem RLS</span>
              <Badge variant={tablesWithoutRls.length > 0 ? 'destructive' : 'default'}>
                {tablesWithoutRls.length}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Matrix Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Matriz de Acesso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Roles Identificados:</div>
              <div className="flex flex-wrap gap-2">
                {report?.matrix?.roles.map((role) => (
                  <Badge key={role} variant="outline">
                    {role}
                  </Badge>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="text-sm text-muted-foreground">
                {report?.matrix?.matrix.length ?? 0} tabelas mapeadas
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Errors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Erros Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report?.health?.recent_errors?.length ? (
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {report.health.recent_errors.slice(0, 5).map((err, i) => (
                    <div key={i} className="flex justify-between text-sm p-2 bg-muted rounded">
                      <Badge variant="destructive" className="text-xs">
                        {err.kind}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(err.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Nenhum erro recente</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Technical Report Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Relatório Técnico do Snapshot
          </CardTitle>
          <CardDescription>
            Snapshot: {report?.snapshot?.id?.slice(0, 8)}... | Criado em{' '}
            {report?.snapshot?.created_at
              ? new Date(report.snapshot.created_at).toLocaleString('pt-BR')
              : '-'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full rounded border p-4">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {report?.snapshot?.report_md || 'Nenhum relatório técnico disponível'}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
