import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  HeartPulse, 
  Stethoscope, 
  ClipboardCheck, 
  AlertCircle, 
  FileEdit,
  UserCheck,
  Zap,
  AlertOctagon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MedicalIntelligenceViewProps {
  analysis: any;
  sources: any[];
  isStale?: boolean;
}

export const MedicalIntelligenceView: React.FC<MedicalIntelligenceViewProps> = ({ analysis, sources, isStale }) => {
  const [isReviewing, setIsReviewing] = React.useState(false);
  const [isCertifying, setIsCertifying] = React.useState(false);
  const [reviewStartedAt, setReviewStartedAt] = React.useState<string | null>(null);

  // Inicia o timer de revisão quando o componente monta ou quando o usuário interage
  React.useEffect(() => {
    if (!analysis?.is_finalized && !reviewStartedAt) {
      setReviewStartedAt(new Date().toISOString());
    }
  }, [analysis, reviewStartedAt]);

  const handleLogReview = async (action: 'APPROVE' | 'REJECT' | 'VIEW') => {
    setIsReviewing(true);
    try {
      const { error } = await supabase.functions.invoke('session-processor', {
        body: { 
          action: 'log_medical_review',
          output_id: analysis.id,
          session_id: analysis.session_id,
          action_performed: action,
          started_at: reviewStartedAt
        }
      });
      if (error) throw error;
      
      if (action === 'APPROVE') {
        alert("Revisão concluída com sucesso. O laudo agora pode ser assinado oficialmente.");
        window.location.reload();
      }
    } catch (err) {
      console.error("Erro ao registrar revisão:", err);
      alert("Falha ao registrar evento de revisão.");
    } finally {
      setIsReviewing(false);
    }
  };

  const handleCertify = async () => {
    if (!analysis?.id) return;
    
    setIsCertifying(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('session-processor', {
        body: { 
          action: 'certify_medical_output',
          output_id: analysis.id,
          content_hash: analysis.output_hash
        }
      });

      if (error) throw error;
      
      alert(`Relatório Certificado: ${response.professional_tag}`);
      window.location.reload();
    } catch (err) {
      console.error("Falha na certificação:", err);
      alert(err.message || "Erro ao certificar. Verifique se a revisão foi concluída.");
    } finally {
      setIsCertifying(false);
    }
  };

  const isFinalized = analysis.is_finalized === true;
  const isDraft = !isFinalized;

  if (!analysis) {
    return (
      <div className="text-center py-20 bg-card/10 rounded-xl border border-dashed border-white/10">
        <Stethoscope className="h-12 w-12 text-muted-foreground opacity-20 mx-auto mb-4" />
        <p className="text-muted-foreground">AGUARDANDO PROCESSAMENTO CLÍNICO.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aviso de Snapshot Obsoleto (Stage 2 Hardening) */}
      {isStale && (
        <div className="p-4 bg-red-600/20 border border-red-600/50 rounded-xl flex items-start gap-4 animate-pulse">
          <AlertOctagon className="h-5 w-5 text-red-500 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-red-500 uppercase">BLOQUEIO DE GOVERNANÇA: SNAPSHOT OBSOLETO</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O contexto clínico mudou desde a geração desta análise. A assinatura está bloqueada por segurança. 
              <strong> Por favor, execute o reprocessamento para alinhar a inteligência com o estado atual do paciente.</strong>
            </p>
          </div>
        </div>
      )}
      {/* Aviso de Segurança Médica */}
      {isDraft && !isFinalized && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-4 animate-in slide-in-from-top duration-500">
          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-yellow-500">RASCUNHO GERADO POR IA (AI DRAFT)</h4>
            <p className="text-xs text-muted-foreground">
              Este conteúdo foi gerado automaticamente pela IA Sênior OMNI. Não possui caráter oficial nem validade diagnóstica até ser revisado e assinado digitalmente por um médico responsável.
            </p>
          </div>
        </div>
      )}

        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-4 animate-in slide-in-from-top duration-500">
          <ClipboardCheck className="h-5 w-5 text-emerald-500 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-emerald-500 uppercase">Documento Oficial Certificado</h4>
            <p className="text-[10px] text-muted-foreground">
              Certificado por: <span className="text-emerald-400 font-mono">{analysis.professional_tag_snapshot || 'Profissional Identificado'}</span> em {new Date(analysis.certified_at).toLocaleString('pt-BR')}
            </p>
            <p className="text-[9px] text-muted-foreground opacity-50">
              Integridade validada (SHA-256): <code className="bg-black/20 px-1 rounded">{analysis.output_hash?.substring(0, 16)}...</code>
            </p>
          </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sumário Estruturado */}
        <Card className="md:col-span-2 bg-card/30 border-white/5">
          <CardHeader>
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" /> RESUMO CLÍNICO ESTRUTURADO
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {analysis.structured_summary}
            </div>
          </CardContent>
        </Card>

        {/* Achados e Dados Faltantes */}
        <div className="space-y-6">
          <Card className="bg-emerald-500/5 border-emerald-500/10">
            <CardHeader className="py-3">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Achados Clínicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {analysis.clinical_findings?.map((f: string, i: number) => (
                <div key={i} className="text-xs flex items-center gap-2 text-muted-foreground">
                  <div className="h-1 w-1 rounded-full bg-emerald-500" /> {f}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-red-500/5 border-red-500/10">
            <CardHeader className="py-3">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-red-500">Dados Ausentes Críticos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {analysis.missing_data?.map((m: string, i: number) => (
                <div key={i} className="text-xs flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-3 w-3 text-red-500" /> {m}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rascunhos de Documentos Médicos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card/30 border-white/5 overflow-hidden">
          <CardHeader className="bg-white/5 border-b border-white/5 flex flex-row items-center justify-between py-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <FileEdit className="h-3.5 w-3.5" /> PRÉ-RELATÓRIO / PRÉ-LAUDO
            </CardTitle>
            <Badge variant="outline" className="text-[9px]">
              {isFinalized ? "ASSINADO" : "PENDENTE REVISÃO"}
            </Badge>
          </CardHeader>
          <CardContent className="p-4">
             <div className="text-xs text-muted-foreground italic h-40 overflow-y-auto">
               {analysis.pre_report_draft || "Rascunho de relatório clínico em processamento..."}
             </div>
          </CardContent>
        </Card>

        <Card className="bg-card/30 border-white/5 overflow-hidden">
          <CardHeader className="bg-white/5 border-b border-white/5 flex flex-row items-center justify-between py-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-yellow-500" /> PRÉ-DIAGNÓSTICO IA
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
             <div className="text-xs text-muted-foreground italic h-40 overflow-y-auto">
               {analysis.pre_diagnosis || "A análise diagnóstica será gerada após a consolidação total da consulta."}
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações de Oficialização */}
      {/* Ações de Conformidade Médica (Stage 5) */}
      {!isFinalized && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-primary/5 border-primary/20 p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-tight">Passo 1: Revisão Humana</p>
              <p className="text-[10px] text-muted-foreground">Confirme que leu e valida os termos assistivos do rascunho.</p>
            </div>
            <Button 
              size="sm"
              variant="outline"
              className="border-primary/50 text-primary hover:bg-primary/10"
              onClick={() => handleLogReview('APPROVE')}
              disabled={isReviewing || isStale}
            >
              Confirmar Revisão
            </Button>
          </Card>

          <Card className="bg-emerald-500/5 border-emerald-500/20 p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-tight text-emerald-500">Passo 2: Assinatura & CRM</p>
              <p className="text-[10px] text-muted-foreground">Vincule suas credenciais oficiais e torne o laudo imutável.</p>
            </div>
            <Button 
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
              onClick={handleCertify}
              disabled={isCertifying || isStale}
            >
              {isCertifying ? "Certificando..." : "Certificar Agora"}
            </Button>
          </Card>
        </div>
      )}
    </div>

  );
};
