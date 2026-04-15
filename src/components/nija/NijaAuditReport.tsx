import * as React from "react";
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Scale, 
  ShieldCheck, 
  FileWarning, 
  Zap, 
  Search, 
  FileText,
  Activity,
  Award
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NijaAuditReportProps {
  auditData: {
    etapa_1_estrutura: { estrutura_valida: boolean; problemas_estrutura: string[] };
    etapa_2_fatos: { coerencia_fatica: boolean; problemas_fatos: string[] };
    etapa_3_fundamentacao: { fundamentacao_valida: boolean; falhas_fundamentacao: string[] };
    etapa_4_pedidos: { pedidos_validos: boolean; problemas_pedidos: string[] };
    etapa_5_provas: { provas_ok: string[]; provas_faltantes: string[]; provas_mal_utilizadas: string[] };
    etapa_6_inconsistencias: { inconsistencias: string[] };
    etapa_7_lacunas: { lacunas: string[] };
    etapa_8_qualidade: { qualidade_geral: number; nivel_profissional: string };
    relatorio_final: { 
      aprovado: boolean; 
      nivel_risco: string; 
      problemas_criticos: string[]; 
      melhorias_recomendadas: string[]; 
      resumo_revisao: string;
    };
  };
}

export function NijaAuditReport({ auditData }: NijaAuditReportProps) {
  if (!auditData) return null;

  const { relatorio_final, etapa_8_qualidade } = auditData;

  const getRiskColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case "baixo": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "médio": return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "alto": return "bg-red-500/10 text-red-700 border-red-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-500";
    if (score >= 5) return "text-yellow-500";
    return "text-red-500";
  };

  const stages = [
    { 
      id: 1, 
      label: "Estrutura", 
      icon: <FileText className="h-4 w-4" />, 
      status: auditData.etapa_1_estrutura.estrutura_valida,
      issues: auditData.etapa_1_estrutura.problemas_estrutura 
    },
    { 
      id: 2, 
      label: "Fatos", 
      icon: <Search className="h-4 w-4" />, 
      status: auditData.etapa_2_fatos.coerencia_fatica,
      issues: auditData.etapa_2_fatos.problemas_fatos 
    },
    { 
      id: 3, 
      label: "Fundamentação", 
      icon: <Scale className="h-4 w-4" />, 
      status: auditData.etapa_3_fundamentacao.fundamentacao_valida,
      issues: auditData.etapa_3_fundamentacao.falhas_fundamentacao 
    },
    { 
      id: 4, 
      label: "Pedidos", 
      icon: <Zap className="h-4 w-4" />, 
      status: auditData.etapa_4_pedidos.pedidos_validos,
      issues: auditData.etapa_4_pedidos.problemas_pedidos 
    },
    { 
      id: 5, 
      label: "Provas", 
      icon: <ShieldCheck className="h-4 w-4" />, 
      status: auditData.etapa_5_provas.provas_faltantes.length === 0,
      details: {
        ok: auditData.etapa_5_provas.provas_ok,
        faltantes: auditData.etapa_5_provas.provas_faltantes,
        mal_utilizadas: auditData.etapa_5_provas.provas_mal_utilizadas
      }
    },
    { 
      id: 6, 
      label: "Inconsistências", 
      icon: <Activity className="h-4 w-4" />, 
      status: auditData.etapa_6_inconsistencias.inconsistencias.length === 0,
      issues: auditData.etapa_6_inconsistencias.inconsistencias 
    },
    { 
      id: 7, 
      label: "Lacunas", 
      icon: <FileWarning className="h-4 w-4" />, 
      status: auditData.etapa_7_lacunas.lacunas.length === 0,
      issues: auditData.etapa_7_lacunas.lacunas 
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-background to-muted/30 border-primary/20 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              Score de Qualidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${getScoreColor(etapa_8_qualidade.qualidade_geral)}`}>
              {etapa_8_qualidade.qualidade_geral}<span className="text-sm text-muted-foreground ml-1">/10</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 capitalize">
              Nível Profissional: {etapa_8_qualidade.nivel_profissional}
            </p>
            <Progress value={etapa_8_qualidade.qualidade_geral * 10} className="h-1.5 mt-3" />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-background to-muted/30 border-primary/20 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Veredito Final
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              {relatorio_final.aprovado ? (
                <Badge className="bg-green-500 text-white hover:bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> APROVADO
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" /> REQUER AJUSTES
                </Badge>
              )}
              <Badge variant="outline" className={getRiskColor(relatorio_final.nivel_risco)}>
                Risco: {relatorio_final.nivel_risco}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {relatorio_final.resumo_revisao}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-background to-muted/30 border-primary/20 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-4 w-4" />
              Problemas Críticos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {relatorio_final.problemas_criticos.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {relatorio_final.problemas_criticos.length === 0 
                ? "Nenhum bloqueador crítico detectado." 
                : "Falhas que comprometem a peça."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 9 Stages Details - Bento Grid style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stages.map((stage) => (
          <Card key={stage.id} className={`overflow-hidden transition-all hover:shadow-md ${!stage.status && stage.issues?.length ? 'border-red-200 bg-red-50/10' : ''}`}>
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${stage.status ? 'bg-primary/5 text-primary' : 'bg-red-500/10 text-red-500'}`}>
                  {stage.icon}
                </div>
                <CardTitle className="text-sm font-semibold">{stage.label}</CardTitle>
              </div>
              {stage.status ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
              )}
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ScrollArea className="h-[100px]">
                {stage.issues && stage.issues.length > 0 ? (
                  <ul className="space-y-1.5">
                    {stage.issues.map((issue, idx) => (
                      <li key={idx} className="text-xs flex items-start gap-1.5 text-muted-foreground">
                        <span className="text-red-500 mt-1">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                ) : stage.details ? (
                  <div className="space-y-2">
                    {stage.details.ok.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-green-600 mb-1">Verificadas</p>
                        <div className="flex flex-wrap gap-1">
                          {stage.details.ok.map((p, idx) => (
                            <Badge key={idx} variant="outline" className="text-[9px] bg-green-500/5">{p}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {stage.details.faltantes.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-red-600 mb-1">Ausentes</p>
                        <ul className="text-xs space-y-1">
                          {stage.details.faltantes.map((p, idx) => (
                            <li key={idx} className="text-red-500/80">• {p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-green-600 font-medium italic">Análise impecável. Nenhum problema detectado.</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        ))}

        {/* Recomendations Summary */}
        <Card className="col-span-1 md:col-span-2 border-primary/20 bg-primary/5">
          <CardHeader className="p-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Recomendações Estratégicas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-primary/70">Melhorias Recomendadas</p>
                <ul className="space-y-1">
                  {relatorio_final.melhorias_recomendadas.map((m, idx) => (
                    <li key={idx} className="text-xs flex items-start gap-2 text-muted-foreground">
                      <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                      {m}
                    </li>
                  ))}
                  {relatorio_final.melhorias_recomendadas.length === 0 && (
                    <li className="text-xs italic text-muted-foreground">Nenhuma melhoria sugerida.</li>
                  )}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-red-600/70">Bloqueios Críticos</p>
                <ul className="space-y-1">
                  {relatorio_final.problemas_criticos.map((p, idx) => (
                    <li key={idx} className="text-xs flex items-start gap-2 text-red-600 font-medium">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      {p}
                    </li>
                  ))}
                  {relatorio_final.problemas_criticos.length === 0 && (
                    <li className="text-xs italic text-green-600">Peça livre de bloqueios críticos.</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
