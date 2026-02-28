import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfDay, isToday, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { checkOnboardingRequired } from '@/hooks/useOnboardingGuard';
import { useAuth } from '@/contexts/AuthContext';
import { useOfficeRole } from '@/hooks/useOfficeRole';
import { hasRole } from '@/lib/rbac/roles';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Icons for helpers
import { AlertTriangle, AlertCircle, Clock, Calendar } from 'lucide-react';

// Dashboard widgets
import {
  DashboardHeader,
  KpiGrid,
  SmartAlertsCard,
  PrioritiesCard,
  CasesQuickViewCard,
  CasesTrendChart,
  NijaProductivityCard,
  QuickLinksBar,
} from '@/components/dashboard';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface KPIData {
  clients: number;
  cases: number;
  documents: number;
  upcomingDeadlines: number;
  myCases: number;
  todayAppointments: number;
  criticalAlerts: number;
  highRiskCases: number;
}

interface Deadline {
  id: string;
  title: string;
  due_date: string;
  status: string;
  case_title?: string;
  case_id?: string;
}

interface AgendaItem {
  id: string;
  title: string;
  date: string;
  time: string | null;
  case_id?: string | null;
}

interface CaseStatusCount {
  status: string;
  count: number;
  percentage: number;
}

interface SmartAlert {
  id: string;
  type: 'deadline_overdue' | 'deadline_today' | 'deadline_soon' | 'appointment_today' | 'nija_high_risk' | 'nija_prescription_risk';
  severity: 'alta' | 'media';
  title: string;
  subtitle?: string;
  date: string;
  link: string;
}

interface HighRiskCase {
  id: string;
  title: string;
  risco: string | null;
  risco_prescricao: string | null;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Colors & Labels
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ATIVO: { label: 'Ativo', color: 'hsl(142, 76%, 36%)' },
  EM_ANDAMENTO: { label: 'Em andamento', color: 'hsl(221, 83%, 53%)' },
  AGUARDANDO: { label: 'Aguardando', color: 'hsl(38, 92%, 50%)' },
  SUSPENSO: { label: 'Suspenso', color: 'hsl(0, 84%, 60%)' },
  ENCERRADO: { label: 'Encerrado', color: 'hsl(220, 9%, 46%)' },
  ARQUIVADO: { label: 'Arquivado', color: 'hsl(220, 14%, 70%)' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Component
// ─────────────────────────────────────────────────────────────────────────────

export function LegalDashboard() {
  const { user } = useAuth();
  const { role } = useOfficeRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isAdmin = hasRole(role, 'ADMIN');

  // Data states
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [casesByStatus, setCasesByStatus] = useState<CaseStatusCount[]>([]);
  const [aiLogsCount, setAiLogsCount] = useState<number>(0);
  const [highRiskCases, setHighRiskCases] = useState<HighRiskCase[]>([]);

  // Loading states
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingDeadlines, setLoadingDeadlines] = useState(true);
  const [loadingAgenda, setLoadingAgenda] = useState(true);
  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingAiLogs, setLoadingAiLogs] = useState(true);
  const [loadingHighRisk, setLoadingHighRisk] = useState(true);

  // Check onboarding on mount
  useEffect(() => {
    async function checkOnboarding() {
      const needsOnboarding = await checkOnboardingRequired();
      if (needsOnboarding) {
        navigate('/onboarding');
      }
    }
    if (user?.id) {
      checkOnboarding();
    }
  }, [user?.id, navigate]);

  // Fetch office membership
  useEffect(() => {
    async function fetchOffice() {
      if (!user?.id) return;

      const { data, error } = await supabase.rpc('get_my_active_office');
      if (error) {
        console.error('Error fetching active office:', error);
        return;
      }

      const membership = Array.isArray(data) ? data[0] : data;
      if (membership?.office_id) {
        setOfficeId(membership.office_id);
      }
    }

    fetchOffice();
  }, [user?.id]);

  // Fetch KPIs
  useEffect(() => {
    async function fetchKPIs() {
      if (!officeId || !user?.id) return;
      setLoadingKpis(true);

      try {
        const today = startOfDay(new Date()).toISOString();
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        const [clientsRes, casesRes, myCasesRes, docsRes, deadlinesRes, overdueRes, todayAgendaRes, highRiskRes] = await Promise.all([
          supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('office_id', officeId)
            .is('deleted_at', null),
          supabase
            .from('cases')
            .select('id', { count: 'exact', head: true })
            .eq('office_id', officeId)
            .is('deleted_at', null),
          supabase
            .from('cases')
            .select('id', { count: 'exact', head: true })
            .eq('office_id', officeId)
            .eq('created_by', user.id)
            .is('deleted_at', null),
          supabase
            .from('generated_docs_legacy')
            .select('id', { count: 'exact', head: true })
            .eq('office_id', officeId)
            .is('deleted_at', null),
          supabase
            .from('case_deadlines')
            .select('id', { count: 'exact', head: true })
            .eq('office_id', officeId)
            .gte('due_date', today)
            .neq('status', 'done'),
          supabase
            .from('case_deadlines')
            .select('id', { count: 'exact', head: true })
            .eq('office_id', officeId)
            .lte('due_date', todayStr)
            .neq('status', 'done'),
          supabase
            .from('agenda_items')
            .select('id', { count: 'exact', head: true })
            .eq('office_id', officeId)
            .eq('date', todayStr)
            .neq('status', 'cancelado'),
          supabase
            .from('cases')
            .select('id', { count: 'exact', head: true })
            .eq('office_id', officeId)
            .is('deleted_at', null)
            .not('nija_full_analysis', 'is', null)
            .or("nija_full_analysis->meta->>grauRiscoGlobal.eq.ALTO,nija_full_analysis->prescricao->>risco.eq.ALTO"),
        ]);

        setKpis({
          clients: clientsRes.count ?? 0,
          cases: casesRes.count ?? 0,
          myCases: myCasesRes.count ?? 0,
          documents: docsRes.count ?? 0,
          upcomingDeadlines: deadlinesRes.count ?? 0,
          criticalAlerts: overdueRes.count ?? 0,
          todayAppointments: todayAgendaRes.count ?? 0,
          highRiskCases: highRiskRes.count ?? 0,
        });
      } catch (error) {
        console.error('Error fetching KPIs:', error);
      } finally {
        setLoadingKpis(false);
      }
    }
    fetchKPIs();
  }, [officeId, user?.id]);

  // Fetch deadlines
  useEffect(() => {
    async function fetchDeadlines() {
      if (!officeId) return;
      setLoadingDeadlines(true);

      try {
        const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

        const { data, error } = await supabase
          .from('case_deadlines')
          .select('id, title, due_date, status, case_id, cases(title)')
          .eq('office_id', officeId)
          .gte('due_date', sevenDaysAgo)
          .neq('status', 'done')
          .order('due_date', { ascending: true })
          .limit(15);

        if (error) throw error;

        const formatted: Deadline[] = (data ?? []).map((d: any) => ({
          id: d.id,
          title: d.title,
          due_date: d.due_date,
          status: d.status,
          case_id: d.case_id,
          case_title: d.cases?.title,
        }));

        setDeadlines(formatted);
      } catch (error) {
        console.error('Error fetching deadlines:', error);
      } finally {
        setLoadingDeadlines(false);
      }
    }
    fetchDeadlines();
  }, [officeId]);

  // Fetch agenda items
  useEffect(() => {
    async function fetchAgenda() {
      if (!officeId) return;
      setLoadingAgenda(true);

      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const sevenDaysFromNow = format(addDays(new Date(), 7), 'yyyy-MM-dd');

        const { data, error } = await supabase
          .from('agenda_items')
          .select('id, title, date, time, case_id')
          .eq('office_id', officeId)
          .gte('date', today)
          .lte('date', sevenDaysFromNow)
          .neq('status', 'cancelado')
          .order('date', { ascending: true })
          .order('time', { ascending: true })
          .limit(10);

        if (error) throw error;

        setAgendaItems(data ?? []);
      } catch (error) {
        console.error('Error fetching agenda:', error);
      } finally {
        setLoadingAgenda(false);
      }
    }
    fetchAgenda();
  }, [officeId]);

  // Fetch cases by status
  useEffect(() => {
    async function fetchCasesByStatus() {
      if (!officeId) return;
      setLoadingCases(true);

      try {
        const { data, error } = await supabase
          .from('cases')
          .select('id, status')
          .eq('office_id', officeId)
          .is('deleted_at', null);

        if (error) throw error;

        const statusMap: Record<string, number> = {};
        (data ?? []).forEach((c: any) => {
          statusMap[c.status] = (statusMap[c.status] || 0) + 1;
        });

        const total = data?.length ?? 0;
        const result: CaseStatusCount[] = Object.entries(statusMap).map(([status, count]) => ({
          status,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        }));

        result.sort((a, b) => b.count - a.count);
        setCasesByStatus(result);
      } catch (error) {
        console.error('Error fetching cases by status:', error);
      } finally {
        setLoadingCases(false);
      }
    }
    fetchCasesByStatus();
  }, [officeId]);

  // Fetch AI logs count
  useEffect(() => {
    async function fetchAiLogs() {
      if (!officeId) return;
      setLoadingAiLogs(true);

      try {
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

        const { count, error } = await supabase
          .from('chat_ai_logs')
          .select('id', { count: 'exact', head: true })
          .eq('office_id', officeId)
          .gte('created_at', thirtyDaysAgo);

        if (error) throw error;
        setAiLogsCount(count ?? 0);
      } catch (error) {
        console.error('Error fetching AI logs:', error);
        setAiLogsCount(0);
      } finally {
        setLoadingAiLogs(false);
      }
    }
    fetchAiLogs();
  }, [officeId]);

  // Fetch high-risk cases for alerts
  useEffect(() => {
    async function fetchHighRiskCases() {
      if (!officeId) return;
      setLoadingHighRisk(true);

      try {
        const { data, error } = await supabase
          .from('cases')
          .select('id, title, nija_full_analysis, updated_at')
          .eq('office_id', officeId)
          .is('deleted_at', null)
          .not('nija_full_analysis', 'is', null)
          .or("nija_full_analysis->meta->>grauRiscoGlobal.eq.ALTO,nija_full_analysis->prescricao->>risco.eq.ALTO")
          .order('updated_at', { ascending: false })
          .limit(5);

        if (error) throw error;

        const mapped: HighRiskCase[] = (data ?? []).map((c: any) => ({
          id: c.id,
          title: c.title,
          risco: c.nija_full_analysis?.meta?.grauRiscoGlobal ?? null,
          risco_prescricao: c.nija_full_analysis?.prescricao?.risco ?? null,
          updated_at: c.updated_at,
        }));

        setHighRiskCases(mapped);
      } catch (error) {
        console.error('Error fetching high-risk cases:', error);
      } finally {
        setLoadingHighRisk(false);
      }
    }
    fetchHighRiskCases();
  }, [officeId]);

  // Realtime subscription for new clients
  useEffect(() => {
    if (!officeId) return;

    const channel = supabase
      .channel('dashboard-clients-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'clients',
          filter: `office_id=eq.${officeId}`
        },
        (payload) => {
          // Increment clients KPI
          setKpis(prev => prev ? { ...prev, clients: prev.clients + 1 } : null);

          const newClient = payload.new as { full_name?: string };
          toast({
            title: 'Novo cliente!',
            description: `${newClient.full_name || 'Cliente'} foi cadastrado via captação online.`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [officeId, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Smart Alerts
  // ─────────────────────────────────────────────────────────────────────────────

  const smartAlerts = useMemo<SmartAlert[]>(() => {
    const alerts: SmartAlert[] = [];
    const now = new Date();
    const today = startOfDay(now);
    const threeDaysFromNow = addDays(today, 3);

    // Process deadlines
    deadlines.forEach((d) => {
      const dueDate = new Date(d.due_date);

      if (isBefore(dueDate, today)) {
        alerts.push({
          id: `deadline-overdue-${d.id}`,
          type: 'deadline_overdue',
          severity: 'alta',
          title: d.title,
          subtitle: d.case_title,
          date: d.due_date,
          link: d.case_id ? `/cases?caseId=${d.case_id}` : '/alerts',
        });
      } else if (isToday(dueDate)) {
        alerts.push({
          id: `deadline-today-${d.id}`,
          type: 'deadline_today',
          severity: 'alta',
          title: d.title,
          subtitle: d.case_title,
          date: d.due_date,
          link: d.case_id ? `/cases?caseId=${d.case_id}` : '/alerts',
        });
      } else if (isBefore(dueDate, threeDaysFromNow)) {
        alerts.push({
          id: `deadline-soon-${d.id}`,
          type: 'deadline_soon',
          severity: 'media',
          title: d.title,
          subtitle: d.case_title,
          date: d.due_date,
          link: d.case_id ? `/cases?caseId=${d.case_id}` : '/alerts',
        });
      }
    });

    // Process agenda items for today
    agendaItems.forEach((a) => {
      if (isToday(new Date(a.date))) {
        alerts.push({
          id: `agenda-today-${a.id}`,
          type: 'appointment_today',
          severity: 'media',
          title: a.title,
          subtitle: a.time ? `às ${a.time}` : undefined,
          date: a.date,
          link: '/agenda',
        });
      }
    });

    // Process high-risk cases from NIJA
    highRiskCases.forEach((c) => {
      if (c.risco === 'ALTO') {
        alerts.push({
          id: `nija-risk-${c.id}`,
          type: 'nija_high_risk',
          severity: 'alta',
          title: c.title,
          subtitle: 'Risco global alto identificado',
          date: c.updated_at,
          link: `/cases?caseId=${c.id}`,
        });
      }
      if (c.risco_prescricao === 'ALTO') {
        alerts.push({
          id: `nija-prescricao-${c.id}`,
          type: 'nija_prescription_risk',
          severity: 'alta',
          title: c.title,
          subtitle: 'Risco de prescrição alto',
          date: c.updated_at,
          link: `/cases?caseId=${c.id}`,
        });
      }
    });

    // Sort by severity (alta first) then by date
    alerts.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'alta' ? -1 : 1;
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return alerts.slice(0, 5);
  }, [deadlines, agendaItems, highRiskCases]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const getStatusLabel = (status: string) => {
    return STATUS_CONFIG[status]?.label || status;
  };

  const getAlertIcon = (type: SmartAlert['type']) => {
    switch (type) {
      case 'deadline_overdue':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'deadline_today':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'deadline_soon':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'appointment_today':
        return <Calendar className="h-4 w-4 text-emerald-500" />;
      case 'nija_high_risk':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'nija_prescription_risk':
        return <Clock className="h-4 w-4 text-destructive" />;
    }
  };

  const getAlertLabel = (type: SmartAlert['type']) => {
    switch (type) {
      case 'deadline_overdue':
        return 'Prazo vencido';
      case 'deadline_today':
        return 'Vence hoje';
      case 'deadline_soon':
        return 'Vence em breve';
      case 'appointment_today':
        return 'Compromisso hoje';
      case 'nija_high_risk':
        return 'Risco Alto';
      case 'nija_prescription_risk':
        return 'Prescrição';
    }
  };

  const formatDeadlineDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Vencido';
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    if (diffDays <= 7) return `Em ${diffDays} dias`;
    return format(date, "dd 'de' MMM", { locale: ptBR });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 dashboard-fade-in max-w-[1600px] mx-auto min-h-screen bg-background text-foreground selection:bg-primary/30">

      {/* 1. Dashboard Header (Hero Typography) */}
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both" style={{ animationDelay: '50ms' }}>
        <DashboardHeader />
      </section>

      {/* 2. KPI Grid (Tactile Maximalism) */}
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both" style={{ animationDelay: '150ms' }}>
        <KpiGrid kpis={kpis} loading={loadingKpis} />
      </section>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-12">
        {/* Main Column - Left (Bento Grid) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both" style={{ animationDelay: '250ms' }}>
            <SmartAlertsCard
              alerts={smartAlerts}
              loading={loadingDeadlines || loadingAgenda || loadingHighRisk}
              getAlertIcon={getAlertIcon}
              getAlertLabel={getAlertLabel}
            />
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both h-full" style={{ animationDelay: '350ms' }}>
              <PrioritiesCard
                deadlines={deadlines}
                agendaItems={agendaItems}
                loadingDeadlines={loadingDeadlines}
                loadingAgenda={loadingAgenda}
                formatDeadlineDate={formatDeadlineDate}
              />
            </section>

            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both h-full" style={{ animationDelay: '450ms' }}>
              <CasesQuickViewCard
                kpis={kpis}
                casesByStatus={casesByStatus}
                loadingCases={loadingCases}
                getStatusLabel={getStatusLabel}
              />
            </section>
          </div>
        </div>

        {/* Sidebar Column - Right (Bento Grid) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both flex-1" style={{ animationDelay: '550ms' }}>
            <NijaProductivityCard
              aiLogsCount={aiLogsCount}
              loading={loadingAiLogs}
              isAdmin={isAdmin}
            />
          </section>

          <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both" style={{ animationDelay: '650ms' }}>
            <CasesTrendChart
              casesByStatus={casesByStatus}
              loading={loadingCases}
              getStatusLabel={getStatusLabel}
            />
          </section>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both pt-4" style={{ animationDelay: '750ms' }}>
        <QuickLinksBar isAdmin={isAdmin} />
      </section>
    </div>
  );
}

export default LegalDashboard;
