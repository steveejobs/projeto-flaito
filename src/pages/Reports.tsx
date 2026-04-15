import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Calendar, DollarSign, AlertTriangle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CaseKpis {
  total_cases: number;
  archived_cases: number;
}

interface DeadlineKpis {
  open_deadlines: number;
  overdue_deadlines: number;
}

interface FinanceKpis {
  total_expenses: number;
  paid_expenses: number;
  unpaid_expenses: number;
}

export default function Reports() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [caseKpis, setCaseKpis] = useState<CaseKpis | null>(null);
  const [deadlineKpis, setDeadlineKpis] = useState<DeadlineKpis | null>(null);
  const [financeKpis, setFinanceKpis] = useState<FinanceKpis | null>(null);

  const fetchKpis = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: memberData } = await (supabase
        .from('office_members' as any) as any)
        .select('office_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!memberData) {
        if (import.meta.env.DEV) console.log('[Reports] No office member record yet. Hooks might still be provisioning.');
        setLoading(false);
        return;
      }

      const officeId = memberData.office_id;

      // Fetch KPIs from views
      const [caseResult, deadlineResult, financeResult] = await Promise.all([
        (supabase
          .from('v_case_kpis' as any) as any)
          .select('*')
          .eq('office_id', officeId)
          .single(),
        (supabase
          .from('v_deadline_kpis' as any) as any)
          .select('*')
          .eq('office_id', officeId)
          .single(),
        (supabase
          .from('v_finance_kpis' as any) as any)
          .select('*')
          .eq('office_id', officeId)
          .single(),
      ]);

      if (caseResult.data) {
        setCaseKpis({
          total_cases: Number(caseResult.data.total_cases) || 0,
          archived_cases: Number(caseResult.data.archived_cases) || 0,
        });
      }

      if (deadlineResult.data) {
        setDeadlineKpis({
          open_deadlines: Number(deadlineResult.data.open_deadlines) || 0,
          overdue_deadlines: Number(deadlineResult.data.overdue_deadlines) || 0,
        });
      }

      if (financeResult.data) {
        setFinanceKpis({
          total_expenses: Number(financeResult.data.total_expenses) || 0,
          paid_expenses: Number(financeResult.data.paid_expenses) || 0,
          unpaid_expenses: Number(financeResult.data.unpaid_expenses) || 0,
        });
      }
    } catch (err: any) {
      console.error('Error fetching KPIs:', err);
      // Don't show error toast if views don't exist yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Relatórios e KPIs</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Case KPIs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Briefcase className="h-5 w-5" />
                  Casos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total de Casos</span>
                  <span className="text-2xl font-bold">{caseKpis?.total_cases || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Casos Ativos</span>
                  <span className="text-xl font-semibold text-green-600">
                    {(caseKpis?.total_cases || 0) - (caseKpis?.archived_cases || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Arquivados</span>
                  <span className="text-xl font-semibold text-muted-foreground">
                    {caseKpis?.archived_cases || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Deadline KPIs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5" />
                  Prazos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-muted-foreground">Em Aberto</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">
                    {deadlineKpis?.open_deadlines || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-muted-foreground">Vencidos</span>
                  </div>
                  <span className="text-2xl font-bold text-destructive">
                    {deadlineKpis?.overdue_deadlines || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Finance KPIs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="h-5 w-5" />
                  Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Despesas</span>
                  <span className="text-xl font-bold">
                    {formatCurrency(financeKpis?.total_expenses || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">Pago</span>
                  </div>
                  <span className="text-lg font-semibold text-green-600">
                    {formatCurrency(financeKpis?.paid_expenses || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span className="text-muted-foreground">Pendente</span>
                  </div>
                  <span className="text-lg font-semibold text-amber-600">
                    {formatCurrency(financeKpis?.unpaid_expenses || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  );
}
