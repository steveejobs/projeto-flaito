import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { HardDrive, Trash2, Search, AlertTriangle, FileX, Clock, Loader2, RefreshCw } from "lucide-react";

interface OrphanResult {
  bucket: string;
  path: string;
  size: number;
  reason: string;
  category: "client-files" | "documents" | "soft-deleted" | "temp-files";
}

interface CleanupSummary {
  clientFilesOrphans: number;
  documentOrphans: number;
  softDeletedOrphans: number;
  tempFilesOrphans: number;
  totalSizeMB: number;
}

interface ScanResult {
  success: boolean;
  scanned: number;
  orphansFound: OrphanResult[];
  deleted: string[];
  errors: string[];
  dryRun: boolean;
  summary: CleanupSummary;
  totalOrphanSizeMB: number;
}

export default function StorageMaintenance() {
  const queryClient = useQueryClient();
  const [includeSoftDeleted, setIncludeSoftDeleted] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  // Scan for orphans (dry-run)
  const scanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("cleanup-orphan-files", {
        body: {
          dryRun: true,
          includeSoftDeleted,
          buckets: ["client-files", "documents", "nija_tmp"],
        },
      });
      if (error) throw error;
      return data as ScanResult;
    },
    onSuccess: (data) => {
      setScanResult(data);
      if (data.orphansFound.length === 0) {
        toast.success("Nenhum arquivo órfão encontrado!");
      } else {
        toast.info(`Encontrados ${data.orphansFound.length} arquivos órfãos (${data.totalOrphanSizeMB} MB)`);
      }
    },
    onError: (error) => {
      console.error("Scan error:", error);
      toast.error("Erro ao analisar arquivos órfãos");
    },
  });

  // Delete orphans
  const deleteMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      const { data, error } = await supabase.functions.invoke("cleanup-orphan-files", {
        body: {
          dryRun: false,
          includeSoftDeleted,
          buckets: categories.includes("temp-files") 
            ? ["client-files", "documents", "nija_tmp"]
            : ["client-files", "documents"],
        },
      });
      if (error) throw error;
      return data as ScanResult;
    },
    onSuccess: (data) => {
      setScanResult(null);
      setSelectedCategories(new Set());
      toast.success(`${data.deleted.length} arquivos deletados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["storage-stats"] });
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast.error("Erro ao deletar arquivos órfãos");
    },
  });

  const handleScan = () => {
    scanMutation.mutate();
  };

  const handleDelete = () => {
    if (selectedCategories.size === 0) {
      toast.error("Selecione pelo menos uma categoria para limpar");
      return;
    }
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(false);
    deleteMutation.mutate(Array.from(selectedCategories));
  };

  const toggleCategory = (category: string) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setSelectedCategories(newSet);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getOrphansByCategory = (category: string) => {
    return scanResult?.orphansFound.filter(o => o.category === category) || [];
  };

  const getCategorySize = (category: string) => {
    const orphans = getOrphansByCategory(category);
    const totalBytes = orphans.reduce((sum, o) => sum + o.size, 0);
    return formatBytes(totalBytes);
  };

  const isLoading = scanMutation.isPending || deleteMutation.isPending;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="h-6 w-6" />
            Manutenção de Storage
          </h1>
          <p className="text-muted-foreground">
            Identifique e remova arquivos órfãos do armazenamento
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurações de Análise</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="include-soft-deleted">Incluir arquivos de documentos excluídos</Label>
              <p className="text-sm text-muted-foreground">
                Arquivos associados a documentos na lixeira (soft-deleted)
              </p>
            </div>
            <Switch
              id="include-soft-deleted"
              checked={includeSoftDeleted}
              onCheckedChange={setIncludeSoftDeleted}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleScan} disabled={isLoading}>
              {scanMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Analisar Órfãos
            </Button>

            {scanResult && scanResult.orphansFound.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleDelete} 
                disabled={isLoading || selectedCategories.size === 0}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Limpar Selecionados
              </Button>
            )}

            {scanResult && (
              <Button 
                variant="outline" 
                onClick={() => { setScanResult(null); setSelectedCategories(new Set()); }}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Limpar Resultados
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {scanResult && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="client-files">
              Client Files
              {scanResult.summary.clientFilesOrphans > 0 && (
                <Badge variant="secondary" className="ml-2">{scanResult.summary.clientFilesOrphans}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="documents">
              Documents
              {scanResult.summary.documentOrphans > 0 && (
                <Badge variant="secondary" className="ml-2">{scanResult.summary.documentOrphans}</Badge>
              )}
            </TabsTrigger>
            {includeSoftDeleted && (
              <TabsTrigger value="soft-deleted">
                Soft-Deleted
                {scanResult.summary.softDeletedOrphans > 0 && (
                  <Badge variant="secondary" className="ml-2">{scanResult.summary.softDeletedOrphans}</Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="temp-files">
              Temporários
              {scanResult.summary.tempFilesOrphans > 0 && (
                <Badge variant="secondary" className="ml-2">{scanResult.summary.tempFilesOrphans}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card 
                className={`cursor-pointer transition-all ${selectedCategories.has("client-files") ? "ring-2 ring-primary" : ""}`}
                onClick={() => scanResult.summary.clientFilesOrphans > 0 && toggleCategory("client-files")}
              >
                <CardHeader className="pb-2">
                  <CardDescription>Client Files</CardDescription>
                  <CardTitle className="text-2xl">{scanResult.summary.clientFilesOrphans}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{getCategorySize("client-files")}</p>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all ${selectedCategories.has("documents") ? "ring-2 ring-primary" : ""}`}
                onClick={() => scanResult.summary.documentOrphans > 0 && toggleCategory("documents")}
              >
                <CardHeader className="pb-2">
                  <CardDescription>Documents</CardDescription>
                  <CardTitle className="text-2xl">{scanResult.summary.documentOrphans}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{getCategorySize("documents")}</p>
                </CardContent>
              </Card>

              {includeSoftDeleted && (
                <Card 
                  className={`cursor-pointer transition-all ${selectedCategories.has("soft-deleted") ? "ring-2 ring-primary" : ""}`}
                  onClick={() => scanResult.summary.softDeletedOrphans > 0 && toggleCategory("soft-deleted")}
                >
                  <CardHeader className="pb-2">
                    <CardDescription>Soft-Deleted</CardDescription>
                    <CardTitle className="text-2xl">{scanResult.summary.softDeletedOrphans}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{getCategorySize("soft-deleted")}</p>
                  </CardContent>
                </Card>
              )}

              <Card 
                className={`cursor-pointer transition-all ${selectedCategories.has("temp-files") ? "ring-2 ring-primary" : ""}`}
                onClick={() => scanResult.summary.tempFilesOrphans > 0 && toggleCategory("temp-files")}
              >
                <CardHeader className="pb-2">
                  <CardDescription>Temporários</CardDescription>
                  <CardTitle className="text-2xl">{scanResult.summary.tempFilesOrphans}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{getCategorySize("temp-files")}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Resumo da Análise
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Arquivos analisados:</strong> {scanResult.scanned}</p>
                  <p><strong>Órfãos encontrados:</strong> {scanResult.orphansFound.length}</p>
                  <p><strong>Tamanho total:</strong> {scanResult.totalOrphanSizeMB} MB</p>
                  {scanResult.errors.length > 0 && (
                    <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
                      <p className="font-medium text-destructive">Erros ({scanResult.errors.length}):</p>
                      <ul className="text-sm text-destructive mt-1">
                        {scanResult.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="client-files">
            <OrphanTable orphans={getOrphansByCategory("client-files")} formatBytes={formatBytes} />
          </TabsContent>

          <TabsContent value="documents">
            <OrphanTable orphans={getOrphansByCategory("documents")} formatBytes={formatBytes} />
          </TabsContent>

          {includeSoftDeleted && (
            <TabsContent value="soft-deleted">
              <OrphanTable orphans={getOrphansByCategory("soft-deleted")} formatBytes={formatBytes} />
            </TabsContent>
          )}

          <TabsContent value="temp-files">
            <OrphanTable orphans={getOrphansByCategory("temp-files")} formatBytes={formatBytes} />
          </TabsContent>
        </Tabs>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão Permanente
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Esta ação irá excluir <strong>permanentemente</strong> os arquivos órfãos das categorias selecionadas:
              </p>
              <ul className="list-disc list-inside">
                {Array.from(selectedCategories).map(cat => {
                  const orphans = getOrphansByCategory(cat);
                  const size = orphans.reduce((sum, o) => sum + o.size, 0);
                  return (
                    <li key={cat}>
                      {cat}: {orphans.length} arquivos ({formatBytes(size)})
                    </li>
                  );
                })}
              </ul>
              <p className="text-destructive font-medium mt-2">
                Esta ação não pode ser desfeita!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OrphanTable({ orphans, formatBytes }: { orphans: OrphanResult[]; formatBytes: (bytes: number) => string }) {
  if (orphans.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <FileX className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum arquivo órfão nesta categoria</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bucket</TableHead>
              <TableHead>Caminho</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orphans.slice(0, 100).map((orphan, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <Badge variant="outline">{orphan.bucket}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs max-w-md truncate" title={orphan.path}>
                  {orphan.path}
                </TableCell>
                <TableCell>{formatBytes(orphan.size)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{orphan.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {orphans.length > 100 && (
          <div className="p-4 text-center text-muted-foreground text-sm border-t">
            Mostrando 100 de {orphans.length} arquivos
          </div>
        )}
      </CardContent>
    </Card>
  );
}
