import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, Bot, Zap, ArrowRight, Activity } from 'lucide-react';

interface NijaProductivityCardProps {
  aiLogsCount: number;
  loading: boolean;
  isAdmin: boolean;
}

export function NijaProductivityCard({ aiLogsCount, loading, isAdmin }: NijaProductivityCardProps) {
  return (
    <Card className="bento-card relative overflow-hidden group">
      {/* Subtle Background Decoration */}
      {/* Decorative effects removed to reduce blur */}

      <CardHeader className="pb-3 border-b border-border/40 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-inner shadow-white/20 border border-violet-400/20">
              <Brain className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-bold tracking-tight">NIJA Inteligência</CardTitle>
              <CardDescription className="text-[9px] font-semibold uppercase tracking-widest mt-0.5 text-muted-foreground/60">Métricas de Produtividade</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="text-xs h-8 px-3 btn-tactile bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 border-violet-500">
              <Link to="/nija">
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                <span className="font-semibold tracking-wide">Nova Análise</span>
              </Link>
            </Button>
            {isAdmin && (
              <Button asChild size="sm" variant="outline" className="text-xs h-8 px-3 btn-tactile border-white/10 hover:bg-white/5">
                <Link to="/nija-usage">
                  <Activity className="h-3.5 w-3.5 mr-1.5" />
                  <span className="font-semibold tracking-wide">Uso</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-3 relative z-10">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {/* Métricas Card */}
          <div className="p-3 rounded-xl glass-panel bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 transform transition-transform duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/5">
            <div className="flex items-start justify-between mb-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-inner shadow-white/20">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="text-right">
                {loading ? (
                  <Skeleton className="h-8 w-16 ml-auto" />
                ) : (
                  <p className="text-2xl font-bold text-foreground tracking-tight drop-shadow-sm">{aiLogsCount}</p>
                )}
                <p className="text-[9px] font-bold uppercase tracking-widest text-violet-500/80 mt-1">Interações (30 dias)</p>
              </div>
            </div>
            <p className="text-xs text-foreground/80 font-medium leading-relaxed bg-background/40 p-2.5 rounded-lg border border-white/5">
              O NIJA é seu assistente jurídico inteligente. Use-o para análise de prescrição,
              geração de petições e mais.
            </p>
          </div>

          {/* Call to Action Card */}
          <div className="flex flex-col justify-center items-center p-3 rounded-xl border border-dashed border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/50 transition-all duration-300 group/cta cursor-pointer">
            <div className="h-10 w-10 rounded-full bg-violet-500/10 flex items-center justify-center mb-2 group-hover/cta:scale-110 transition-transform duration-300">
              <Brain className="h-5 w-5 text-violet-500 group-hover/cta:text-violet-400 group-hover/cta:animate-pulse" />
            </div>
            <p className="text-sm font-bold text-foreground text-center tracking-tight">Inicie uma nova análise</p>
            <p className="text-[9px] text-muted-foreground text-center mt-1 max-w-[200px] leading-relaxed uppercase tracking-widest font-semibold">
              Análise e Geração de Peças
            </p>
            <Button asChild size="sm" variant="ghost" className="mt-3 text-[10px] h-7 px-3 btn-tactile hover:bg-violet-500/20 text-violet-500">
              <Link to="/nija">
                <span className="font-semibold tracking-wide">Começar agora</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
