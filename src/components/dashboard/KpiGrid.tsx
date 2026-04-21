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
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {/* Alertas Críticos */}
      <Link to="/alerts" className="block transform transition-transform duration-300 hover:scale-[1.02]">
        <Card className="bento-card cursor-pointer h-full group">
          <CardContent className="p-4 flex flex-col h-full justify-between">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors duration-300 ${(kpis?.criticalAlerts ?? 0) > 0 ? 'bg-destructive/15 group-hover:bg-destructive/25' : 'bg-muted/50 group-hover:bg-muted'}`}>
                  <Bell className={`h-5 w-5 ${(kpis?.criticalAlerts ?? 0) > 0 ? 'text-destructive group-hover:animate-pulse' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-3xl font-bold text-foreground tracking-tight drop-shadow-sm">
                      {kpis?.criticalAlerts ?? 0}
                    </span>
                    {(kpis?.criticalAlerts ?? 0) > 0 && (
                      <Badge variant="destructive" className="animate-pulse shadow-sm shadow-destructive/20 border-white/10 uppercase tracking-widest text-[9px] font-bold">Urgente</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-[0.15em] truncate">Alertas Críticos</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Compromissos Hoje */}
      <Link to="/agenda">
        <Card className="bento-card cursor-pointer h-full">
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="text-3xl font-bold text-foreground block mb-1">
                  {kpis?.todayAppointments ?? 0}
                </span>
                <p className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-[0.15em] truncate">Compromissos</p>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Pagamentos Pendentes */}
      <Link to="/agenda/payments">
        <Card className="bento-card cursor-pointer h-full">
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-3xl font-bold text-foreground block mb-1">—</span>
                <p className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-[0.15em] truncate">Pagamentos</p>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Casos em Risco */}
      <Link to="/cases?risk=alto" className="block transform transition-transform duration-300 hover:scale-[1.02]">
        <Card className={`bento-card cursor-pointer h-full group ${hasHighRisk ? 'ring-1 ring-destructive/40 bg-gradient-to-br from-destructive/5 to-transparent' : ''}`}>
          <CardContent className="p-4 flex flex-col h-full justify-between">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors duration-300 ${hasHighRisk ? 'bg-destructive/15 group-hover:bg-destructive/25' : 'bg-muted/50 group-hover:bg-muted'}`}>
                  <ShieldAlert className={`h-5 w-5 ${hasHighRisk ? 'text-destructive group-hover:animate-pulse' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-3xl font-bold tracking-tight drop-shadow-sm ${hasHighRisk ? 'text-destructive' : 'text-foreground'}`}>
                      {kpis?.highRiskCases ?? 0}
                    </span>
                    {hasHighRisk && (
                      <Badge variant="destructive" className="shadow-sm shadow-destructive/20 border-white/10 text-[9px] uppercase font-bold tracking-widest">Nija AI</Badge>
                    )}
                  </div>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.15em] truncate ${hasHighRisk ? 'text-destructive/80' : 'text-muted-foreground/80'}`}>Casos em Risco</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Meus Casos */}
      <Link to="/cases?scope=mine" className="block transform transition-transform duration-300 hover:scale-[1.02]">
        <Card className="bento-card cursor-pointer h-full group">
          <CardContent className="p-4 flex flex-col h-full justify-between">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-lg bg-primary/15 group-hover:bg-primary/25 flex items-center justify-center transition-colors duration-300">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="block text-3xl font-bold text-foreground tracking-tight drop-shadow-sm mb-1">
                    {kpis?.myCases ?? 0}
                  </span>
                  <p className="text-[10px] text-primary/80 font-bold uppercase tracking-[0.15em] truncate">Meus Casos</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

