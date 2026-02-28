import { Link } from 'react-router-dom';
import { isToday, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock } from 'lucide-react';

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

interface PrioritiesCardProps {
  deadlines: Deadline[];
  agendaItems: AgendaItem[];
  loadingDeadlines: boolean;
  loadingAgenda: boolean;
  formatDeadlineDate: (dateStr: string) => string;
}

export function PrioritiesCard({
  deadlines,
  agendaItems,
  loadingDeadlines,
  loadingAgenda,
  formatDeadlineDate
}: PrioritiesCardProps) {
  return (
    <Card className="bento-card relative overflow-hidden group">
      {/* Subtle Background Decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl mix-blend-screen pointer-events-none group-hover:bg-primary/10 transition-colors duration-700" />

      <CardHeader className="pb-4 border-b border-border/40 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner border border-primary/20">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold tracking-tight">Prioridades</CardTitle>
            <CardDescription className="text-xs font-medium uppercase tracking-wider mt-0.5">Próximos 7 dias</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-4 space-y-6 relative z-10">
        {/* Prazos */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-destructive/60" /> Prazos
          </h4>
          {loadingDeadlines ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : deadlines.slice(0, 5).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center glass-panel rounded-xl">Nenhum prazo pendente</p>
          ) : (
            <ScrollArea className="h-[180px] pr-3 -mr-3">
              <div className="space-y-2.5">
                {deadlines.slice(0, 5).map((d) => (
                  <Link
                    key={d.id}
                    to={d.case_id ? `/cases?caseId=${d.case_id}` : '/alerts'}
                    className="flex items-center justify-between p-3 rounded-xl glass-panel hover:bg-white/5 transition-all duration-300 group/item transform hover:-translate-y-0.5 border-l-2 border-l-destructive/50"
                  >
                    <span className="text-sm font-semibold truncate flex-1 tracking-tight text-foreground/90 group-hover/item:text-foreground transition-colors">{d.title}</span>
                    <Badge variant="outline" className="text-[10px] ml-3 shrink-0 uppercase tracking-widest font-bold border-white/10 shadow-sm bg-background/50 backdrop-blur-md">
                      {formatDeadlineDate(d.due_date)}
                    </Badge>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Agenda */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500/60" /> Agenda
          </h4>
          {loadingAgenda ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : agendaItems.slice(0, 5).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center glass-panel rounded-xl">Nenhum compromisso próximo</p>
          ) : (
            <ScrollArea className="h-[180px] pr-3 -mr-3">
              <div className="space-y-2.5">
                {agendaItems.slice(0, 5).map((a) => (
                  <Link
                    key={a.id}
                    to="/agenda"
                    className="flex items-center justify-between p-3 rounded-xl glass-panel hover:bg-white/5 transition-all duration-300 group/item transform hover:-translate-y-0.5 border-l-2 border-l-emerald-500/50"
                  >
                    <span className="text-sm font-semibold truncate flex-1 tracking-tight text-foreground/90 group-hover/item:text-foreground transition-colors">{a.title}</span>
                    <Badge variant="outline" className="text-[10px] ml-3 shrink-0 uppercase tracking-widest font-bold border-white/10 shadow-sm bg-background/50 backdrop-blur-md">
                      {isToday(new Date(a.date)) ? 'Hoje' : format(new Date(a.date), 'dd/MM')}
                      {a.time && ` ${a.time}`}
                    </Badge>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
