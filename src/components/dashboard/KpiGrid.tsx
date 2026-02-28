import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Bell, Calendar, CreditCard, Briefcase, ShieldAlert } from 'lucide-react';

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

interface KpiGridProps {
  kpis: KPIData | null;
  loading: boolean;
}

export function KpiGrid({ kpis, loading }: KpiGridProps) {
  const hasHighRisk = (kpis?.highRiskCases ?? 0) > 0;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
      {/* Alertas Críticos */}
      <Link to="/alerts" className="block transform transition-transform duration-300 hover:scale-[1.02]">
        <Card className="bento-card cursor-pointer h-full group">
          <CardContent className="p-5 flex flex-col h-full justify-between">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors duration-300 ${(kpis?.criticalAlerts ?? 0) > 0 ? 'bg-destructive/15 group-hover:bg-destructive/25' : 'bg-muted/50 group-hover:bg-muted'}`}>
                  <Bell className={`h-6 w-6 ${(kpis?.criticalAlerts ?? 0) > 0 ? 'text-destructive group-hover:animate-pulse' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-4xl font-extrabold text-foreground tracking-tight drop-shadow-sm">
                      {kpis?.criticalAlerts ?? 0}
                    </span>
                    {(kpis?.criticalAlerts ?? 0) > 0 && (
                      <Badge variant="destructive" className="animate-pulse shadow-sm shadow-destructive/20 border-white/10 uppercase tracking-widest text-[10px] font-bold">Urgente</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Alertas Críticos</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Compromissos Hoje */}
      <Link to="/agenda">
        <Card className="bento-card cursor-pointer h-full">
          <CardContent className="p-5">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="text-3xl font-bold text-foreground">
                  {kpis?.todayAppointments ?? 0}
                </span>
                <p className="text-sm text-muted-foreground font-medium">Compromissos Hoje</p>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Pagamentos Pendentes */}
      <Link to="/agenda/payments">
        <Card className="bento-card cursor-pointer h-full">
          <CardContent className="p-5">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-3xl font-bold text-foreground">—</span>
                <p className="text-sm text-muted-foreground font-medium">Pagamentos Pendentes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Casos em Risco */}
      <Link to="/cases?risk=alto" className="block transform transition-transform duration-300 hover:scale-[1.02]">
        <Card className={`bento-card cursor-pointer h-full group ${hasHighRisk ? 'ring-1 ring-destructive/40 bg-gradient-to-br from-destructive/5 to-transparent' : ''}`}>
          <CardContent className="p-5 flex flex-col h-full justify-between">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors duration-300 ${hasHighRisk ? 'bg-destructive/15 group-hover:bg-destructive/25' : 'bg-muted/50 group-hover:bg-muted'}`}>
                  <ShieldAlert className={`h-6 w-6 ${hasHighRisk ? 'text-destructive group-hover:animate-pulse' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-4xl font-extrabold tracking-tight drop-shadow-sm ${hasHighRisk ? 'text-destructive' : 'text-foreground'}`}>
                      {kpis?.highRiskCases ?? 0}
                    </span>
                    {hasHighRisk && (
                      <Badge variant="destructive" className="shadow-sm shadow-destructive/20 border-white/10 text-[10px] uppercase font-bold tracking-widest">Nija AI</Badge>
                    )}
                  </div>
                  <p className={`text-sm font-medium uppercase tracking-wider ${hasHighRisk ? 'text-destructive/80' : 'text-muted-foreground'}`}>Casos em Risco</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Meus Casos */}
      <Link to="/cases?scope=mine" className="block transform transition-transform duration-300 hover:scale-[1.02]">
        <Card className="bento-card cursor-pointer h-full group">
          <CardContent className="p-5 flex flex-col h-full justify-between">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-xl bg-primary/15 group-hover:bg-primary/25 flex items-center justify-center transition-colors duration-300">
                  <Briefcase className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <span className="block text-4xl font-extrabold text-foreground tracking-tight drop-shadow-sm mb-1">
                    {kpis?.myCases ?? 0}
                  </span>
                  <p className="text-sm text-primary/80 font-bold uppercase tracking-wider">Meus Casos</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

