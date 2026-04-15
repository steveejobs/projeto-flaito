import React from "react";
import { AIAuditMetadata } from "../../types/ai-audit";
import { 
  Bot, 
  Building2, 
  Cpu, 
  ShieldAlert, 
  Fingerprint, 
  History,
  Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GovernanceTraceProps {
  audit: AIAuditMetadata;
}

/**
 * Componente de detalhe para a linhagem de governança da IA.
 * Exibe as informações técnicas de forma humana e premium.
 */
export const GovernanceTrace: React.FC<GovernanceTraceProps> = ({ audit }) => {
  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'GLOBAL': return "Padrão da Plataforma";
      case 'OFFICE': return "Personalização do Escritório";
      case 'STAGE': return "Configuração da Etapa";
      case 'FALLBACK': return "Modo de Contingência";
      default: return source;
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'GLOBAL': return <Bot className="h-4 w-4" />;
      case 'OFFICE': return <Building2 className="h-4 w-4" />;
      case 'STAGE': return <Cpu className="h-4 w-4" />;
      case 'FALLBACK': return <ShieldAlert className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'GLOBAL': return "text-slate-400 bg-slate-400/10 border-slate-400/20";
      case 'OFFICE': return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      case 'STAGE': return "text-violet-400 bg-violet-400/10 border-violet-400/20";
      case 'FALLBACK': return "text-amber-400 bg-amber-400/10 border-amber-400/20";
      default: return "text-muted-foreground bg-muted/10 border-muted/20";
    }
  };

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-[11px] font-black uppercase tracking-widest text-white/50">
          Rastro de Governança IA
        </h4>
        <Badge variant="outline" className="text-[9px] font-black uppercase bg-white/5 border-white/10 px-2 py-0">
          v{audit.config_version}
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Source Section */}
        <div className={`flex items-center gap-3 p-3 rounded-xl border border-dashed ${getSourceColor(audit.source_level)}`}>
          <div className="p-2 rounded-lg bg-black/20">
            {getSourceIcon(audit.source_level)}
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-tighter opacity-60">Origem da Lógica</span>
            <span className="text-xs font-bold leading-none">{getSourceLabel(audit.source_level)}</span>
          </div>
        </div>

        {/* Fallback Alert if active */}
        {audit.fallback_used && (
          <div className="flex gap-3 items-start bg-amber-400/5 p-3 rounded-xl border border-amber-400/10">
            <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Modo de Contingência</span>
              <p className="text-[9px] text-amber-300/80 leading-relaxed font-medium italic">
                O modelo padrão foi alterado temporariamente por restrições técnicas.
              </p>
            </div>
          </div>
        )}

        {/* Technical IDs */}
        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2 text-muted-foreground font-bold uppercase tracking-tighter">
              <Fingerprint className="h-3 w-3 opacity-40" />
              Config ID
            </div>
            <code className="text-[9px] font-mono opacity-60">{audit.config_id.slice(0, 8)}...</code>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2 text-muted-foreground font-bold uppercase tracking-tighter">
              <History className="h-3 w-3 opacity-40" />
              Agente
            </div>
            <span className="text-[9px] font-mono opacity-60">{audit.agent_slug}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
