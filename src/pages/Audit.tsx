import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Copy, Trash2, AlertTriangle, CheckCircle, XCircle, Download } from "lucide-react";

interface UserContext {
  userId: string | null;
  email: string | null;
  officeId: string | null;
  role: string | null;
  hasBinding: boolean;
}

interface TableHealth {
  name: string;
  total: number;
  active?: number;
  softDeleted?: number;
  orphans?: number;
  byStatus?: Record<string, number>;
  userBindings?: number;
  error?: string;
}

interface FrontendLog {
  timestamp: string;
  type: "error" | "supabase";
  message: string;
  details?: string;
}

interface Recommendation {
  type: "error" | "warning" | "info";
  message: string;
}

interface AuditReport {
  timestamp: string;
  appVersion: string;
  userContext: UserContext;
  tableHealth: TableHealth[];
  frontendLogs: FrontendLog[];
  recommendations: Recommendation[];
}

// Capture console errors
const MAX_LOGS = 50;

export default function Audit() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [tableHealth, setTableHealth] = useState<TableHealth[]>([]);
  const [frontendLogs, setFrontendLogs] = useState<FrontendLog[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [cleaningOrphans, setCleaningOrphans] = useState(false);
  const [softDeletingDocs, setSoftDeletingDocs] = useState(false);

  // Use a ref to store logs to persist across renders while component is mounted
  const capturedLogsRef = useRef<FrontendLog[]>([]);

  // Helper to capture internal audit logs (non-console errors)
  const captureInternalLog = useCallback((log: FrontendLog) => {
    capturedLogsRef.current.unshift(log);
    if (capturedLogsRef.current.length > MAX_LOGS) {
      capturedLogsRef.current.pop();
    }
    setFrontendLogs([...capturedLogsRef.current]);
  }, []);

  useEffect(() => {
    const originalConsoleError = console.error;
    
    console.error = (...args) => {
      const newLog: FrontendLog = {
        timestamp: new Date().toISOString(),
        type: "error",
        message: args.map(a => typeof a === "object" ? (a instanceof Error ? a.message : JSON.stringify(a)) : String(a)).join(" "),
      };
      
      captureInternalLog(newLog);
      originalConsoleError.apply(console, args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, [captureInternalLog]);

  const fetchUserContext = useCallback(async () => {
    if (!user?.id) {
      setUserContext({ userId: null, email: null, officeId: null, role: null, hasBinding: false });
      return null;
    }

    const { data: membership, error } = await supabase
      .from("office_members")
      .select("office_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      captureInternalLog({ timestamp: new Date().toISOString(), type: "supabase", message: error.message, details: error.details });
    }

    const ctx: UserContext = {
      userId: user.id,
      email: user.email || null,
      officeId: membership?.office_id || null,
      role: membership?.role || null,
      hasBinding: !!membership?.office_id,
    };
    setUserContext(ctx);
    return ctx;
  }, [user]);

  const fetchTableHealth = useCallback(async (officeId: string | null) => {
    const results: TableHealth[] = [];

    // offices
    const { count: officesTotal, error: officesErr } = await supabase.from("offices").select("*", { count: "exact", head: true });
    results.push({ name: "offices", total: officesTotal || 0, error: officesErr?.message });

    // office_members
    const { count: membersTotal, error: membersErr } = await supabase.from("office_members").select("*", { count: "exact", head: true });
    const { count: userBindings } = user?.id 
      ? await supabase.from("office_members").select("*", { count: "exact", head: true }).eq("user_id", user.id)
      : { count: 0 };
    results.push({ name: "office_members", total: membersTotal || 0, userBindings: userBindings || 0, error: membersErr?.message });

    // clients
    const { count: clientsTotal } = await supabase.from("clients").select("*", { count: "exact", head: true });
    const { count: clientsActive } = await supabase.from("clients").select("*", { count: "exact", head: true }).is("deleted_at", null);
    const { count: clientsDeleted } = await supabase.from("clients").select("*", { count: "exact", head: true }).not("deleted_at", "is", null);
    results.push({ name: "clients", total: clientsTotal || 0, active: clientsActive || 0, softDeleted: clientsDeleted || 0 });

    // cases
    const { count: casesTotal } = await supabase.from("cases").select("*", { count: "exact", head: true });
    const { data: casesByStatus } = await supabase.from("cases").select("status");
    const statusCounts: Record<string, number> = {};
    casesByStatus?.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });
    results.push({ name: "cases", total: casesTotal || 0, byStatus: statusCounts });

    // documents
    const { count: docsTotal } = await supabase.from("documents").select("*", { count: "exact", head: true });
    const { count: docsActive } = await supabase.from("documents").select("*", { count: "exact", head: true }).is("deleted_at", null);
    const { count: docsDeleted } = await supabase.from("documents").select("*", { count: "exact", head: true }).not("deleted_at", "is", null);
    
    // Check orphan documents (case_id not in cases)
    const { data: allDocs } = await supabase.from("documents").select("id, case_id").is("deleted_at", null);
    const { data: allCases } = await supabase.from("cases").select("id");
    const caseIds = new Set(allCases?.map(c => c.id) || []);
    const orphanDocs = allDocs?.filter(d => d.case_id && !caseIds.has(d.case_id)).length || 0;
    
    results.push({ name: "documents", total: docsTotal || 0, active: docsActive || 0, softDeleted: docsDeleted || 0, orphans: orphanDocs });

    // document_versions
    const { count: versionsTotal } = await supabase.from("document_versions").select("*", { count: "exact", head: true });
    const { data: allVersions } = await supabase.from("document_versions").select("id, document_id");
    const { data: allDocsForVersions } = await supabase.from("documents").select("id");
    const docIds = new Set(allDocsForVersions?.map(d => d.id) || []);
    const orphanVersions = allVersions?.filter(v => !docIds.has(v.document_id)).length || 0;
    
    results.push({ name: "document_versions", total: versionsTotal || 0, orphans: orphanVersions });

    // storage (limited - just show bucket info if available)
    try {
      const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
      if (bucketsErr) {
        results.push({ name: "storage_buckets", total: 0, error: "API não disponível no client" });
      } else {
        results.push({ name: "storage_buckets", total: buckets?.length || 0 });
      }
    } catch {
      results.push({ name: "storage_buckets", total: 0, error: "API não disponível no client" });
    }

    setTableHealth(results);
    return results;
  }, [user?.id]);

  const generateRecommendations = useCallback((ctx: UserContext | null, health: TableHealth[]) => {
    const recs: Recommendation[] = [];

    if (!ctx?.hasBinding) {
      recs.push({ type: "error", message: "Usuário não está vinculado a nenhum escritório (office_members)" });
    }

    const versions = health.find(h => h.name === "document_versions");
    if (versions?.orphans && versions.orphans > 0) {
      recs.push({ type: "warning", message: `Há ${versions.orphans} document_versions órfãs (document_id inexistente)` });
    }

    const docs = health.find(h => h.name === "documents");
    if (docs?.orphans && docs.orphans > 0) {
      recs.push({ type: "warning", message: `Há ${docs.orphans} documents com case_id inválido` });
    }

    const clients = health.find(h => h.name === "clients");
    if (clients && clients.softDeleted && clients.softDeleted > 0) {
      recs.push({ type: "info", message: `Há ${clients.softDeleted} clientes soft-deletados no banco` });
    }

    const members = health.find(h => h.name === "office_members");
    if (members?.userBindings === 0 && ctx?.userId) {
      recs.push({ type: "error", message: "Falta office_members para este usuário" });
    }

    if (recs.length === 0) {
      recs.push({ type: "info", message: "Nenhum problema detectado. Sistema saudável." });
    }

    setRecommendations(recs);
    return recs;
  }, []);

  const runFullDiagnostic = useCallback(async () => {
    setLoading(true);
    try {
      const ctx = await fetchUserContext();
      const health = await fetchTableHealth(ctx?.officeId || null);
      generateRecommendations(ctx, health);
      setFrontendLogs([...capturedLogs]);
      toast({ title: "Diagnóstico concluído" });
    } catch (err) {
      console.error("Erro no diagnóstico:", err);
      toast({ title: "Erro no diagnóstico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [fetchUserContext, fetchTableHealth, generateRecommendations]);

  useEffect(() => {
    runFullDiagnostic();
  }, []);

  const copyDiagnostic = () => {
    const report: AuditReport = {
      timestamp: new Date().toISOString(),
      appVersion: "1.0.0",
      userContext: userContext || { userId: null, email: null, officeId: null, role: null, hasBinding: false },
      tableHealth,
      frontendLogs,
      recommendations,
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    toast({ title: "Diagnóstico copiado para área de transferência" });
  };

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(frontendLogs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lexos-logs-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cleanOrphanVersions = async () => {
    setCleaningOrphans(true);
    try {
      // Get all document IDs
      const { data: docs } = await supabase.from("documents").select("id");
      const docIds = docs?.map(d => d.id) || [];
      
      if (docIds.length === 0) {
        // Delete all versions if no documents exist
        const { error } = await supabase.from("document_versions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
      } else {
        // Delete versions where document_id not in docIds
        const { data: orphans } = await supabase.from("document_versions").select("id, document_id");
        const docIdSet = new Set(docIds);
        const orphanIds = orphans?.filter(v => !docIdSet.has(v.document_id)).map(v => v.id) || [];
        
        if (orphanIds.length > 0) {
          for (const id of orphanIds) {
            await supabase.from("document_versions").delete().eq("id", id);
          }
        }
      }
      
      toast({ title: "Document_versions órfãs removidas" });
      runFullDiagnostic();
    } catch (err: any) {
      console.error("Erro ao limpar órfãs:", err);
      toast({ title: "Erro ao limpar órfãs", description: err.message, variant: "destructive" });
    } finally {
      setCleaningOrphans(false);
    }
  };

  const softDeleteOrphanDocs = async () => {
    setSoftDeletingDocs(true);
    try {
      const { data: allDocs } = await supabase.from("documents").select("id, case_id").is("deleted_at", null);
      const { data: allCases } = await supabase.from("cases").select("id");
      const caseIds = new Set(allCases?.map(c => c.id) || []);
      const orphanDocIds = allDocs?.filter(d => d.case_id && !caseIds.has(d.case_id)).map(d => d.id) || [];

      if (orphanDocIds.length > 0) {
        for (const id of orphanDocIds) {
          await supabase.from("documents").update({
            deleted_at: new Date().toISOString(),
            deleted_by: user?.id || null,
            deleted_reason: "Orphan document - case_id inexistente",
          }).eq("id", id);
        }
      }

      toast({ title: `${orphanDocIds.length} documentos órfãos soft-deletados` });
      runFullDiagnostic();
    } catch (err: any) {
      console.error("Erro ao soft-delete docs:", err);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSoftDeletingDocs(false);
    }
  };

  const getStatusBadge = (health: TableHealth) => {
    if (health.error) return <Badge variant="destructive">ERRO</Badge>;
    if (health.orphans && health.orphans > 0) return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">ÓRFÃOS</Badge>;
    return <Badge variant="default" className="bg-green-500/20 text-green-700">OK</Badge>;
  };

  const getRecIcon = (type: string) => {
    if (type === "error") return <XCircle className="h-4 w-4 text-destructive" />;
    if (type === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Auditoria do Sistema</h1>
            <p className="text-muted-foreground">Diagnóstico completo do LEXOS</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={runFullDiagnostic} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Revalidar
            </Button>
            <Button variant="outline" onClick={copyDiagnostic}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar Diagnóstico
            </Button>
          </div>
        </div>

        {/* 1. Contexto do Usuário/Escritório */}
        <Card>
          <CardHeader>
            <CardTitle>Contexto do Usuário/Escritório</CardTitle>
            <CardDescription>Informações do usuário autenticado e vínculo com escritório</CardDescription>
          </CardHeader>
          <CardContent>
            {!userContext?.hasBinding && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <span className="font-medium text-destructive">Escritório não identificado</span>
              </div>
            )}
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">User ID</TableCell>
                  <TableCell className="font-mono text-sm">{userContext?.userId || "—"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Email</TableCell>
                  <TableCell>{userContext?.email || "—"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Office ID</TableCell>
                  <TableCell className="font-mono text-sm">{userContext?.officeId || "—"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Role</TableCell>
                  <TableCell>
                    <Badge variant="outline">{userContext?.role || "sem vínculo"}</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 2. Saúde do Banco */}
        <Card>
          <CardHeader>
            <CardTitle>Saúde do Banco (Supabase)</CardTitle>
            <CardDescription>Status e contagem das principais tabelas</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableHealth.map((h) => (
                  <TableRow key={h.name}>
                    <TableCell className="font-mono text-sm">{h.name}</TableCell>
                    <TableCell>{getStatusBadge(h)}</TableCell>
                    <TableCell>{h.total}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {h.error && <span className="text-destructive">{h.error}</span>}
                      {h.active !== undefined && <span>Ativos: {h.active}</span>}
                      {h.softDeleted !== undefined && <span className="ml-2">Deletados: {h.softDeleted}</span>}
                      {h.orphans !== undefined && h.orphans > 0 && <span className="ml-2 text-yellow-600">Órfãos: {h.orphans}</span>}
                      {h.userBindings !== undefined && <span>Vínculos do usuário: {h.userBindings}</span>}
                      {h.byStatus && Object.entries(h.byStatus).map(([s, c]) => (
                        <span key={s} className="ml-2">{s}: {c}</span>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 3. Integridade e Órfãos */}
        <Card>
          <CardHeader>
            <CardTitle>Integridade e Órfãos (Ações Seguras)</CardTitle>
            <CardDescription>Ações de limpeza com confirmação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium">Limpar document_versions órfãs</p>
                <p className="text-sm text-muted-foreground">Remove versões onde document_id não existe</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={cleaningOrphans}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Executar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar limpeza</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá deletar permanentemente todas as document_versions órfãs. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={cleanOrphanVersions}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium">Soft-delete documentos órfãos</p>
                <p className="text-sm text-muted-foreground">Marca documentos com case_id inválido como deletados</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={softDeletingDocs}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Executar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar soft-delete</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá marcar todos os documentos órfãos como deletados (soft-delete). Os documentos não serão removidos permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={softDeleteOrphanDocs}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <Separator />

            <div className="p-3 border rounded-md bg-muted/30">
              <p className="font-medium text-destructive">Zerar ambiente de teste (PERIGOSO)</p>
              <p className="text-sm text-muted-foreground mb-2">SQL recomendado (não executar em produção):</p>
              <pre className="bg-background p-2 rounded text-xs overflow-auto">
{`-- CUIDADO: IRREVERSÍVEL
TRUNCATE TABLE public.document_versions CASCADE;
TRUNCATE TABLE public.documents CASCADE;
TRUNCATE TABLE public.cases CASCADE;
TRUNCATE TABLE public.clients CASCADE;
-- Manter: offices, office_members, profiles`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* 4. Logs do Frontend */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Logs do Frontend</CardTitle>
              <CardDescription>Últimos {MAX_LOGS} erros capturados</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Exportar JSON
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-auto border rounded-md">
              {frontendLogs.length === 0 ? (
                <p className="p-4 text-muted-foreground text-center">Nenhum log capturado</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Timestamp</TableHead>
                      <TableHead className="w-20">Tipo</TableHead>
                      <TableHead>Mensagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {frontendLogs.slice(0, 50).map((log, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{new Date(log.timestamp).toLocaleTimeString()}</TableCell>
                        <TableCell>
                          <Badge variant={log.type === "error" ? "destructive" : "secondary"}>{log.type}</Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-md truncate">{log.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 5. Checklist Automático */}
        <Card>
          <CardHeader>
            <CardTitle>Checklist Automático</CardTitle>
            <CardDescription>Recomendações baseadas nos achados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-md border">
                  {getRecIcon(rec.type)}
                  <span className={rec.type === "error" ? "text-destructive" : rec.type === "warning" ? "text-yellow-700" : "text-muted-foreground"}>
                    {rec.message}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
