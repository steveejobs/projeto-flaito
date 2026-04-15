import * as React from "react";
import { 
  Gavel, 
  Target, 
  ShieldAlert, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Scale, 
  Zap, 
  HelpCircle,
  FileText,
  Swords,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface NijaJudgeReportProps {
  judgmentData: {
    probabilidade_exito: number;
    faixa: "MUITO_BAIXA" | "BAIXA" | "MEDIA" | "ALTA";
    tipo_decisao_provavel: string;
    fundamentos_provaveis: string[];
    pontos_fortes: string[];
    pontos_fracos: string[];
    lacunas_probatorias: string[];
    sugestoes_melhoria: string[];
    score_qualidade_peca: number;
    score_componentes: {
      provas: number;
      fundamentacao: number;
      coerencia: number;
      jurisprudencia: number;
      lacunas: number;
      risco: number;
    };
    observacao_juiz: string;
    alerta_risco?: string;
    riscos_processuais?: Array<{
      titulo: string;
      gravidade: "BAIXA" | "MEDIA" | "ALTA";
      descricao: string;
    }>;
    relatorio_detalhado?: Record<string, string>;
  };
}

export function NijaJudgeReport({ judgmentData }: NijaJudgeReportProps) {
  if (!judgmentData) return null;

  const {
    probabilidade_exito: score,
    faixa,
    tipo_decisao_provavel: decisao,
    score_componentes: metrics,
    riscos_processuais: risks,
    fundamentos_provaveis: fundamentals
  } = judgmentData;

  const getFaixaColor = (f: string) => {
    switch (f) {
      case "ALTA_PROBABILIDADE": return "text-green-500 bg-green-500/10 border-green-500/20";
      case "BOA_CHANCE": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      case "RISCO_MODERADO": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
      case "BAIXA_PROBABILIDADE": return "text-red-500 bg-red-500/10 border-red-500/20";
      default: return "text-muted-foreground";
    }
  };

  const getMetricColor = (val: number) => {
    if (val >= 8) return "bg-green-500";
    if (val >= 5) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Banner Executive */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Probability Score Card */}
        <Card className="lg:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Gavel className="h-24 w-24 -mr-8 -mt-8 rotate-12" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-400">Probabilidade de Êxito</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="relative flex items-center justify-center">
              <svg className="h-32 w-32">
                <circle
                  cx="64" cy="64" r="58"
                  fill="none" stroke="currentColor" strokeWidth="8"
                  className="text-slate-700"
                />
                <circle
                  cx="64" cy="64" r="58"
                  fill="none" stroke="currentColor" strokeWidth="8"
                  strokeDasharray={364.4}
                  strokeDashoffset={364.4 - (364.4 * score) / 100}
                  strokeLinecap="round"
                  className={cn(
                    "transition-all duration-1000 ease-out",
                    score >= 61 ? "text-green-500" : score >= 31 ? "text-yellow-500" : "text-red-500"
                  )}
                  transform="rotate(-90 64 64)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black">{score}%</span>
                <Badge variant="outline" className={cn("mt-1 text-[10px] font-bold border-none", getFaixaColor(faixa))}>
                  {faixa?.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verdict & Reasoning */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Veredito Simulado
              </CardTitle>
              <Badge className="bg-primary/10 text-primary border-primary/20">{decisao}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted/30 rounded-lg text-sm italic text-muted-foreground leading-relaxed">
              "{fundamentals?.[0] || 'Fundamentação não disponível para esta simulação.'}"
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-slate-400">Provas (30%)</p>
                <Progress value={(metrics?.provas || 0) * 10} className="h-1.5" indicatorClassName={getMetricColor(metrics?.provas || 0)} />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-slate-400">Fundamentos (20%)</p>
                <Progress value={(metrics?.fundamentacao || 0) * 10} className="h-1.5" indicatorClassName={getMetricColor(metrics?.fundamentacao || 0)} />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-slate-400">Coerência (15%)</p>
                <Progress value={(metrics?.coerencia || 0) * 10} className="h-1.5" indicatorClassName={getMetricColor(metrics?.coerencia || 0)} />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-slate-400">Jurisprudência (15%)</p>
                <Progress value={(metrics?.jurisprudencia || 0) * 10} className="h-1.5" indicatorClassName={getMetricColor(metrics?.jurisprudencia || 0)} />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-slate-400">Lacunas (10%)</p>
                <Progress value={(metrics?.lacunas || 0) * 10} className="h-1.5" indicatorClassName={getMetricColor(metrics?.lacunas || 0)} />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-slate-400">Risco (10%)</p>
                <Progress value={(metrics?.risco || 0) * 10} className="h-1.5" indicatorClassName={getMetricColor(metrics?.risco || 0)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Global Risk Alert */}
        <Card className={cn("lg:col-span-1 border-none shadow-lg", score < 50 ? "bg-red-600 text-white" : "bg-blue-600 text-white")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Alerta do Magistrado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-medium leading-relaxed mb-4">
              {judgmentData.alerta_risco || "Análise preliminar sugere cautela na condução das provas orais."}
            </p>
            <div className="p-2 bg-white/10 rounded border border-white/20">
              <p className="text-[10px] font-bold uppercase opacity-70">Observação Interna</p>
              <p className="text-[10px] italic">{judgmentData.observacao_juiz}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid: SWOT & Detailed Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SWOT Matrix */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase">
              <Target className="h-4 w-4 text-blue-600" />
              Matriz SWOT de Litigância
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2">
              <div className="p-4 border-r border-b space-y-2">
                <p className="text-[10px] font-black uppercase text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Forças
                </p>
                <ul className="text-[11px] space-y-1">
                  {judgmentData.pontos_fortes.map((s, i) => (
                    <li key={i} className="flex items-start gap-1"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-green-600" /> {s}</li>
                  ))}
                </ul>
              </div>
              <div className="p-4 border-b space-y-2 bg-red-50/30">
                <p className="text-[10px] font-black uppercase text-red-600 flex items-center gap-1">
                  <Swords className="h-3 w-3" /> Fraquezas
                </p>
                <ul className="text-[11px] space-y-1">
                  {judgmentData.pontos_fracos.map((s, i) => (
                    <li key={i} className="flex items-start gap-1"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-red-600" /> {s}</li>
                  ))}
                </ul>
              </div>
              <div className="p-4 border-r space-y-2 bg-blue-50/30">
                <p className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Oportunidades
                </p>
                <ul className="text-[11px] space-y-1">
                  {judgmentData.sugestoes_melhoria.map((s, i) => (
                    <li key={i} className="flex items-start gap-1"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-blue-600" /> {s}</li>
                  ))}
                </ul>
              </div>
              <div className="p-4 space-y-2 bg-orange-50/30">
                <p className="text-[10px] font-black uppercase text-orange-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Ameaças
                </p>
                <ul className="text-[11px] space-y-1">
                  {judgmentData.lacunas_probatorias.map((s, i) => (
                    <li key={i} className="flex items-start gap-1"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-orange-600" /> {s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Risks List */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase">
              <Scale className="h-4 w-4 text-orange-600" />
              Relatório de Riscos Processuais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[240px] pr-4">
              <div className="space-y-4">
                {risks && risks.length > 0 ? (
                  risks.map((risk, i) => (
                    <div key={i} className="p-3 border rounded-lg bg-muted/20 relative overflow-hidden group">
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1",
                        risk.gravidade === "ALTA" ? "bg-red-500" : risk.gravidade === "MEDIA" ? "bg-yellow-500" : "bg-blue-500"
                      )} />
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase">{risk.titulo}</span>
                        <Badge variant="outline" className="text-[9px] font-bold">{risk.gravidade}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {risk.descricao}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-center">
                    <CheckCircle2 className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-xs italic">Nenhum risco processual crítico detectado nesta análise.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* 9 Stages Details (Compact Info) */}
      <Card className="bg-slate-50 border-slate-200">
        <ScrollArea className="w-full">
          <div className="flex p-4 gap-6 items-center">
             <div className="shrink-0 flex items-center gap-2 px-2 border-r pr-6">
                <HelpCircle className="h-4 w-4 text-slate-400" />
                <span className="text-[10px] font-bold uppercase text-slate-500 whitespace-nowrap">Audit Log V2</span>
             </div>
             {judgmentData.relatorio_detalhado && Object.entries(judgmentData.relatorio_detalhado).map(([key, value], idx) => (
                <div key={idx} className="shrink-0 flex flex-col gap-0.5 max-w-[200px]">
                  <span className="text-[9px] font-bold uppercase text-blue-600 truncate">{key.replace(/_/g, ' ')}</span>
                  <p className="text-[10px] text-slate-500 truncate italic">{value}</p>
                </div>
             ))}
             {!judgmentData.relatorio_detalhado && (
                <p className="text-[10px] italic text-slate-400">Detalhes dos estágios indisponíveis nesta versão.</p>
             )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
