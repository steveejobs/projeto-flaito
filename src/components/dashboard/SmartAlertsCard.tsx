import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react';
import { ReactNode } from 'react';

interface SmartAlert {
  id: string;
  type: 'deadline_overdue' | 'deadline_today' | 'deadline_soon' | 'appointment_today' | 'nija_high_risk' | 'nija_prescription_risk';
  severity: 'alta' | 'media';
  title: string;
  subtitle?: string;
  date: string;
  link: string;
}

interface SmartAlertsCardProps {
  alerts: SmartAlert[];
  loading: boolean;
  getAlertIcon: (type: SmartAlert['type']) => ReactNode;
  getAlertLabel: (type: SmartAlert['type']) => string;
}

export function SmartAlertsCard({ alerts, loading, getAlertIcon, getAlertLabel }: SmartAlertsCardProps) {
  return (
    <Card className="bento-card relative overflow-hidden group">
      {/* Background Decorativo Sutil */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl mix-blend-screen pointer-events-none group-hover:bg-amber-500/10 transition-colors duration-700" />

      <CardHeader className="pb-4 border-b border-border/40 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shadow-inner border border-amber-500/20">
              <AlertCircle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight">Alertas Inteligentes</CardTitle>
              <CardDescription className="text-xs font-medium uppercase tracking-wider mt-0.5">Prazos e compromissos críticos</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="btn-tactile hover:bg-white/5 border border-transparent hover:border-white/10">
            <Link to="/alerts">
              <span className="font-semibold tracking-wide">Ver todos</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-4 relative z-10">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-base font-medium text-foreground">Nenhum alerta crítico no momento</p>
            <p className="text-sm text-muted-foreground mt-1">Todos os prazos e compromissos estão em dia</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                to={alert.link}
                className="flex items-center gap-4 p-4 rounded-xl glass-panel hover:bg-white/5 transition-all duration-300 group/alert transform hover:-translate-y-0.5"
              >
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner border ${alert.severity === 'alta' ? 'bg-destructive/10 border-destructive/20' : 'bg-amber-500/10 border-amber-500/20'
                  }`}>
                  <div className="transform transition-transform group-hover/alert:scale-110">
                    {getAlertIcon(alert.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-foreground truncate">{alert.title}</p>
                  {alert.subtitle && (
                    <p className="text-sm text-muted-foreground truncate">{alert.subtitle}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant={alert.severity === 'alta' ? 'destructive' : 'secondary'}
                      className="text-[10px] uppercase font-bold tracking-widest px-2 py-0 border-white/10 shadow-sm"
                    >
                      {alert.severity === 'alta' ? 'Alta' : 'Média'}
                    </Badge>
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider hidden sm:block">
                      {getAlertLabel(alert.type)}
                    </span>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover/alert:opacity-100 transition-all duration-300 transform -translate-x-2 group-hover/alert:translate-x-0">
                    <ExternalLink className="h-4 w-4 text-foreground/70" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
