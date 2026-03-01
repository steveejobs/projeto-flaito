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
      {/* Decorative effect removed to reduce blur */}

      <CardHeader className="pb-3 border-b border-border/40 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shadow-inner border border-primary/20">
              <Briefcase className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-bold tracking-tight">Casos</CardTitle>
              <CardDescription className="text-[9px] font-semibold uppercase tracking-widest mt-0.5 text-muted-foreground/60">Visão Rápida</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-[10px] h-7 px-2 hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors">
            <Link to="/cases">
              <span className="font-semibold tracking-wide">Ver todos</span>
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-3 space-y-4 relative z-10">
        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 rounded-lg glass-panel text-center transform transition-transform duration-300 hover:scale-[1.02] border-white/5">
            <span className="block text-xl font-bold text-foreground tracking-tight drop-shadow-sm mb-0.5">{kpis?.cases ?? 0}</span>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">Total de Casos</p>
          </div>
          <div className="p-2 rounded-lg glass-panel bg-primary/5 text-center transform transition-transform duration-300 hover:scale-[1.02] border-primary/20">
            <span className="block text-xl font-bold text-primary tracking-tight drop-shadow-sm mb-0.5">{kpis?.myCases ?? 0}</span>
            <p className="text-[9px] font-bold uppercase tracking-widest text-primary/80">Meus Casos</p>
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
            <div className="space-y-3">
              {casesByStatus.slice(0, 3).map((item, index) => (
                <div key={item.status} className="flex flex-col gap-1.5 group/status">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 max-w-[60%]">
                      <div
                        className="h-2 w-2 rounded-full shrink-0 shadow-sm transition-transform duration-300 group-hover/status:scale-125"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="text-xs font-semibold text-foreground/90 group-hover/status:text-foreground transition-colors truncate">
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-foreground bg-background/50 px-1.5 py-0.5 rounded-md border border-white/5">{item.count}</span>
                  </div>
                  <Progress
                    value={item.percentage}
                    className="h-1 w-full bg-secondary/50 group-hover/status:bg-secondary/70 transition-colors"
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

