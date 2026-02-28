import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Briefcase, ArrowRight } from 'lucide-react';

const CHART_COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(262, 83%, 58%)',
  'hsl(220, 9%, 46%)',
];

interface KPIData {
  clients: number;
  cases: number;
  documents: number;
  upcomingDeadlines: number;
  myCases: number;
  todayAppointments: number;
  criticalAlerts: number;
}

interface CaseStatusCount {
  status: string;
  count: number;
  percentage: number;
}

interface CasesQuickViewCardProps {
  kpis: KPIData | null;
  casesByStatus: CaseStatusCount[];
  loadingCases: boolean;
  getStatusLabel: (status: string) => string;
}

export function CasesQuickViewCard({ kpis, casesByStatus, loadingCases, getStatusLabel }: CasesQuickViewCardProps) {
  return (
    <Card className="bento-card relative overflow-hidden group">
      {/* Subtle Background Decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl mix-blend-screen pointer-events-none group-hover:bg-primary/10 transition-colors duration-700" />

      <CardHeader className="pb-4 border-b border-border/40 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner border border-primary/20">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight">Casos</CardTitle>
              <CardDescription className="text-xs font-medium uppercase tracking-wider mt-0.5">Visão Rápida</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="btn-tactile hover:bg-white/5 border border-transparent hover:border-white/10">
            <Link to="/cases">
              <span className="font-semibold tracking-wide">Ver todos</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-4 space-y-6 relative z-10">
        {/* Métricas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl glass-panel text-center transform transition-transform duration-300 hover:scale-[1.02] border-white/5">
            <span className="block text-3xl font-extrabold text-foreground tracking-tight drop-shadow-sm mb-1">{kpis?.cases ?? 0}</span>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total de Casos</p>
          </div>
          <div className="p-4 rounded-xl glass-panel bg-primary/5 text-center transform transition-transform duration-300 hover:scale-[1.02] border-primary/20">
            <span className="block text-3xl font-extrabold text-primary tracking-tight drop-shadow-sm mb-1">{kpis?.myCases ?? 0}</span>
            <p className="text-xs font-bold uppercase tracking-widest text-primary/80">Meus Casos</p>
          </div>
        </div>

        {/* Top 3 Status */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Distribuição (Top 3)</h4>
          {loadingCases ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : casesByStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center glass-panel rounded-xl">Nenhum caso cadastrado</p>
          ) : (
            <div className="space-y-3.5">
              {casesByStatus.slice(0, 3).map((item, index) => (
                <div key={item.status} className="flex flex-col gap-2 group/status">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 max-w-[60%]">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm transition-transform duration-300 group-hover/status:scale-125"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="text-sm font-semibold text-foreground/90 group-hover/status:text-foreground transition-colors truncate">
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-foreground bg-background/50 px-2 py-0.5 rounded-md border border-white/5">{item.count}</span>
                  </div>
                  <Progress
                    value={item.percentage}
                    className="h-1.5 w-full bg-secondary/50 group-hover/status:bg-secondary/70 transition-colors"
                    indicatorClassName="transition-all duration-1000 ease-out"
                    style={{ '--progress-background': CHART_COLORS[index % CHART_COLORS.length] } as React.CSSProperties}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

