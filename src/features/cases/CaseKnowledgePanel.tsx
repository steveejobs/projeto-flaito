import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Search, 
  RefreshCw, 
  ExternalLink, 
  BookOpen, 
  Video, 
  Route, 
  Settings, 
  BarChart3,
  AlertCircle,
  Clock,
  Scale,
  Play,
  ChevronDown,
  Sparkles,
  Save,
  Trash2,
  Loader2,
  Plus,
  FileText,
  Link as LinkIcon,
  Info
} from "lucide-react";

interface Precedent {
  tribunal?: string;
  tipo?: string;
  ref_code?: string;
  titulo?: string;
  tese?: string;
  ementa?: string;
  tags?: string[];
  link?: string;
}

interface VideoItem {
  title?: string;
  channel?: string;
  duration?: string;
  score?: number;
  url?: string;
  chapters?: { title: string; time: string }[];
  resumo?: string;
}

interface TrailItem {
  titulo: string;
  descricao: string;
  tipo: string;
}

interface KnowledgeResult {
  used_query: string;
  cached: boolean;
  precedents: Precedent[];
  videos: VideoItem[];
  trilha?: {
    base: TrailItem[];
    aplicacao: TrailItem[];
    pratica: TrailItem[];
  };
}

interface OfficeSettings {
  videos_limit: number;
  precedents_limit: number;
  prefer_curated: boolean;
}

interface KpiDay {
  day: string;
  total_runs: number;
  cache_hits: number;
  cache_hit_rate: number;
  avg_videos: number;
  avg_precedents: number;
}

interface KpiSubject {
  subject: string;
  total_runs: number;
  cache_hits: number;
  last_run_at: string;
}

// Interface para sugestões de IA
interface AISuggestion {
  tribunal: string;
  tipo: string;
  numero: string | null;
  tese: string;
  observacao: string;
}

// Interface para trilha gerada por IA
interface AITrailStep {
  titulo: string;
  descricao: string;
  tipo: string;
}

interface CaseKnowledgePanelProps {
  caseId: string | null;
  subject: string;
  onSubjectChange: (value: string) => void;
}

const DEFAULT_SETTINGS: OfficeSettings = {
  videos_limit: 3,
  precedents_limit: 10,
  prefer_curated: true,
};

const VISIBLE_PRECEDENTS_INITIAL = 10;

export function CaseKnowledgePanel({ caseId, subject, onSubjectChange }: CaseKnowledgePanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [officeLoading, setOfficeLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KnowledgeResult | null>(null);
  const [error, setError] = useState<{ message: string; raw?: string } | null>(null);
  
  const [settings, setSettings] = useState<OfficeSettings>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  const [kpisDay, setKpisDay] = useState<KpiDay[]>([]);
  const [kpisSubject, setKpisSubject] = useState<KpiSubject[]>([]);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [kpisLoaded, setKpisLoaded] = useState(false);

  const [visiblePrecedents, setVisiblePrecedents] = useState(VISIBLE_PRECEDENTS_INITIAL);

  const [perf, setPerf] = useState<{ last?: string; ms?: number }>({});
  const mark = (label: string, ms: number) => setPerf({ last: label, ms });

  // Estados para busca híbrida com IA
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiFallback, setShowAiFallback] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  // Estados para modal de vídeo/transcrição
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoForm, setVideoForm] = useState({ title: "", url: "", transcription: "", tags: "" });
  const [videoSaving, setVideoSaving] = useState(false);

  // Estados para trilha por IA
  const [aiTrail, setAiTrail] = useState<AITrailStep[]>([]);
  const [aiTrailLoading, setAiTrailLoading] = useState(false);
  const [showAiTrailFallback, setShowAiTrailFallback] = useState(false);


  // Fetch office_id from office_members on mount WITH cancellation
  useEffect(() => {
    if (!user?.id) {
      setOfficeLoading(false);
      return;
    }

    let cancelled = false;
    setOfficeLoading(true);

    supabase
      .from("office_members")
      .select("office_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("CaseKnowledgePanel: office fetch error", error);
        }
        setOfficeId(data?.office_id ?? null);
        setOfficeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Função para buscar sugestões por IA
  const fetchAiSuggestions = async (query: string) => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("knowledge-ai-suggest", {
        body: { query },
      });

      if (error) throw error;

      if (data?.suggestions && Array.isArray(data.suggestions)) {
        setAiSuggestions(data.suggestions);
        setShowAiFallback(true);
      } else {
        throw new Error("Resposta inválida da IA");
      }
    } catch (err) {
      console.error("Erro na busca por IA:", err);
      toast({
        title: "Erro na busca por IA",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
      setAiSuggestions([]);
    } finally {
      setAiLoading(false);
    }
  };

  // Função para salvar sugestão no banco via RPC
  const saveSuggestionToDb = async (suggestion: AISuggestion, index: number) => {
    if (!officeId || !user?.id) {
      toast({
        title: "Erro",
        description: "Usuário ou escritório não identificado",
        variant: "destructive",
      });
      return;
    }

    setSavingIds((prev) => new Set(prev).add(index));
    try {
      const payload = {
        title: `${suggestion.tipo} ${suggestion.numero || ""} - ${suggestion.tribunal}`.trim(),
        tribunal: suggestion.tribunal,
        kind: suggestion.tipo,
        number: suggestion.numero,
        thesis: suggestion.tese,
        url: null,
        source: "AI_SUGGESTED",
        is_curated: false,
      };

      const { data, error } = await supabase.rpc("lexos_save_legal_precedent", {
        p: payload,
      });

      if (error) {
        console.error("RPC lexos_save_legal_precedent error:", error);
        const errCode = error.code ? ` [${error.code}]` : "";
        throw new Error(`${error.message}${errCode}`);
      }

      const savedId = data;
      toast({
        title: "Precedente salvo",
        description: `Salvo com sucesso. ID: ${savedId}`,
      });

      // Remove da lista e atualiza fallback no mesmo setter
      setAiSuggestions((prev) => {
        const next = prev.filter((_, i) => i !== index);
        setShowAiFallback(next.length > 0);
        return next;
      });
    } catch (err) {
      console.error("Erro ao salvar precedente:", err);
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({
        title: "Erro ao salvar",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  // Função para descartar sugestão
  const discardSuggestion = (index: number) => {
    setAiSuggestions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setShowAiFallback(next.length > 0);
      return next;
    });
  };

  // Função para salvar transcrição de vídeo
  const saveVideoTranscription = async () => {
    if (!officeId || !user?.id) {
      toast({
        title: "Erro",
        description: "Usuário ou escritório não identificado",
        variant: "destructive",
      });
      return;
    }

    if (!videoForm.title.trim() || !videoForm.transcription.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Título e transcrição são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setVideoSaving(true);
    try {
      const tags = videoForm.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const { error } = await supabase.from("video_transcriptions").insert({
        office_id: officeId,
        title: videoForm.title.trim(),
        url: videoForm.url.trim() || null,
        transcription: videoForm.transcription.trim(),
        tags,
        source: "manual",
        created_by: user.id,
      });

      if (error) throw error;

      toast({
        title: "Transcrição salva",
        description: "O vídeo foi adicionado à base de conhecimento.",
      });

      setVideoForm({ title: "", url: "", transcription: "", tags: "" });
      setVideoModalOpen(false);

      // Recarregar busca para atualizar aba Vídeos
      if (subject.trim()) {
        fetchKnowledge(true);
      }
    } catch (err) {
      console.error("Erro ao salvar transcrição:", err);
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setVideoSaving(false);
    }
  };

  // Função para gerar trilha por IA
  const generateAiTrail = async () => {
    if (!subject.trim()) return;

    setAiTrailLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("knowledge-ai-suggest", {
        body: { query: subject.trim(), type: "trail" },
      });

      if (error) throw error;

      if (data?.trail && Array.isArray(data.trail)) {
        setAiTrail(data.trail);
        setShowAiTrailFallback(true);
      } else if (data?.suggestions) {
        // Fallback: converter sugestões em trilha básica
        const basicTrail: AITrailStep[] = [
          { titulo: "Estudar conceitos básicos", descricao: `Revisar fundamentos sobre ${subject}`, tipo: "base" },
          { titulo: "Analisar jurisprudência", descricao: "Verificar precedentes do STJ e tribunais estaduais", tipo: "aplicacao" },
          { titulo: "Elaborar peça", descricao: "Aplicar conhecimento na petição do caso", tipo: "pratica" },
        ];
        setAiTrail(basicTrail);
        setShowAiTrailFallback(true);
      }
    } catch (err) {
      console.error("Erro ao gerar trilha por IA:", err);
      // Gerar trilha padrão mesmo com erro
      const defaultTrail: AITrailStep[] = [
        { titulo: "1. Fundamentação teórica", descricao: `Estudar doutrina sobre ${subject}`, tipo: "base" },
        { titulo: "2. Pesquisa de precedentes", descricao: "Buscar jurisprudência relevante nos tribunais superiores", tipo: "aplicacao" },
        { titulo: "3. Aplicação prática", descricao: "Utilizar o conhecimento adquirido na estratégia do caso", tipo: "pratica" },
      ];
      setAiTrail(defaultTrail);
      setShowAiTrailFallback(true);
    } finally {
      setAiTrailLoading(false);
    }
  };

  const fetchKnowledge = async (forceRefresh = false) => {
    if (!subject.trim()) {
      toast({
        title: "Assunto obrigatório",
        description: "Digite um assunto ou query para buscar.",
        variant: "destructive",
      });
      return;
    }

    if (!officeId) {
      toast({
        title: "Escritório não identificado",
        description: "Aguarde o carregamento ou faça login novamente.",
        variant: "destructive",
      });
      return;
    }

    const t0 = performance.now();
    console.time("CaseKnowledgePanel.fetchKnowledge");
    setLoading(true);
    setError(null);
    setResult(null);
    setVisiblePrecedents(VISIBLE_PRECEDENTS_INITIAL);
    setShowAiFallback(false);
    setAiSuggestions([]);
    setShowAiTrailFallback(false);
    setAiTrail([]);

    try {
      // Always use recommend_knowledge_ranked with p_case_id
      const { data, error: rpcError } = await supabase.rpc("recommend_knowledge_ranked", {
        p_office_id: officeId,
        p_case_id: caseId ?? null,
        p_subject: subject.trim(),
        p_force_refresh: forceRefresh,
      });

      if (rpcError) {
        throw rpcError;
      }

      // Tolerant handling: array, object, or null
      let resultData: Record<string, unknown> | null = null;
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        if (first && typeof first === "object" && !Array.isArray(first)) {
          resultData = first as Record<string, unknown>;
        }
      } else if (data && typeof data === "object" && !Array.isArray(data)) {
        resultData = data as Record<string, unknown>;
      }

      const precedents = (resultData?.precedents as Precedent[]) || [];
      let videos = (resultData?.videos as VideoItem[]) || [];

      // Se não houver vídeos do RPC, buscar diretamente de video_transcriptions
      if (videos.length === 0 && officeId) {
        const { data: transcriptions } = await supabase
          .from("video_transcriptions")
          .select("id, title, url, tags, created_at")
          .eq("office_id", officeId)
          .order("created_at", { ascending: false })
          .limit(settings.videos_limit);

        if (transcriptions && transcriptions.length > 0) {
          videos = transcriptions.map((t) => ({
            title: t.title,
            url: t.url || undefined,
            channel: "Transcrição manual",
            duration: undefined,
            score: undefined,
            chapters: [],
            resumo: undefined,
          }));
        }
      }

      if (resultData) {
        setResult({
          used_query: (resultData.used_query as string) || subject,
          cached: Boolean(resultData.cached),
          precedents,
          videos,
          trilha: resultData.trilha as KnowledgeResult["trilha"],
        });

        // Se não houver precedentes, acionar fallback de IA
        if (precedents.length === 0) {
          toast({
            title: "Buscando sugestões por IA",
            description: "Nenhum precedente na base interna. Gerando sugestões...",
          });
          fetchAiSuggestions(subject.trim());
        } else {
          toast({
            title: "Busca concluída",
            description: resultData.cached ? "Resultado do cache" : "Dados atualizados",
          });
        }

        // Se não houver trilha, gerar por IA
        if (!resultData.trilha) {
          generateAiTrail();
        }
      } else {
        setResult({
          used_query: subject,
          cached: false,
          precedents: [],
          videos: [],
        });
        // Acionar fallback de IA
        toast({
          title: "Buscando sugestões por IA",
          description: "Nenhum precedente na base interna. Gerando sugestões...",
        });
        fetchAiSuggestions(subject.trim());
        generateAiTrail();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao buscar conhecimento";
      setError({
        message: errorMessage,
        raw: JSON.stringify(err, null, 2),
      });
      toast({
        title: "Erro na RPC",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      const ms = performance.now() - t0;
      console.timeEnd("CaseKnowledgePanel.fetchKnowledge");
      mark("Busca", ms);
      setLoading(false);
    }
  };

  // loadSettings: on-demand only, with cache
  const loadSettings = async (force = false) => {
    if (!officeId) return;
    if (!force && settingsLoaded) return;

    const t0 = performance.now();
    console.time("CaseKnowledgePanel.loadSettings");
    setSettingsLoading(true);
    try {
      const { data, error } = await supabase
        .from("office_settings")
        .select("videos_limit, precedents_limit, prefer_curated")
        .eq("office_id", officeId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettings({
          videos_limit: data.videos_limit ?? DEFAULT_SETTINGS.videos_limit,
          precedents_limit: data.precedents_limit ?? DEFAULT_SETTINGS.precedents_limit,
          prefer_curated: data.prefer_curated ?? DEFAULT_SETTINGS.prefer_curated,
        });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
      setSettingsLoaded(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      toast({
        title: "Erro ao carregar configurações",
        description: errorMessage,
        variant: "destructive",
      });
      setSettings(DEFAULT_SETTINGS);
    } finally {
      const ms = performance.now() - t0;
      console.timeEnd("CaseKnowledgePanel.loadSettings");
      mark("Config", ms);
      setSettingsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!officeId) {
      toast({
        title: "Escritório não identificado",
        description: "Aguarde o carregamento.",
        variant: "destructive",
      });
      return;
    }

    setSettingsLoading(true);
    try {
      const { error } = await supabase.from("office_settings").upsert({
        office_id: officeId,
        plan_code: "free",
        videos_limit: settings.videos_limit,
        precedents_limit: settings.precedents_limit,
        prefer_curated: settings.prefer_curated,
      });

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As preferências do escritório foram atualizadas.",
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      toast({
        title: "Erro ao salvar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSettingsLoading(false);
    }
  };

  // loadKpis: on-demand only, with cache + select only needed columns
  const loadKpis = async (force = false) => {
    if (!force && kpisLoaded) return;

    const t0 = performance.now();
    console.time("CaseKnowledgePanel.loadKpis");
    setKpisLoading(true);
    try {
      const [dayRes, subjectRes] = await Promise.all([
        supabase
          .from("vw_knowledge_kpis_day")
          .select("day, total_runs, cache_hits, cache_hit_rate, avg_videos, avg_precedents")
          .order("day", { ascending: false })
          .limit(30),
        supabase
          .from("vw_knowledge_kpis_subject")
          .select("subject, total_runs, cache_hits, last_run_at")
          .order("last_run_at", { ascending: false })
          .limit(50),
      ]);

      if (dayRes.error) {
        toast({
          title: "Erro ao carregar KPIs diários",
          description: dayRes.error.message,
          variant: "destructive",
        });
      } else {
        setKpisDay(
          (dayRes.data || []).map((row) => ({
            day: row.day,
            total_runs: row.total_runs ?? 0,
            cache_hits: row.cache_hits ?? 0,
            cache_hit_rate: row.cache_hit_rate ?? 0,
            avg_videos: row.avg_videos ?? 0,
            avg_precedents: row.avg_precedents ?? 0,
          }))
        );
      }

      if (subjectRes.error) {
        toast({
          title: "Erro ao carregar KPIs por assunto",
          description: subjectRes.error.message,
          variant: "destructive",
        });
      } else {
        setKpisSubject(
          (subjectRes.data || []).map((row) => ({
            subject: row.subject ?? "",
            total_runs: row.total_runs ?? 0,
            cache_hits: row.cache_hits ?? 0,
            last_run_at: row.last_run_at ?? "",
          }))
        );
      }
      setKpisLoaded(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      toast({
        title: "Erro ao carregar KPIs",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      const ms = performance.now() - t0;
      console.timeEnd("CaseKnowledgePanel.loadKpis");
      mark("KPIs", ms);
      setKpisLoading(false);
    }
  };

  const renderAiSuggestions = () => {
    if (aiLoading) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm">Gerando sugestões por IA...</span>
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      );
    }

    if (!showAiFallback || aiSuggestions.length === 0) {
      return null;
    }

    return (
      <div className="space-y-4">
        {/* Banner informativo */}
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Nenhum precedente encontrado na base interna
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              As sugestões abaixo foram geradas por IA e devem ser verificadas antes do uso.
            </p>
          </div>
        </div>

        {/* Lista de sugestões */}
        {aiSuggestions.map((s, idx) => (
          <Card 
            key={idx} 
            className="border-l-4 border-l-amber-500 bg-muted/30"
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Sugestão por IA
                    </Badge>
                    <Badge variant="outline">{s.tribunal}</Badge>
                    <Badge variant="secondary">{s.tipo}</Badge>
                    {s.numero && (
                      <span className="text-sm font-mono text-muted-foreground">
                        {s.numero}
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-base">
                    {s.tipo} {s.numero ? `${s.numero}` : ""} - {s.tribunal}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {s.tese}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                {s.observacao}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => saveSuggestionToDb(s, idx)}
                  disabled={savingIds.has(idx)}
                >
                  {savingIds.has(idx) ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Salvar no banco
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => discardSuggestion(idx)}
                  disabled={savingIds.has(idx)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Descartar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderPrecedentes = () => {
    const hasPrecedents = result?.precedents?.length ?? 0;

    // Se não há precedentes do banco, mostrar sugestões de IA ou estado vazio
    if (!hasPrecedents) {
      // Se está carregando ou tem sugestões de IA, mostrar elas
      if (aiLoading || (showAiFallback && aiSuggestions.length > 0)) {
        return (
          <ScrollArea className="h-[500px]">
            <div className="pr-4">
              {renderAiSuggestions()}
            </div>
          </ScrollArea>
        );
      }

      // Estado vazio padrão
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Scale className="h-12 w-12 mb-4 opacity-50" />
          <p>Nenhum precedente encontrado</p>
        </div>
      );
    }

    const visibleList = result!.precedents.slice(0, visiblePrecedents);
    const hasMore = result!.precedents.length > visiblePrecedents;

    return (
      <ScrollArea className="h-[500px]">
        <div className="grid gap-4 pr-4">
          {visibleList.map((p, idx) => (
            <Card key={idx} className="border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.tribunal && <Badge variant="outline">{p.tribunal}</Badge>}
                      {p.tipo && <Badge variant="secondary">{p.tipo}</Badge>}
                      {p.ref_code && (
                        <span className="text-sm font-mono text-muted-foreground">
                          {p.ref_code}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-base">{p.titulo || "Sem título"}</CardTitle>
                  </div>
                  {p.link && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={p.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {p.tese || p.ementa || "Sem ementa disponível"}
                </p>
                {p.tags?.length ? (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {p.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
          {hasMore && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setVisiblePrecedents((v) => v + 10)}
            >
              <ChevronDown className="h-4 w-4 mr-2" />
              Ver mais ({result!.precedents.length - visiblePrecedents} restantes)
            </Button>
          )}
        </div>
      </ScrollArea>
    );
  };

  const renderVideos = () => {
    const hasVideos = result?.videos?.length ?? 0;

    // Modal para adicionar vídeo
    const videoModal = (
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Vídeo por Transcrição</DialogTitle>
            <DialogDescription>
              Cole a transcrição do vídeo para indexar na base de conhecimento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="video-title">Título *</Label>
              <Input
                id="video-title"
                placeholder="Ex: Aula sobre Prescrição Intercorrente"
                value={videoForm.title}
                onChange={(e) => setVideoForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-url">URL do vídeo (opcional)</Label>
              <Input
                id="video-url"
                placeholder="https://youtube.com/watch?v=..."
                value={videoForm.url}
                onChange={(e) => setVideoForm((f) => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-transcription">Transcrição *</Label>
              <Textarea
                id="video-transcription"
                placeholder="Cole aqui a transcrição do vídeo..."
                rows={6}
                value={videoForm.transcription}
                onChange={(e) => setVideoForm((f) => ({ ...f, transcription: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-tags">Tags (separadas por vírgula)</Label>
              <Input
                id="video-tags"
                placeholder="prescrição, execução fiscal, processo"
                value={videoForm.tags}
                onChange={(e) => setVideoForm((f) => ({ ...f, tags: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveVideoTranscription} disabled={videoSaving}>
              {videoSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    if (!hasVideos) {
      return (
        <div className="space-y-4">
          {videoModal}
          
          {/* Banner explicativo */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Vídeos aparecem quando existe transcrição indexada
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                A busca de vídeos funciona por texto (transcrição/capítulos), não por mídia. 
                Adicione transcrições para que os vídeos apareçam nas buscas relevantes.
              </p>
            </div>
          </div>

          {/* Card de fallback */}
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Video className="h-12 w-12 mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">Nenhum vídeo indexado ainda</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Envie uma transcrição (txt/pdf) ou cole o link do YouTube para capturar a legenda e indexar o conteúdo.
              </p>
              <Button onClick={() => setVideoModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar vídeo por transcrição
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[500px]">
        <div className="space-y-4 pr-4">
          {videoModal}
          
          <div className="flex items-center justify-between">
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground flex items-center gap-2 flex-1 mr-2">
              <AlertCircle className="h-4 w-4" />
              Vídeos analisados por texto (transcrição/capítulos), não por mídia.
            </div>
            <Button size="sm" variant="outline" onClick={() => setVideoModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
          
          <div className="grid gap-4">
            {result.videos.map((v, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{v.title || "Sem título"}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span>{v.channel || "Canal desconhecido"}</span>
                        {v.duration && (
                          <>
                            <span>•</span>
                            <Clock className="h-3 w-3" />
                            <span>{v.duration}</span>
                          </>
                        )}
                        {v.score != null && (
                          <>
                            <span>•</span>
                            <span className="text-primary font-medium">
                              Score: {v.score.toFixed(2)}
                            </span>
                          </>
                        )}
                      </CardDescription>
                    </div>
                    {v.url && (
                      <Button variant="default" size="sm" asChild>
                        <a href={v.url} target="_blank" rel="noopener noreferrer">
                          <Play className="h-4 w-4 mr-1" />
                          Assistir
                        </a>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                {(v.chapters?.length || v.resumo) && (
                  <CardContent>
                    {v.resumo && (
                      <p className="text-sm text-muted-foreground mb-2">{v.resumo}</p>
                    )}
                    {v.chapters?.length ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Capítulos:</p>
                        <ul className="text-sm space-y-1">
                          {v.chapters.slice(0, 5).map((ch, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground font-mono">
                                {ch.time}
                              </span>
                              <span>{ch.title}</span>
                            </li>
                          ))}
                          {v.chapters.length > 5 && (
                            <li className="text-xs text-muted-foreground">
                              +{v.chapters.length - 5} capítulos
                            </li>
                          )}
                        </ul>
                      </div>
                    ) : null}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      </ScrollArea>
    );
  };

  const renderTrilha = () => {
    const trilha = result?.trilha;

    const renderBlock = (title: string, items: TrailItem[] | AITrailStep[], color: string, isAi = false) => (
      <Card className={`border-l-4 ${color}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {isAi && (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                IA
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{item.titulo}</span>
                  {item.descricao && (
                    <p className="text-muted-foreground text-xs">{item.descricao}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    );

    // Se tem trilha do banco, mostrar
    if (trilha) {
      return (
        <div className="grid md:grid-cols-3 gap-4">
          {renderBlock("Base", trilha.base || [], "border-l-blue-500")}
          {renderBlock("Aplicação", trilha.aplicacao || [], "border-l-amber-500")}
          {renderBlock("Prática", trilha.pratica || [], "border-l-green-500")}
        </div>
      );
    }

    // Se está carregando trilha por IA
    if (aiTrailLoading) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm">Gerando trilha de aprendizado por IA...</span>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      );
    }

    // Se tem trilha gerada por IA
    if (showAiTrailFallback && aiTrail.length > 0) {
      const baseItems = aiTrail.filter((t) => t.tipo === "base" || aiTrail.indexOf(t) === 0);
      const aplicacaoItems = aiTrail.filter((t) => t.tipo === "aplicacao" || aiTrail.indexOf(t) === 1);
      const praticaItems = aiTrail.filter((t) => t.tipo === "pratica" || aiTrail.indexOf(t) === 2);

      return (
        <div className="space-y-4">
          {/* Banner informativo */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Trilha gerada por IA
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                A trilha foi gerada automaticamente pois não há base interna suficiente 
                (precedentes salvos + vídeos indexados + documentos do caso).
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {renderBlock("Base", baseItems.length ? baseItems : [aiTrail[0]].filter(Boolean), "border-l-blue-500", true)}
            {renderBlock("Aplicação", aplicacaoItems.length ? aplicacaoItems : [aiTrail[1]].filter(Boolean), "border-l-amber-500", true)}
            {renderBlock("Prática", praticaItems.length ? praticaItems : [aiTrail[2]].filter(Boolean), "border-l-green-500", true)}
          </div>

          {/* Botões de ação */}
          <div className="flex gap-2 flex-wrap">
            {caseId && (
              <Button size="sm" variant="default">
                <Save className="h-4 w-4 mr-1" />
                Salvar trilha no caso
              </Button>
            )}
            {!caseId && (
              <Button size="sm" variant="outline">
                <LinkIcon className="h-4 w-4 mr-1" />
                Vincular a um caso
              </Button>
            )}
          </div>
        </div>
      );
    }

    // Estado vazio (nunca deveria chegar aqui pois geramos por IA)
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-muted/50 border rounded-lg">
          <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Trilha não disponível</p>
            <p className="text-xs text-muted-foreground mt-1">
              A trilha é gerada a partir de precedentes salvos, vídeos indexados e documentos do caso.
              Adicione conteúdo à base para gerar trilhas personalizadas.
            </p>
          </div>
        </div>
        <Button onClick={generateAiTrail} disabled={!subject.trim()}>
          <Sparkles className="h-4 w-4 mr-2" />
          Gerar trilha por IA
        </Button>
      </div>
    );
  };

  const renderConfig = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Configurações do Escritório</CardTitle>
        <CardDescription>
          Ajuste os limites e preferências para busca de conhecimento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="videos_limit">Limite de Vídeos (1-5)</Label>
            <Input
              id="videos_limit"
              type="number"
              min={1}
              max={5}
              value={settings.videos_limit}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  videos_limit: Math.min(5, Math.max(1, parseInt(e.target.value) || 1)),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="precedents_limit">Limite de Precedentes</Label>
            <Input
              id="precedents_limit"
              type="number"
              min={1}
              value={settings.precedents_limit}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  precedents_limit: Math.max(1, parseInt(e.target.value) || 1),
                }))
              }
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="prefer_curated"
            checked={settings.prefer_curated}
            onCheckedChange={(checked) =>
              setSettings((s) => ({ ...s, prefer_curated: checked }))
            }
          />
          <Label htmlFor="prefer_curated">Preferir conteúdo curado</Label>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => loadSettings(true)} variant="outline" disabled={settingsLoading}>
            {settingsLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            Recarregar
          </Button>
          <Button onClick={saveSettings} disabled={settingsLoading}>
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderKpis = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">KPIs por Dia (últimos 30)</CardTitle>
        </CardHeader>
        <CardContent>
          {kpisLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : kpisDay.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum dado disponível</p>
          ) : (
            <ScrollArea className="h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead>Total Runs</TableHead>
                    <TableHead>Cache Hits</TableHead>
                    <TableHead>Cache Rate</TableHead>
                    <TableHead>Avg Vídeos</TableHead>
                    <TableHead>Avg Precedentes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpisDay.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.day}</TableCell>
                      <TableCell>{row.total_runs}</TableCell>
                      <TableCell>{row.cache_hits}</TableCell>
                      <TableCell>{(row.cache_hit_rate * 100).toFixed(1)}%</TableCell>
                      <TableCell>{row.avg_videos?.toFixed(1) ?? "-"}</TableCell>
                      <TableCell>{row.avg_precedents?.toFixed(1) ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">KPIs por Assunto (últimos 50)</CardTitle>
        </CardHeader>
        <CardContent>
          {kpisLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : kpisSubject.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum dado disponível</p>
          ) : (
            <ScrollArea className="h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Total Runs</TableHead>
                    <TableHead>Cache Hits</TableHead>
                    <TableHead>Último Run</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpisSubject.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-xs truncate">{row.subject}</TableCell>
                      <TableCell>{row.total_runs}</TableCell>
                      <TableCell>{row.cache_hits}</TableCell>
                      <TableCell>{row.last_run_at}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Button onClick={() => loadKpis(true)} variant="outline" disabled={kpisLoading}>
        <RefreshCw className={`h-4 w-4 mr-2 ${kpisLoading ? "animate-spin" : ""}`} />
        Atualizar KPIs
      </Button>
    </div>
  );

  const isOfficeReady = !officeLoading && !!officeId;
  const canSearch = isOfficeReady && !loading;

  return (
    <div className="space-y-6">
      {/* Search Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Busca de Conhecimento
          </CardTitle>
          {caseId && (
            <CardDescription>
              Vinculado ao caso selecionado
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Digite o assunto ou query..."
                value={subject}
                onChange={(e) => onSubjectChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canSearch && fetchKnowledge(false)}
                disabled={!isOfficeReady}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => fetchKnowledge(false)} 
                disabled={!canSearch}
              >
                <Search className={`h-4 w-4 mr-2 ${loading ? "animate-pulse" : ""}`} />
                {officeLoading ? "Carregando escritório…" : "Buscar"}
              </Button>
              <Button
                onClick={() => fetchKnowledge(true)}
                disabled={!canSearch}
                variant="outline"
                title="Forçar atualização (ignora cache)"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          {result?.cached && (
            <p className="text-xs text-muted-foreground mt-2">
              Resultado do cache (query: {result.used_query})
            </p>
          )}
          {perf?.last && perf?.ms != null && (
            <div className="text-xs text-muted-foreground mt-2">
              Última medição: <b>{perf.last}</b> — {(perf.ms / 1000).toFixed(2)}s
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Erro na Busca
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{error.message}</p>
            {error.raw && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Diagnóstico (erro bruto)
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                  {error.raw}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {/* Results Tabs */}
      {result && !loading && (
        <Tabs defaultValue="precedentes" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="precedentes" className="flex items-center gap-1">
              <Scale className="h-4 w-4" />
              <span className="hidden sm:inline">Precedentes</span>
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex items-center gap-1">
              <Video className="h-4 w-4" />
              <span className="hidden sm:inline">Vídeos</span>
            </TabsTrigger>
            <TabsTrigger value="trilha" className="flex items-center gap-1">
              <Route className="h-4 w-4" />
              <span className="hidden sm:inline">Trilha</span>
            </TabsTrigger>
            <TabsTrigger 
              value="config" 
              className="flex items-center gap-1"
              onClick={() => loadSettings()}
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger 
              value="kpis" 
              className="flex items-center gap-1"
              onClick={() => loadKpis()}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">KPIs</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="precedentes" className="mt-4">
            {renderPrecedentes()}
          </TabsContent>
          <TabsContent value="videos" className="mt-4">
            {renderVideos()}
          </TabsContent>
          <TabsContent value="trilha" className="mt-4">
            {renderTrilha()}
          </TabsContent>
          <TabsContent value="config" className="mt-4">
            {renderConfig()}
          </TabsContent>
          <TabsContent value="kpis" className="mt-4">
            {renderKpis()}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
