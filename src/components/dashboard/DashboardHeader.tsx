import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scale, Plus, Brain } from 'lucide-react';

export function DashboardHeader() {
  return (
    <Card className="dashboard-card rounded-2xl border-white/5 bg-background/40 backdrop-blur-xl shadow-none capture-animate-in">
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center shadow-inner border border-white/10">
                <Scale className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1">
                <h1 className="text-hero">
                  Dashboard
                </h1>
                <p className="text-base text-muted-foreground font-medium tracking-wide">
                  Resumo operacional do dia • {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-xl btn-tactile shadow-lg shadow-primary/20">
              <Link to="/cases">
                <Plus className="h-5 w-5 mr-2" />
                Novo Caso
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl btn-tactile border-white/10 hover:bg-white/5">
              <Link to="/clientes?new=true">
                <Plus className="h-5 w-5 mr-2" />
                Novo Cliente
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl btn-tactile border-white/10 hover:bg-white/5">
              <Link to="/agenda">
                <Plus className="h-5 w-5 mr-2" />
                Nova Agenda
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="rounded-xl btn-tactile bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20">
              <Link to="/nija">
                <Brain className="h-5 w-5 mr-2" />
                Abrir NIJA
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
