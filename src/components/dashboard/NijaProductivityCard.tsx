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
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 rounded-full blur-3xl mix-blend-screen pointer-events-none group-hover:bg-violet-600/10 transition-colors duration-700" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-600/5 rounded-full blur-3xl mix-blend-screen pointer-events-none group-hover:bg-purple-600/10 transition-colors duration-700" />

      <CardHeader className="pb-4 border-b border-border/40 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-inner shadow-white/20 border border-violet-400/20">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight">NIJA Inteligência</CardTitle>
              <CardDescription className="text-xs font-medium uppercase tracking-wider mt-0.5">Métricas de Produtividade</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="btn-tactile bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 border-violet-500">
              <Link to="/nija">
                <Zap className="h-4 w-4 mr-1.5" />
                <span className="font-semibold tracking-wide">Nova Análise</span>
              </Link>
            </Button>
            {isAdmin && (
              <Button asChild size="sm" variant="outline" className="btn-tactile border-white/10 hover:bg-white/5">
                <Link to="/nija-usage">
                  <Activity className="h-4 w-4 mr-1.5" />
                  <span className="font-semibold tracking-wide">Uso</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-4 relative z-10">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {/* Métricas Card */}
          <div className="p-5 rounded-2xl glass-panel bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 transform transition-transform duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/5">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-inner shadow-white/20">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div className="text-right">
                {loading ? (
                  <Skeleton className="h-8 w-16 ml-auto" />
                ) : (
                  <p className="text-4xl font-extrabold text-foreground tracking-tight drop-shadow-sm">{aiLogsCount}</p>
                )}
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500/80 mt-1">Interações (30 dias)</p>
              </div>
            </div>
            <p className="text-sm text-foreground/80 font-medium leading-relaxed bg-background/40 p-3 rounded-xl border border-white/5 backdrop-blur-sm">
              O NIJA é seu assistente jurídico inteligente. Use-o para análise de prescrição,
              geração de petições e mais.
            </p>
          </div>

          {/* Call to Action Card */}
          <div className="flex flex-col justify-center items-center p-6 rounded-2xl border-2 border-dashed border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/40 transition-all duration-300 group/cta cursor-pointer">
            <div className="h-14 w-14 rounded-full bg-violet-500/10 flex items-center justify-center mb-4 group-hover/cta:scale-110 transition-transform duration-300">
              <Brain className="h-7 w-7 text-violet-500 group-hover/cta:text-violet-400 group-hover/cta:animate-pulse" />
            </div>
            <p className="text-base font-bold text-foreground text-center tracking-tight">Inicie uma nova análise</p>
            <p className="text-xs text-muted-foreground text-center mt-2 max-w-[200px] leading-relaxed">
              Análise de prescrição, geração de peças ou comparação de estratégias
            </p>
            <Button asChild size="sm" variant="ghost" className="mt-5 btn-tactile hover:bg-violet-500/20 text-violet-500">
              <Link to="/nija">
                <span className="font-semibold tracking-wide">Começar agora</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
