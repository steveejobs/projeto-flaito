import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scale, Plus, Brain, Stethoscope, Users, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
  type?: 'LEGAL' | 'MEDICAL';
}

export function DashboardHeader({ type = 'LEGAL' }: DashboardHeaderProps) {
  const isMedical = type === 'MEDICAL';

  return (
    <Card className={cn(
      "relative overflow-hidden rounded-2xl border shadow-sm transition-all duration-300",
      isMedical ? "bg-gradient-to-br from-teal-600 to-teal-800 border-teal-700" : "bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700"
    )}>
      {/* Decorative elements removed to reduce blur */}

      <CardContent className="p-4 md:p-5 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Title */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-white/15 flex items-center justify-center border border-white/20">
                {isMedical ? <Stethoscope className="h-4 w-4 text-white" /> : <Scale className="h-4 w-4 text-white" />}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                {isMedical ? 'Modo Saúde' : 'Modo Operação'}
              </p>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-tight">
              {isMedical ? 'Health Control' : 'Legal Console'}
            </h1>
            <p className="text-xs text-white/60 font-medium">
              {isMedical ? 'Inteligência clínica em tempo real.' : 'Resumo operacional das atividades.'}
            </p>
          </div>

          {/* Right: Action buttons */}
          <div className="flex flex-wrap items-center gap-2 bg-white/10 p-1.5 rounded-xl border border-white/10">
            {isMedical ? (
              <>
                <Button asChild size="sm" className="h-8 px-3 rounded-lg text-xs font-semibold bg-white text-teal-700 hover:bg-white/90 shadow-sm transition-all">
                  <Link to="/medical/patients">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Novo Paciente
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost" className="h-8 px-3 rounded-lg text-xs font-semibold text-white/85 hover:text-white hover:bg-white/15 transition-all">
                  <Link to="/medical/transcricao">
                    <Mic className="h-3.5 w-3.5 mr-1.5" />
                    Transcrição
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost" className="h-8 px-3 rounded-lg text-xs font-semibold text-white/85 hover:text-white hover:bg-white/15 transition-all">
                  <Link to="/medical/ia">
                    <Brain className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
                    IA Copilot
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="sm" className="h-8 px-3 rounded-lg text-xs font-semibold bg-white text-slate-800 hover:bg-white/90 shadow-sm transition-all">
                  <Link to="/cases">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Novo Caso
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost" className="h-8 px-3 rounded-lg text-xs font-semibold text-white/85 hover:text-white hover:bg-white/15 transition-all">
                  <Link to="/clientes?new=true">
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    Cliente
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost" className="h-8 px-3 rounded-lg text-xs font-semibold text-white/85 hover:text-white hover:bg-white/15 transition-all">
                  <Link to="/nija">
                    <Brain className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
                    NIJA IA
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
