import React, { useState } from "react";
import { AIAuditMetadata } from "../../types/ai-audit";
import { 
  Bot, 
  Building2, 
  Cpu, 
  ShieldAlert, 
  CheckCircle2
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GovernanceTrace } from "./GovernanceTrace";

import { useOfficeRole } from "@/hooks/useOfficeRole";

interface AuditSealProps {
  audit?: AIAuditMetadata | null;
  className?: string;
  showOnlyToAdmins?: boolean;
}

/**
 * Micro-componente discreto para a linhagem da IA (Trust Chain).
 * Aparece no canto inferior direito das mensagens ou resultados de IA.
 */
export const AuditSeal: React.FC<AuditSealProps> = ({ 
  audit, 
  className = "", 
  showOnlyToAdmins = true 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { role, loading } = useOfficeRole();

  // Se não houver auditoria, não renderiza nada (Noise Reduction)
  if (!audit) return null;

  // Verificação de permissão: apenas OWNER ou ADMIN veem a auditoria
  // se showOnlyToAdmins for verdadeiro (padrão)
  const isAuthorized = !showOnlyToAdmins || (role === 'OWNER' || role === 'ADMIN');
  
  if (loading || !isAuthorized) return null;

  const getSourceConfig = (source: string) => {
    switch (source) {
      case 'GLOBAL': return { color: "text-slate-400 bg-slate-400/5 hover:bg-slate-400/10 border-slate-400/10", icon: <Bot className="h-3 w-3" />, label: "Global" };
      case 'OFFICE': return { color: "text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 border-emerald-400/20 shadow-[0_0_12px_rgba(52,211,153,0.1)]", icon: <Building2 className="h-3 w-3" />, label: "Escritório" };
      case 'STAGE': return { color: "text-violet-400 bg-violet-400/10 hover:bg-violet-400/20 border-violet-400/20 shadow-[0_0_12px_rgba(139,92,246,0.1)]", icon: <Cpu className="h-3 w-3" />, label: "Pipeline" };
      case 'FALLBACK': return { color: "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 border-amber-400/20", icon: <ShieldAlert className="h-3 w-3" />, label: "Contingência" };
      default: return { color: "text-muted-foreground bg-muted/10 border-muted/20", icon: <CheckCircle2 className="h-3 w-3" />, label: "IA" };
    }
  };

  const config = getSourceConfig(audit.source_level);

  return (
    <div className={`inline-flex items-center absolute bottom-2 right-2 pointer-events-auto z-10 ${className}`}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button 
                  className={`
                    flex items-center gap-1.5 px-2 py-0.5 rounded-md border
                    transition-all duration-500 ease-out 
                    text-[9px] font-black uppercase tracking-widest
                    ${config.color}
                    hover:scale-105 active:scale-95
                    ${isOpen ? 'ring-2 ring-violet-500/30' : ''}
                  `}
                >
                  {config.icon}
                  <span className="opacity-80">v{audit.config_version}</span>
                  {audit.fallback_used && <div className="h-1 w-1 rounded-full bg-amber-400 animate-pulse ml-0.5" />}
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent 
              side="left" 
              className="bg-card/80 backdrop-blur-xl border-white/10 text-[9px] font-black uppercase tracking-widest"
            >
              Rastro de IA: {config.label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <PopoverContent 
          side="top" 
          align="end" 
          className="w-72 bg-card/60 backdrop-blur-3xl border-white/5 p-4 shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200"
        >
          <GovernanceTrace audit={audit} />
        </PopoverContent>
      </Popover>
    </div>
  );
};
