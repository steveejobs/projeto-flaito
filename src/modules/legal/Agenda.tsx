import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Search,
  FileText,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  CalendarRange,
  Video,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Helper para detectar provedor de videoconferência
function getMeetingProvider(url: string | null | undefined): string | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes("meet.google") || lower.includes("meet.")) return "MEET";
  if (lower.includes("teams.microsoft") || lower.includes("teams.live")) return "TEAMS";
  if (lower.includes("zoom.us") || lower.includes("zoom.")) return "ZOOM";
  if (lower.includes("webex")) return "WEBEX";
  return "OUTRO";
}

const PROVIDER_LABELS: Record<string, { label: string; className: string }> = {
  MEET: { label: "Google Meet", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  TEAMS: { label: "Teams", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  ZOOM: { label: "Zoom", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
  WEBEX: { label: "Webex", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  OUTRO: { label: "Link", className: "bg-muted text-muted-foreground" },
};

// Tipo do item retornado pela RPC
type AgendaItem = {
  id: string;
  title: string;
  kind: string | null;
  status: string | null;
  local_date: string;
  local_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  all_day: boolean;
  priority: string | null;
  case_id: string | null;
  case_title: string | null;
  client_id: string | null;
  client_name: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  meeting_url?: string | null;
  meeting_provider?: string | null;
};

type AgendaDayInfo = {
  date: string;
  dow: number;
  in_month?: boolean;
  is_today?: boolean;
};

type AgendaConflict = {
  a_id: string;
  b_id: string;
  assigned_to: string | null;
  a_title: string;
  b_title: string;
  a_kind: string;
  b_kind: string;
  a_start: string;
  a_end: string | null;
  b_start: string;
  b_end: string | null;
  overlap_minutes: number;
};

type AgendaBundle = {
  office_id: string;
  timezone: string;
  week_start_local: string;
  week_end_local: string;
  from: string;
  to: string;
  days: AgendaDayInfo[];
  items: AgendaItem[];
  assignees: Array<{ assigned_to: string | null; total: number }>;
  conflicts: AgendaConflict[];
};

type ViewMode = "WEEK" | "MONTH";
type KindFilter = "all" | "AUDIENCIA" | "REUNIAO" | "PRAZO" | "TAREFA";
type StatusFilter = "all" | "PENDENTE" | "CONCLUIDO" | "CANCELADO";

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Todos os tipos" },
  { value: "AUDIENCIA", label: "Audiências" },
  { value: "REUNIAO", label: "Reuniões" },
  { value: "PRAZO", label: "Prazos" },
  { value: "TAREFA", label: "Tarefas" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "PENDENTE", label: "Pendentes" },
  { value: "CONCLUIDO", label: "Concluídos" },
  { value: "CANCELADO", label: "Cancelados" },
];

const STATUS_BADGES: Record<
  Exclude<StatusFilter, "all">,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDENTE: {
    label: "Pendente",
    className: "bg-amber-100 text-amber-700",
    icon: AlertTriangle,
  },
  CONCLUIDO: {
    label: "Concluído",
    className: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
  CANCELADO: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
    icon: AlertTriangle,
  },
};

function formatDateLabel(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatDayNumber(dateStr: string) {
  if (!dateStr || typeof dateStr !== 'string') return "";
  const parts = dateStr.split("-");
  const d = Number(parts?.[2] ?? NaN);
  return Number.isFinite(d) ? d : "";
}

function formatTime(time: string | null) {
  if (!time) return "--:--";
  return time.slice(0, 5);
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // segunda-feira
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function getMonthStart(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  
  const startStr = start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const endStr = end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  
  return `${startStr} - ${endStr}`;
}

function formatMonthLabel(monthRef: string): string {
  const date = new Date(monthRef + "T00:00:00");
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function Agenda() {
  const { toast } = useToast();

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("WEEK");

  // Data
  const [bundle, setBundle] = useState<AgendaBundle | null>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Week navigation
  const [weekStart, setWeekStart] = useState<string>(() => getWeekStart(new Date()));
  
  // Month navigation
  const [monthRef, setMonthRef] = useState<string>(() => getMonthStart(new Date()));
  
  // Filters from RPC
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [includeDone, setIncludeDone] = useState(true);

  // Local filters (still useful for quick filtering)
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Selection
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<"dados" | "relacoes" | "arquivos" | "notas">("dados");

  // Google Sync
  const [syncing, setSyncing] = useState(false);

  async function loadAgendaBundle() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: member, error: memberError } = await supabase
        .from("office_members")
        .select("office_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (memberError || !member) {
        setError("Você não está vinculado a nenhum escritório ativo.");
        setLoading(false);
        return;
      }

      const officeIdResolved = member.office_id;

      const rpcName =
        viewMode === "MONTH"
          ? "get_agenda_month_bundle"
          : "get_agenda_week_bundle";

      const rpcArgs =
        viewMode === "MONTH"
          ? {
              p_office_id: officeIdResolved,
              p_month_local: monthRef,
              p_assigned_to: assignedTo,
              p_include_done: includeDone,
              p_include_conflicts: false,
            }
          : {
              p_office_id: officeIdResolved,
              p_week_start_local: weekStart,
              p_assigned_to: assignedTo,
              p_include_done: includeDone,
              p_include_conflicts: true,
            };

      const { data, error: rpcError } = await supabase.rpc(rpcName, rpcArgs);

      if (rpcError) {
        console.error("[Agenda RPC Error]", rpcError);
        throw new Error(rpcError.message);
      }

      if (!data) {
        throw new Error("RPC retornou data nula");
      }

      setOfficeId(officeIdResolved);
      const bundleData = data as AgendaBundle;
      setBundle(bundleData);
      setItems(Array.isArray(bundleData.items) ? bundleData.items : []);
    } catch (e: unknown) {
      console.error("[Agenda] Erro ao carregar:", e);
      const message = e instanceof Error ? e.message : "Erro ao carregar agenda.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncGoogleCalendar() {
    if (!officeId) {
      toast({ title: "Erro", description: "Office ID não disponível.", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Erro", description: "Sessão não encontrada. Faça login novamente.", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("gcal_sync_events", {
        body: { office_id: officeId, calendar_id: "primary" },
      });

      if (error) {
        console.error("[GCal Sync Error]", error);
        toast({ title: "Erro ao sincronizar", description: error.message, variant: "destructive" });
        return;
      }

      if (data?.error) {
        console.error("[GCal Sync Response Error]", data);
        const msg = data.message || data.error || "Erro desconhecido";
        toast({ title: "Erro", description: msg, variant: "destructive" });
        return;
      }

      toast({
        title: "Sincronização concluída",
        description: `${data.total_upserted || 0} evento(s) importado(s) do Google Agenda.`,
      });

      // Recarrega bundle para refletir novos itens
      loadAgendaBundle();
    } catch (e) {
      console.error("[GCal Sync Exception]", e);
      toast({ title: "Erro", description: "Falha ao sincronizar com Google Agenda.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadAgendaBundle();
  }, [viewMode, weekStart, monthRef, assignedTo, includeDone]);

  // Filtros locais simples (opcional, para busca rápida)
  const filteredItems = items.filter((item) => {
    // Kind filter
    if (kindFilter !== "all" && (item.kind || "").toUpperCase() !== kindFilter) {
      return false;
    }
    // Status filter
    if (statusFilter !== "all" && (item.status || "").toUpperCase() !== statusFilter) {
      return false;
    }
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = item.title.toLowerCase().includes(q);
      const caseMatch = item.case_title?.toLowerCase().includes(q);
      const clientMatch = item.client_name?.toLowerCase().includes(q);
      if (!titleMatch && !caseMatch && !clientMatch) return false;
    }
    return true;
  });

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    const key = status.toUpperCase() as Exclude<StatusFilter, "all">;
    const config = STATUS_BADGES[key];
    if (!config) return null;
    const Icon = config.icon;
    return (
      <Badge className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleSelectItem = (item: AgendaItem) => {
    setSelectedItem(item);
    setActiveTab("dados");
  };

  const handleMarkDone = async () => {
    if (!selectedItem) return;
    try {
      const { error } = await supabase
        .from("agenda_items")
        .update({ status: "CONCLUIDO" })
        .eq("id", selectedItem.id);

      if (error) throw error;
      toast({
        title: "Compromisso concluído",
        description: "O status foi atualizado para concluído.",
      });
      await loadAgendaBundle();
      setSelectedItem((prev) =>
        prev ? { ...prev, status: "CONCLUIDO" } : null
      );
    } catch (err: unknown) {
      console.error(err);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    }
  };

  // Navigation handlers
  const goToPrevious = () => {
    if (viewMode === "WEEK") {
      const current = new Date(weekStart + "T00:00:00");
      current.setDate(current.getDate() - 7);
      setWeekStart(current.toISOString().slice(0, 10));
    } else {
      const current = new Date(monthRef + "T00:00:00");
      current.setMonth(current.getMonth() - 1);
      setMonthRef(getMonthStart(current));
    }
  };

  const goToNext = () => {
    if (viewMode === "WEEK") {
      const current = new Date(weekStart + "T00:00:00");
      current.setDate(current.getDate() + 7);
      setWeekStart(current.toISOString().slice(0, 10));
    } else {
      const current = new Date(monthRef + "T00:00:00");
      current.setMonth(current.getMonth() + 1);
      setMonthRef(getMonthStart(current));
    }
  };

  const goToCurrent = () => {
    if (viewMode === "WEEK") {
      setWeekStart(getWeekStart(new Date()));
    } else {
      setMonthRef(getMonthStart(new Date()));
    }
  };

  // Get conflicts from bundle (only week mode)
  const conflicts = viewMode === "WEEK" && bundle && "conflicts" in bundle ? bundle.conflicts : [];

  // Get assignees from bundle
  const assignees = bundle?.assignees || [];

  // Get days from bundle (for month view)
  const bundleDays = bundle && "days" in bundle ? bundle.days : [];

  // Items for a specific day (month view)
  const getItemsForDay = (date: string) => {
    return filteredItems.filter((item) => item.local_date === date);
  };

  return (
    <div className="p-4 lg:p-6 h-[calc(100vh-4rem)] lg:h-[calc(100vh-5rem)] overflow-hidden">
      <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
        {/* Coluna esquerda - Lista/Grid */}
        <Card className={cn(
          "h-full flex flex-col overflow-hidden transition-all duration-300",
          selectedItem ? "hidden lg:flex" : "flex"
        )}>
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle className="text-lg">Agenda</CardTitle>
                  <CardDescription>
                    {items?.length ?? 0} compromisso(s) {viewMode === "WEEK" ? "na semana" : "no mês"}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleSyncGoogleCalendar}
                  disabled={syncing || !officeId}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
                  {syncing ? "Sincronizando..." : "Sync Google"}
                </Button>
              </div>

              {/* Toggle Semana/Mês */}
              <div className="flex rounded-lg bg-muted p-0.5">
                <Button
                  variant={viewMode === "WEEK" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={() => setViewMode("WEEK")}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Semana
                </Button>
                <Button
                  variant={viewMode === "MONTH" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={() => setViewMode("MONTH")}
                >
                  <CalendarRange className="h-3.5 w-3.5" />
                  Mês
                </Button>
              </div>
            </div>

            {/* Navegação */}
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2 py-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={goToCurrent}
                className="text-xs font-medium hover:underline"
              >
                {viewMode === "WEEK" ? formatWeekRange(weekStart) : formatMonthLabel(monthRef)}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={goToNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Alerta de conflitos (somente WEEK) */}
            {viewMode === "WEEK" && conflicts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const c = conflicts[0];
                  if (!c) return;
                  const item = items.find((i) => i.id === c.a_id || i.id === c.b_id);
                  if (item) handleSelectItem(item);
                }}
                className="mt-2 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors w-full text-left"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="flex-1">{conflicts.length} conflito(s) de horário detectado(s)</span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
              </button>
            )}

            {/* Chips de responsáveis */}
            {assignees.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge
                  variant={assignedTo === null ? "default" : "outline"}
                  className="cursor-pointer text-[10px]"
                  onClick={() => setAssignedTo(null)}
                >
                  Todos ({items?.length ?? 0})
                </Badge>
                {assignees.map((a) => (
                  <Badge
                    key={a.assigned_to || "sem-responsavel"}
                    variant={assignedTo === a.assigned_to ? "default" : "outline"}
                    className="cursor-pointer text-[10px]"
                    onClick={() => setAssignedTo(a.assigned_to)}
                  >
                    {a.assigned_to ? a.assigned_to.slice(0, 8) : "Sem resp."} ({a.total})
                  </Badge>
                ))}
              </div>
            )}

            {/* Busca + filtros */}
            <div className="mt-3 flex flex-col gap-3">
              {/* Busca */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título, caso ou cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 pr-3 text-sm"
                />
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={kindFilter}
                  onValueChange={(v) => setKindFilter(v as KindFilter)}
                >
                  <SelectTrigger className="h-9 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-xs"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                  <SelectTrigger className="h-9 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-xs"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="ml-auto flex items-center gap-2">
                  <Switch
                    id="includeDone"
                    checked={includeDone}
                    onCheckedChange={setIncludeDone}
                  />
                  <Label
                    htmlFor="includeDone"
                    className="cursor-pointer text-xs text-muted-foreground"
                  >
                    Incluir concluídos
                  </Label>
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Lista ou Grid */}
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            {loading ? (
              <div className="flex flex-1 items-center justify-center py-6 text-sm text-muted-foreground">
                Carregando agenda...
              </div>
            ) : error ? (
              <div className="flex flex-1 items-center justify-center px-4 py-6 text-sm text-destructive">
                {error}
              </div>
            ) : viewMode === "MONTH" && bundleDays.length > 0 ? (
              /* MONTH VIEW - Grid 6x7 */
              <ScrollArea className="flex-1">
                <div className="p-3">
                  {/* Header weekdays */}
                  <div className="mb-2 grid grid-cols-7 gap-1">
                    {WEEKDAY_LABELS.map((label) => (
                      <div
                        key={label}
                        className="text-center text-[10px] font-medium text-muted-foreground"
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {(Array.isArray(bundleDays) ? bundleDays : []).map((rawDay) => {
                      // Normaliza: se for string, converte para objeto
                      const day = typeof rawDay === 'string' 
                        ? { date: rawDay, dow: 0, in_month: true, is_today: false }
                        : rawDay as AgendaDayInfo;
                      
                      const dayDate = day.date || (typeof rawDay === 'string' ? rawDay : '');
                      const dayItems = getItemsForDay(dayDate);
                      const allDayItems = dayItems.filter((i) => i.all_day);
                      const timedItems = dayItems.filter((i) => !i.all_day).sort((a, b) => 
                        (a.local_time || "").localeCompare(b.local_time || "")
                      );

                      return (
                        <div
                          key={dayDate}
                          className={cn(
                            "min-h-[70px] rounded-md border p-1 text-[10px]",
                            !day?.in_month && "opacity-40",
                            day?.is_today && "border-primary bg-primary/5"
                          )}
                        >
                          <div
                            className={cn(
                              "mb-1 text-center font-medium",
                              day?.is_today && "text-primary"
                            )}
                          >
                            {formatDayNumber(dayDate)}
                          </div>

                          {/* All-day items */}
                          {allDayItems.slice(0, 1).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectItem(item)}
                              className="mb-0.5 w-full truncate rounded bg-primary/10 px-1 py-0.5 text-left text-[9px] hover:bg-primary/20"
                            >
                              {item.title}
                            </button>
                          ))}

                          {/* Timed items */}
                          {timedItems.slice(0, 2).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectItem(item)}
                              className="mb-0.5 w-full truncate rounded bg-muted px-1 py-0.5 text-left text-[9px] hover:bg-muted/80"
                            >
                              <span className="text-muted-foreground">
                                {formatTime(item.local_time).slice(0, 5)}
                              </span>{" "}
                              {item.title}
                            </button>
                          ))}

                          {/* More indicator */}
                          {dayItems.length > 3 && (
                            <div className="text-center text-[9px] text-muted-foreground">
                              +{dayItems.length - 3} mais
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-4 py-6 text-sm text-muted-foreground">
                {items.length === 0
                  ? `Nenhum compromisso ${viewMode === "WEEK" ? "nesta semana" : "neste mês"}.`
                  : "Nenhum compromisso encontrado com os filtros atuais."}
              </div>
            ) : (
              /* WEEK VIEW - Lista */
              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {filteredItems.map((item) => {
                    const isSelected = selectedItem?.id === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className={`flex w-full items-start gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-accent/60 ${
                          isSelected ? "bg-accent" : ""
                        }`}
                      >
                        {/* Coluna data/hora */}
                        <div className="flex flex-col items-center justify-center pt-1">
                          <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide">
                            {formatDateLabel(item.local_date)}
                          </span>
                          <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTime(item.local_time)}
                          </span>
                        </div>

                        {/* Conteúdo */}
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-semibold">
                                {item.title}
                              </div>
                              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                {item.case_title || "Sem caso vinculado"}
                              </div>
                              <div className="truncate text-[11px] text-muted-foreground">
                                {item.client_name || "Sem cliente vinculado"}
                              </div>
                            </div>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {item.kind && (
                              <Badge
                                variant="outline"
                                className="border-dashed px-1.5 py-0 text-[10px]"
                              >
                                {item.kind}
                              </Badge>
                            )}
                            {getStatusBadge(item.status)}
                            {item.meeting_url && (
                              <Badge
                                className={cn(
                                  "px-1.5 py-0 text-[10px] gap-1",
                                  PROVIDER_LABELS[getMeetingProvider(item.meeting_url) || "OUTRO"].className
                                )}
                              >
                                <Video className="h-2.5 w-2.5" />
                                {PROVIDER_LABELS[getMeetingProvider(item.meeting_url) || "OUTRO"].label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Coluna direita - Detalhes */}
        <Card className={cn(
          "h-full flex-col overflow-hidden transition-all duration-300",
          selectedItem ? "flex" : "hidden lg:flex"
        )}>
          {selectedItem && officeId ? (
            <>
              <CardHeader className="border-b pb-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Back button for mobile Master-Detail */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 lg:hidden"
                        onClick={() => setSelectedItem(null)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div className="min-w-0">
                      <CardTitle className="text-base leading-tight">
                        {selectedItem.title}
                      </CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateLabel(selectedItem.local_date)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(selectedItem.local_time)}
                        </span>
                        {selectedItem.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {selectedItem.location}
                          </span>
                        )}
                        {selectedItem.meeting_url && (
                          <span className="inline-flex items-center gap-1">
                            <Video className="h-3 w-3" />
                            {PROVIDER_LABELS[getMeetingProvider(selectedItem.meeting_url) || "OUTRO"].label}
                          </span>
                        )}
                      </CardDescription>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(selectedItem.status)}
                      {selectedItem.kind && (
                        <Badge
                          variant="outline"
                          className="mt-1 px-2 py-0 text-[10px]"
                        >
                          {selectedItem.kind}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

              <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                <Tabs
                  value={activeTab}
                  onValueChange={(v) =>
                    setActiveTab(v as typeof activeTab)
                  }
                  className="flex h-full flex-col"
                >
                  <TabsList className="mx-4 mt-3 grid h-9 grid-cols-4 text-xs">
                    <TabsTrigger value="dados">Dados</TabsTrigger>
                    <TabsTrigger value="relacoes">Relações</TabsTrigger>
                    <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
                    <TabsTrigger value="notas">Notas</TabsTrigger>
                  </TabsList>

                  <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
                    {/* Aba: Dados */}
                    <TabsContent
                      value="dados"
                      className="h-full data-[state=active]:flex data-[state=active]:flex-col"
                    >
                      <div className="space-y-4 text-xs">
                        {/* Card de Audiência Virtual */}
                        {selectedItem.meeting_url && (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs">
                                <Video className="h-4 w-4 text-primary" />
                                <span className="font-medium">Audiência Virtual</span>
                                <Badge className={PROVIDER_LABELS[getMeetingProvider(selectedItem.meeting_url) || "OUTRO"].className}>
                                  {PROVIDER_LABELS[getMeetingProvider(selectedItem.meeting_url) || "OUTRO"].label}
                                </Badge>
                              </div>
                              <Button
                                size="sm"
                                className="gap-1.5"
                                onClick={() => window.open(selectedItem.meeting_url!, "_blank", "noopener,noreferrer")}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Entrar na audiência
                              </Button>
                            </div>
                          </div>
                        )}
                        <div>
                          <h3 className="mb-1 text-[11px] font-semibold text-muted-foreground">
                            Informações principais
                          </h3>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-0.5">
                              <div className="text-[11px] text-muted-foreground">
                                Título
                              </div>
                              <div className="rounded-md bg-muted px-2 py-1 text-xs">
                                {selectedItem.title}
                              </div>
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[11px] text-muted-foreground">
                                Tipo
                              </div>
                              <div className="rounded-md bg-muted px-2 py-1 text-xs">
                                {selectedItem.kind || "Não informado"}
                              </div>
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[11px] text-muted-foreground">
                                Data
                              </div>
                              <div className="rounded-md bg-muted px-2 py-1 text-xs">
                                {formatDateLabel(selectedItem.local_date)}
                              </div>
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[11px] text-muted-foreground">
                                Horário
                              </div>
                              <div className="rounded-md bg-muted px-2 py-1 text-xs">
                                {formatTime(selectedItem.local_time)}
                              </div>
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[11px] text-muted-foreground">
                                Local
                              </div>
                              <div className="rounded-md bg-muted px-2 py-1 text-xs">
                                {selectedItem.location || "Não informado"}
                              </div>
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[11px] text-muted-foreground">
                                Status
                              </div>
                              <div className="rounded-md bg-muted px-2 py-1 text-xs">
                                {selectedItem.status || "Não definido"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 border-t pt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={handleMarkDone}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Marcar como concluído
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Aba: Relações */}
                    <TabsContent
                      value="relacoes"
                      className="h-full data-[state=active]:flex data-[state=active]:flex-col"
                    >
                      <div className="space-y-4 text-xs">
                        <div>
                          <h3 className="mb-1 text-[11px] font-semibold text-muted-foreground">
                            Caso vinculado
                          </h3>
                          <div className="rounded-md bg-muted px-2 py-2 text-xs">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">
                                {selectedItem.case_title || "Sem caso vinculado"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="mb-1 text-[11px] font-semibold text-muted-foreground">
                            Cliente vinculado
                          </h3>
                          <div className="rounded-md bg-muted px-2 py-2 text-xs">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">
                                {selectedItem.client_name || "Sem cliente vinculado"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Aba: Arquivos */}
                    <TabsContent
                      value="arquivos"
                      className="h-full data-[state=active]:flex data-[state=active]:flex-col"
                    >
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-6 w-6" />
                        <p>Nenhum arquivo vinculado diretamente pela agenda.</p>
                        <p className="text-[11px]">
                          Use o módulo de documentos do caso para gerenciar
                          arquivos.
                        </p>
                      </div>
                    </TabsContent>

                    {/* Aba: Notas */}
                    <TabsContent
                      value="notas"
                      className="h-full data-[state=active]:flex data-[state=active]:flex-col"
                    >
                      <div className="space-y-3 text-xs">
                        <h3 className="text-[11px] font-semibold text-muted-foreground">
                          Observações
                        </h3>
                        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                          {selectedItem.notes && selectedItem.notes.trim() ? (
                            <p className="whitespace-pre-wrap">
                              {selectedItem.notes}
                            </p>
                          ) : (
                            <p className="text-muted-foreground">
                              Nenhuma observação registrada para este
                              compromisso.
                            </p>
                          )}
                        </div>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <div className="mb-1 rounded-full bg-muted p-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold">
                Selecione um compromisso
              </h3>
              <p className="text-xs text-muted-foreground">
                Escolha um item da agenda na lista ao lado para visualizar os
                detalhes completos.
              </p>
            </div>
          )}
        </Card>

        {/* Versão mobile do painel de detalhes */}
        {selectedItem && officeId && (
          <Card className="flex h-full flex-col lg:hidden">
            <CardHeader className="border-b pb-3">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                <ChevronLeft className="h-3 w-3" />
                Voltar
              </button>

              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base leading-tight">
                      {selectedItem.title}
                    </CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateLabel(selectedItem.local_date)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(selectedItem.local_time)}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(selectedItem.status)}
                    {selectedItem.kind && (
                      <Badge
                        variant="outline"
                        className="mt-1 px-2 py-0 text-[10px]"
                      >
                        {selectedItem.kind}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <Tabs
                value={activeTab}
                onValueChange={(v) =>
                  setActiveTab(v as typeof activeTab)
                }
                className="flex h-full flex-col"
              >
                <TabsList className="mx-4 mt-3 grid h-9 grid-cols-4 text-xs">
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="relacoes">Relações</TabsTrigger>
                  <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
                  <TabsTrigger value="notas">Notas</TabsTrigger>
                </TabsList>

                <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
                  {/* Conteúdo mobile igual ao desktop */}
                  <TabsContent
                    value="dados"
                    className="h-full data-[state=active]:flex data-[state=active]:flex-col"
                  >
                    <div className="space-y-4 text-xs">
                      {/* Card de Audiência Virtual - Mobile */}
                      {selectedItem.meeting_url && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-xs">
                              <Video className="h-4 w-4 text-primary" />
                              <span className="font-medium">Audiência Virtual</span>
                              <Badge className={PROVIDER_LABELS[getMeetingProvider(selectedItem.meeting_url) || "OUTRO"].className}>
                                {PROVIDER_LABELS[getMeetingProvider(selectedItem.meeting_url) || "OUTRO"].label}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              className="gap-1.5 w-full"
                              onClick={() => window.open(selectedItem.meeting_url!, "_blank", "noopener,noreferrer")}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Entrar na audiência
                            </Button>
                          </div>
                        </div>
                      )}
                      <div>
                        <h3 className="mb-1 text-[11px] font-semibold text-muted-foreground">
                          Informações principais
                        </h3>
                        <div className="grid gap-2 grid-cols-2">
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-muted-foreground">
                              Título
                            </div>
                            <div className="rounded-md bg-muted px-2 py-1 text-xs">
                              {selectedItem.title}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-muted-foreground">
                              Tipo
                            </div>
                            <div className="rounded-md bg-muted px-2 py-1 text-xs">
                              {selectedItem.kind || "Não informado"}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-muted-foreground">
                              Data
                            </div>
                            <div className="rounded-md bg-muted px-2 py-1 text-xs">
                              {formatDateLabel(selectedItem.local_date)}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-muted-foreground">
                              Horário
                            </div>
                            <div className="rounded-md bg-muted px-2 py-1 text-xs">
                              {formatTime(selectedItem.local_time)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={handleMarkDone}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Marcar como concluído
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="relacoes"
                    className="h-full data-[state=active]:flex data-[state=active]:flex-col"
                  >
                    <div className="space-y-4 text-xs">
                      <div>
                        <h3 className="mb-1 text-[11px] font-semibold text-muted-foreground">
                          Caso vinculado
                        </h3>
                        <div className="rounded-md bg-muted px-2 py-2 text-xs">
                          {selectedItem.case_title || "Sem caso vinculado"}
                        </div>
                      </div>
                      <div>
                        <h3 className="mb-1 text-[11px] font-semibold text-muted-foreground">
                          Cliente vinculado
                        </h3>
                        <div className="rounded-md bg-muted px-2 py-2 text-xs">
                          {selectedItem.client_name || "Sem cliente vinculado"}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="arquivos"
                    className="h-full data-[state=active]:flex data-[state=active]:flex-col"
                  >
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-6 w-6" />
                      <p>Nenhum arquivo vinculado.</p>
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="notas"
                    className="h-full data-[state=active]:flex data-[state=active]:flex-col"
                  >
                    <div className="space-y-3 text-xs">
                      <h3 className="text-[11px] font-semibold text-muted-foreground">
                        Observações
                      </h3>
                      <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                        {selectedItem.notes && selectedItem.notes.trim() ? (
                          <p className="whitespace-pre-wrap">
                            {selectedItem.notes}
                          </p>
                        ) : (
                          <p className="text-muted-foreground">
                            Nenhuma observação registrada.
                          </p>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
