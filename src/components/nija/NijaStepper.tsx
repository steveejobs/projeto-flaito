// src/components/nija/NijaStepper.tsx
// Componente de Stepper Premium para fluxo NIJA - Clicável e Responsivo
// Ampliado para suportar o orquestrador MAESTRO com micro-etapas

import { FileUp, Settings2, FileCheck, CheckCircle2, Loader2, Brain, Shield, Zap, Swords, Target, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type MaestroStage = 
  | "INICIANDO"
  | "DOSSIÊ"
  | "ESTRATÉGIA"
  | "GERAÇÃO"
  | "REVISÃO"
  | "JUIZ_IA"
  | "REFINAMENTO"
  | "FINALIZANDO"
  | "CONCLUÍDO"
  | null;

export interface NijaStepperProps {
  currentStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
  canNavigateToStep2?: boolean;
  canNavigateToStep3?: boolean;
  /** Se alguma operação está em andamento */
  isLoading?: boolean;
  /** Qual passo está carregando (exibe spinner) */
  loadingStep?: 1 | 2 | 3 | null;
  /** Etapa real do orquestrador Maestro */
  maestroStage?: MaestroStage;
}

const MAESTRO_STEPS: { stage: MaestroStage; label: string; icon: any }[] = [
  { stage: "DOSSIÊ", label: "Dossiê", icon: Search },
  { stage: "ESTRATÉGIA", label: "Estratégia", icon: Target },
  { stage: "GERAÇÃO", label: "Minuta", icon: Zap },
  { stage: "REVISÃO", label: "Auditoria", icon: Shield },
  { stage: "JUIZ_IA", label: "Juiz IA", icon: Brain },
];

export function NijaStepper({ 
  currentStep, 
  onStepClick,
  canNavigateToStep2 = true,
  canNavigateToStep3 = false,
  isLoading = false,
  loadingStep = null,
  maestroStage = null,
}: NijaStepperProps) {
  const steps = [
    { step: 1 as const, label: "Documentos", description: "Enviar arquivos", icon: FileUp },
    { step: 2 as const, label: "Configurar", description: "Ajustar análise", icon: Settings2 },
    { step: 3 as const, label: "Resultado", description: "Ver diagnóstico", icon: FileCheck },
  ];

  const canNavigate = (step: 1 | 2 | 3) => {
    if (!onStepClick) return false;
    if (step === 1) return true;
    if (step === 2) return canNavigateToStep2;
    if (step === 3) return canNavigateToStep3;
    return false;
  };

  const handleClick = (step: 1 | 2 | 3) => {
    if (canNavigate(step) && onStepClick) {
      onStepClick(step);
    }
  };

  // Helper para saber se uma etapa do Maestro já passou
  const getMaestroStageIndex = (stage: MaestroStage) => {
    return MAESTRO_STEPS.findIndex(s => s.stage === stage);
  };

  const currentMaestroIdx = getMaestroStageIndex(maestroStage);

  return (
    <div className="w-full space-y-6">
      {/* Principal Stepper */}
      <div className="hidden sm:flex items-center justify-between relative px-4">
        {/* Progress bar background */}
        <div className="absolute top-5 left-0 right-0 h-1 bg-muted rounded-full mx-16" />
        
        {/* Progress bar fill */}
        <div 
          className="absolute top-5 left-0 h-1 bg-gradient-to-r from-primary to-primary/80 rounded-full mx-16 transition-all duration-500"
          style={{ 
            width: currentStep === 1 ? '0%' : currentStep === 2 ? 'calc(50% - 2rem)' : 'calc(100% - 4rem)'
          }}
        />
        
        {steps.map((s) => {
          const Icon = s.icon;
          const isActive = currentStep === s.step;
          const isCompleted = currentStep > s.step;
          const isClickable = canNavigate(s.step);

          return (
            <div 
              key={s.step} 
              className={cn(
                "flex flex-col items-center gap-2 z-10 flex-1 transition-all",
                isClickable && "cursor-pointer group"
              )}
              onClick={() => handleClick(s.step)}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
            >
              <div
                className={cn(
                  "relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                  isLoading && loadingStep === s.step && "border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-110",
                  isActive && !(isLoading && loadingStep === s.step) && "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110",
                  isCompleted && !(isLoading && loadingStep === s.step) && "border-green-500 bg-green-500 text-white",
                  !isActive && !isCompleted && !(isLoading && loadingStep === s.step) && "border-muted-foreground/30 bg-background text-muted-foreground",
                  isClickable && !isActive && !isCompleted && "group-hover:border-primary/50 group-hover:bg-primary/10",
                  isClickable && isCompleted && "group-hover:scale-105"
                )}
              >
                {isLoading && loadingStep === s.step ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
                {isActive && !(isLoading && loadingStep === s.step) && (
                  <span className="absolute -inset-1 rounded-full border-2 border-primary/30 animate-pulse" />
                )}
              </div>
              <div className="text-center">
                <p className={cn(
                    "text-sm font-medium transition-colors",
                    isActive && "text-primary",
                    isCompleted && "text-green-600",
                    !isActive && !isCompleted && "text-muted-foreground"
                )}>{s.label}</p>
                <p className="text-[10px] text-muted-foreground hidden md:block uppercase tracking-wider">{s.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* MAESTRO SUB-STEPPER (Aparece apenas quando o Maestro está rodando) */}
      {isLoading && loadingStep === 2 && maestroStage && (
        <div className="flex flex-col items-center gap-4 py-2 animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="flex items-center justify-center gap-2 md:gap-6 flex-wrap px-4">
             {MAESTRO_STEPS.map((ms, idx) => {
               const MIcon = ms.icon;
               const isMActive = maestroStage === ms.stage;
               const isMCompleted = currentMaestroIdx > idx || maestroStage === "FINALIZANDO" || maestroStage === "CONCLUÍDO";
               
               return (
                 <div key={ms.stage} className="flex items-center gap-2">
                   <div className={cn(
                     "flex items-center gap-1.5 px-2 py-1 rounded-full border transition-all duration-300",
                     isMActive && "bg-primary/10 border-primary text-primary shadow-sm scale-110",
                     isMCompleted && "bg-green-500/10 border-green-500 text-green-600",
                     !isMActive && !isMCompleted && "bg-muted/30 border-transparent text-muted-foreground opacity-50"
                   )}>
                     {isMActive ? (
                       <Loader2 className="h-3 w-3 animate-spin" />
                     ) : isMCompleted ? (
                       <CheckCircle2 className="h-3 w-3" />
                     ) : (
                       <MIcon className="h-3 w-3" />
                     )}
                     <span className="text-[10px] font-bold uppercase tracking-tight">{ms.label}</span>
                   </div>
                   {idx < MAESTRO_STEPS.length - 1 && (
                     <div className={cn("h-px w-2 md:w-4 bg-muted", isMCompleted && "bg-green-500/30")} />
                   )}
                 </div>
               );
             })}
           </div>
           
           <div className="text-center space-y-1">
             <div className="flex items-center justify-center gap-2">
                <Brain className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-xs font-semibold text-foreground italic">
                    {maestroStage === "REFINAMENTO" ? "Loop de Feedback: Refinando peça com base no Juiz IA..." :
                     maestroStage === "FINALIZANDO" ? "Consolidando resultados finais..." :
                     `Etapa atual: ${maestroStage}`}
                </span>
             </div>
             <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em]">Fluxo Maestro – Inteligência Jurídica Flaito</p>
           </div>
        </div>
      )}

      {/* Mobile labels (only) */}
      <div className="flex sm:hidden items-center justify-between px-6">
          {steps.map(s => (
              <span key={s.step} className={cn(
                  "text-[10px] font-bold uppercase tracking-widest",
                  currentStep === s.step ? "text-primary" : "text-muted-foreground/50"
              )}>{s.label}</span>
          ))}
      </div>
    </div>
  );
}
