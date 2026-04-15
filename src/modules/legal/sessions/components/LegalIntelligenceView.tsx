import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Search,
  Scale,
  Link as LinkIcon,
  ShieldCheck,
  Brain,
  History,
  AlertOctagon
} from "lucide-react";


interface LegalIntelligenceViewProps {
  analysis: any;
  sources: any[];
  isStale?: boolean;
}

export const LegalIntelligenceView: React.FC<LegalIntelligenceViewProps & { snapshot?: any }> = ({ analysis, sources, snapshot, isStale }) => {
  if (!analysis) {
    return (
      <div className="text-center py-20 bg-card/10 rounded-xl border border-dashed border-white/10">
        <Scale className="h-12 w-12 text-muted-foreground opacity-20 mx-auto mb-4" />
        <p className="text-muted-foreground">O NIJA está aguardando o processamento para gerar o dossiê.</p>
      </div>
    );
  }

  const sufficiencyConfig = {
    sufficient: { label: "Suficiente", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle2 },
    weak: { label: "Fraca (Atenção)", color: "bg-orange-500/20 text-orange-500", icon: AlertTriangle },
    insufficient: { label: "Insuficiente", color: "bg-red-500/20 text-red-500", icon: AlertTriangle },
  };

  const sufficiency = analysis.context_sufficiency as keyof typeof sufficiencyConfig || 'sufficient';
  const SufficiencyIcon = sufficiencyConfig[sufficiency].icon;

  return (
    <div className="space-y-6">
      {/* Header de Metadados de Auditoria (Stage 4) */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-bold text-muted-foreground uppercase">Suficiência Documental:</span>
           <Badge className={`${sufficiencyConfig[sufficiency].color} border-none flex items-center gap-1.5`}>
             <SufficiencyIcon className="h-3 w-3" /> {sufficiencyConfig[sufficiency].label}
           </Badge>
        </div>
        <div className="h-4 w-px bg-white/10 mx-2 hidden md:block" />
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-bold text-muted-foreground uppercase">Snapshot Integrity:</span>
           <code className="text-[10px] bg-black/30 px-2 py-0.5 rounded text-blue-400 font-mono">
             {analysis.snapshot_id?.slice(0, 8)}
           </code>
        </div>
      </div>

      {/* Aviso de Snapshot Obsoleto (Stage 2 Hardening) */}
      {isStale && (
        <div className="p-4 bg-orange-600/10 border border-orange-500/30 rounded-xl flex items-start gap-4 animate-in slide-in-from-top duration-500">
          <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-orange-500 uppercase">Snapshot obsoleto detectado</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O dossiê jurídico acima foi baseado em um snapshot anterior. <strong>Novas fontes de prova foram incorporadas ao processo.</strong> Recomenda-se o reprocessamento para evitar contradições estratégicas.
            </p>
          </div>
        </div>
      )}

      {/* Resumo e Riscos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-primary/5 border-primary/20 shadow-glow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary fill-primary" /> RESUMO DO DOSSIÊ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground italic">
              "{analysis.summary}"
            </p>
          </CardContent>
        </Card>

        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-4 w-4" /> RISCOS E CONTRADIÇÕES
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc ml-5 space-y-2 text-sm text-muted-foreground">
              {analysis.risks?.map((r: string, i: number) => <li key={i}>{r}</li>)}
              {(analysis.validation_gates?.contradiction_check === 'failed') && (
                <li className="text-red-400 font-bold">ALERTA: Contradição detectada entre áudio e documentos primários.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Taxonomia de Fatos (Stage 4 Hardening) */}
      <Card className="bg-card/30 border-white/5">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Search className="h-4 w-4 text-blue-400" /> TAXONOMIA DE FATOS & EVIDÊNCIAS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Documentary Facts (Tier 1) */}
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <h5 className="text-[10px] uppercase font-bold text-emerald-500 mb-2 flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" /> Fatos Documentais
              </h5>
              <div className="space-y-2">
                {(analysis.fact_taxonomy?.documentary_facts || analysis.document_supported_facts)?.map((f: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" /> {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Oral Claims */}
            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
              <h5 className="text-[10px] uppercase font-bold text-orange-500 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" /> Alegações Orais
              </h5>
              <div className="space-y-2">
                {(analysis.fact_taxonomy?.oral_facts || analysis.oral_claims)?.map((c: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" /> {c}
                  </div>
                ))}
              </div>
            </div>

            {/* Inferences */}
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <h5 className="text-[10px] uppercase font-bold text-blue-400 mb-2 flex items-center gap-1.5">
                <Brain className="h-3 w-3" /> Inferências Lógicas
              </h5>
              <div className="space-y-2">
                {analysis.fact_taxonomy?.inferences?.map((inf: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <History className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" /> {inf}
                  </div>
                ))}
                {(!analysis.fact_taxonomy?.inferences || analysis.fact_taxonomy.inferences.length === 0) && (
                  <p className="text-[10px] text-muted-foreground italic">Nenhuma inferência técnica registrada.</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Minuta de Peça Assistida */}
      <Card className="bg-card/30 border-white/5 overflow-hidden">
        <CardHeader className="bg-white/5 border-b border-white/5 flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> MINUTA DE PEÇA SUGERIDA
          </CardTitle>
          <Badge className="bg-primary/20 text-primary border-primary/30 uppercase text-[10px]">NIJA-DRFT-V4</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-black/40 p-6 font-serif text-sm leading-relaxed text-muted-foreground min-h-[300px] whitespace-pre-wrap">
            {analysis.draft_document || "O rascunho da peça jurídica será gerado após a consolidação total do dossiê."}
          </div>
          <div className="p-4 border-t border-white/5 bg-white/5 flex justify-end gap-2">
            <Button variant="outline" size="sm">Copiar Conteúdo</Button>
            <Button size="sm">Exportar para DOCX</Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Fontes de Contexto & Linhagem (Stage 4 Audit) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h4 className="text-xs font-bold opacity-50 uppercase tracking-tighter flex items-center gap-2">
            <LinkIcon className="h-3 w-3" /> Fontes Incorporadas ao Snapshot ({snapshot?.ordered_sources_json?.length || 0})
          </h4>
          <div className="flex flex-wrap gap-2">
            {(snapshot?.ordered_sources_json || sources).map((s: any) => (
              <Badge key={s.source_id || s.id} variant="secondary" className="bg-emerald-500/5 border-emerald-500/20 gap-1 py-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 opacity-70" /> {s.source_type}: {(s.source_id || s.id).slice(0, 8)}
              </Badge>
            ))}
          </div>
        </div>

        {snapshot?.excluded_sources_json?.length > 0 && (
          <div className="space-y-2 opacity-60">
            <h4 className="text-xs font-bold opacity-50 uppercase tracking-tighter flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> Fontes Excluídas do Snapshot ({snapshot.excluded_sources_json.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {snapshot.excluded_sources_json.map((s: any, i: number) => (
                <Badge key={i} variant="outline" title={s.reason} className="border-white/10 gap-1 py-1 italic">
                  <AlertOctagon className="h-3 w-3 opacity-50" /> {s.source_type || 'doc'}: {s.source_id?.slice(0, 8)} 
                  <span className="text-[8px] opacity-40 ml-1">({s.reason})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

