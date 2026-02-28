import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scale, Plus, Brain, Stethoscope, Users, Calendar, Mic } from 'lucide-react';

interface DashboardHeaderProps {
  type?: 'LEGAL' | 'MEDICAL';
}

export function DashboardHeader({ type = 'LEGAL' }: DashboardHeaderProps) {
  const isMedical = type === 'MEDICAL';

  return (
    <Card className="dashboard-card rounded-2xl border-white/5 bg-background/40 backdrop-blur-xl shadow-none capture-animate-in">
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={`h-16 w-16 rounded-3xl bg-gradient-to-br flex items-center justify-center shadow-inner border border-white/10 ${isMedical ? 'from-blue-500/30 to-blue-500/5' : 'from-primary/30 to-primary/5'
                }`}>
                {isMedical ? (
                  <Stethoscope className="h-8 w-8 text-blue-400" />
                ) : (
                  <Scale className="h-8 w-8 text-primary" />
                )}
              </div>
              <div className="space-y-1">
                <h1 className="text-hero">
                  {isMedical ? 'Dashboard Médico' : 'Dashboard Jurídico'}
                </h1>
                <p className="text-base text-muted-foreground font-medium tracking-wide">
                  {isMedical ? 'Gestão Clínica Inteligente' : 'Resumo operacional do dia'} • {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {isMedical ? (
              <>
                <Button asChild size="lg" className="rounded-xl btn-tactile shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700">
                  <Link to="/medical/patients">
                    <Plus className="h-5 w-5 mr-2" />
                    Novo Paciente
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-xl btn-tactile border-white/10 hover:bg-white/5">
                  <Link to="/medical/transcricao">
                    <Mic className="h-5 w-5 mr-2" />
                    Nova Transcrição
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-xl btn-tactile border-white/10 hover:bg-white/5">
                  <Link to="/medical/agenda">
                    <Calendar className="h-5 w-5 mr-2" />
                    Nova Consulta
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary" className="rounded-xl btn-tactile bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20">
                  <Link to="/medical/ia">
                    <Brain className="h-5 w-5 mr-2" />
                    Abrir IA Médica
                  </Link>
                </Button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
