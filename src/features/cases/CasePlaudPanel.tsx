import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Mic, Link2, Unlink, Copy, Check, ExternalLink, 
  RefreshCw, Settings, Loader2, Sparkles, Play
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlaudAssetCard } from "./PlaudAssetCard";
import { PlaudAssetModal } from "./PlaudAssetModal";

interface PlaudAsset {
  id: string;
  title: string;
  transcript: string | null;
  summary: string | null;
  received_at: string;
  created_at_source: string | null;
  case_id: string | null;
  audio_url: string | null;
  duration: number | null;
}

interface PlaudAnalysisJob {
  id: string;
  plaud_asset_id: string;
  status: string;
}

interface PlaudAssetAnalysis {
  plaud_asset_id: string;
  analysis: unknown;
  created_at: string;
}

interface CasePlaudPanelProps {
  caseId: string;
  officeId: string;
}

const WEBHOOK_BASE_URL = "https://uxrakfbedmkiqhidruxx.functions.supabase.co/plaud-ingest";

export function CasePlaudPanel({ caseId, officeId }: CasePlaudPanelProps) {
  const { toast } = useToast();
  const { isAdmin, role } = useUserRole();
  
  const [caseAssets, setCaseAssets] = useState<PlaudAsset[]>([]);
  const [unlinkedAssets, setUnlinkedAssets] = useState<PlaudAsset[]>([]);
  const [jobs, setJobs] = useState<PlaudAnalysisJob[]>([]);
  const [analyses, setAnalyses] = useState<PlaudAssetAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingIntegration, setTestingIntegration] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<PlaudAsset | null>(null);
  const [newPlaudCount, setNewPlaudCount] = useState(0);

  const webhookUrl = `${WEBHOOK_BASE_URL}?office_id=${officeId}`;

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    
    try {
      // Fetch assets linked to this case
      const { data: caseData } = await supabase
        .from("plaud_assets")
        .select("id, title, transcript, summary, received_at, created_at_source, case_id, audio_url, duration")
        .eq("case_id", caseId)
        .order("received_at", { ascending: false })
        .limit(20);

      // Fetch unlinked assets for this office
      const { data: unlinkedData } = await supabase
        .from("plaud_assets")
        .select("id, title, transcript, summary, received_at, created_at_source, case_id, audio_url, duration")
        .eq("office_id", officeId)
        .is("case_id", null)
        .order("received_at", { ascending: false })
        .limit(20);

      // Fetch analysis jobs for relevant assets
      const assetIds = [...(caseData || []), ...(unlinkedData || [])].map(a => a.id);
      
      if (assetIds.length > 0) {
        const { data: jobsData } = await supabase
          .from("plaud_analysis_jobs")
          .select("id, plaud_asset_id, status")
          .in("plaud_asset_id", assetIds);

        const { data: analysesData } = await supabase
          .from("plaud_asset_analysis")
          .select("plaud_asset_id, analysis, created_at")
          .in("plaud_asset_id", assetIds);

        setJobs(jobsData || []);
        setAnalyses(analysesData || []);
      }

      setCaseAssets(caseData || []);
      setUnlinkedAssets(unlinkedData || []);
    } catch (error) {
      console.error("Error fetching Plaud data:", error);
    } finally {
      setLoading(false);
    }
  }, [caseId, officeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("plaud-assets-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "plaud_assets",
          filter: `office_id=eq.${officeId}`,
        },
        (payload) => {
          console.log("[CasePlaudPanel] New Plaud asset received:", payload);
          setNewPlaudCount((prev) => prev + 1);
          toast({
            title: "Nova transcrição Plaud",
            description: `"${(payload.new as PlaudAsset).title}" recebida`,
          });
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "plaud_assets",
          filter: `office_id=eq.${officeId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [officeId, fetchData, toast]);

  // Link asset to case
  const linkToCase = async (assetId: string) => {
    const { error } = await supabase
      .from("plaud_assets")
      .update({ case_id: caseId })
      .eq("id", assetId);

    if (error) {
      toast({ title: "Erro ao vincular", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Vinculado com sucesso" });
      fetchData();
    }
  };

  // Unlink asset from case
  const unlinkFromCase = async (assetId: string) => {
    const { error } = await supabase
      .from("plaud_assets")
      .update({ case_id: null })
      .eq("id", assetId);

    if (error) {
      toast({ title: "Erro ao desvincular", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Desvinculado com sucesso" });
      fetchData();
    }
  };

  // Copy webhook URL
  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setUrlCopied(true);
    toast({ title: "URL copiada!" });
    setTimeout(() => setUrlCopied(false), 2000);
  };

  // Test integration
  const testIntegration = async () => {
    setTestingIntegration(true);
    try {
      // First test GET health check
      const healthResponse = await fetch(WEBHOOK_BASE_URL);
      const healthData = await healthResponse.json();

      if (!healthData.ok) {
        throw new Error("Health check failed");
      }

      toast({
        title: "Integração funcionando!",
        description: `Status: ${healthData.status}, Versão: ${healthData.version}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao testar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingIntegration(false);
    }
  };

  // Get AI status for an asset
  const getAiStatus = (assetId: string): "none" | "queued" | "running" | "done" | "failed" => {
    const analysis = analyses.find(a => a.plaud_asset_id === assetId);
    if (analysis) return "done";
    
    const job = jobs.find(j => j.plaud_asset_id === assetId);
    if (job) return job.status as "queued" | "running" | "failed";
    
    return "none";
  };

  const getAnalysis = (assetId: string): Record<string, any> | undefined => {
    const found = analyses.find(a => a.plaud_asset_id === assetId)?.analysis;
    return found && typeof found === 'object' ? found as Record<string, any> : undefined;
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Gravações deste caso */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Gravações deste Caso
              </CardTitle>
              <CardDescription>
                Transcrições vinculadas a este processo
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {caseAssets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mic className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma gravação vinculada a este caso.</p>
              <p className="text-xs mt-1">Vincule gravações da lista abaixo.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {caseAssets.map((asset) => (
                  <PlaudAssetCard
                    key={asset.id}
                    asset={asset}
                    aiStatus={getAiStatus(asset.id)}
                    onExpand={() => setSelectedAsset(asset)}
                    onUnlink={() => unlinkFromCase(asset.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Gravações não vinculadas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Unlink className="h-4 w-4" />
                Gravações do Escritório
                {newPlaudCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {newPlaudCount} novas
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Transcrições recebidas que ainda não foram vinculadas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {unlinkedAssets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Check className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Todas as gravações estão vinculadas.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {unlinkedAssets.map((asset) => (
                  <PlaudAssetCard
                    key={asset.id}
                    asset={asset}
                    aiStatus={getAiStatus(asset.id)}
                    onExpand={() => setSelectedAsset(asset)}
                    onLink={() => linkToCase(asset.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Configuração da Integração (apenas para ADMIN/OWNER) */}
      {isAdmin && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuração da Integração
            </CardTitle>
            <CardDescription>
              Configure o Plaud ou Zapier para enviar transcrições
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Webhook URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Webhook URL</label>
              <div className="flex gap-2">
                <Input 
                  value={webhookUrl} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={copyWebhookUrl}
                >
                  {urlCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure esta URL no Plaud ou Zapier. Use o header <code className="bg-muted px-1 rounded">x-lexos-token</code> para autenticação.
              </p>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testIntegration}
                disabled={testingIntegration}
              >
                {testingIntegration ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Testar Integração
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a 
                  href="https://supabase.com/dashboard/project/uxrakfbedmkiqhidruxx/functions/plaud-ingest/logs" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Logs
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal para ver detalhes */}
      {selectedAsset && (
        <PlaudAssetModal
          asset={selectedAsset}
          analysis={getAnalysis(selectedAsset.id)}
          aiStatus={getAiStatus(selectedAsset.id)}
          open={!!selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
}
