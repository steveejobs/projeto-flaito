// src/components/nija/NijaStepper.tsx
// Componente de Stepper Premium para fluxo NIJA - Clicável e Responsivo

import { FileUp, Settings2, FileCheck, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NijaStepperProps {
  currentStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
  canNavigateToStep2?: boolean;
  canNavigateToStep3?: boolean;
  /** Se alguma operação está em andamento */
  isLoading?: boolean;
  /** Qual passo está carregando (exibe spinner) */
  loadingStep?: 1 | 2 | 3 | null;
}

export function NijaStepper({ 
  currentStep, 
  onStepClick,
  canNavigateToStep2 = true,
  canNavigateToStep3 = false,
  isLoading = false,
  loadingStep = null,
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

  return (
    <div className="w-full">
      {/* Desktop: Horizontal layout */}
      <div className="hidden sm:flex items-center justify-between relative">
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
              onKeyDown={(e) => {
                if (isClickable && (e.key === "Enter" || e.key === " ")) {
                  handleClick(s.step);
                }
              }}
            >
              <div
                className={cn(
                  "relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                  // Loading state (âmbar pulsante)
                  isLoading && loadingStep === s.step && "border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-110",
                  // Active normal (sem loading)
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
                <p
                  className={cn(
                    "text-sm font-medium transition-colors",
                    isActive && "text-primary",
                    isCompleted && "text-green-600",
                    !isActive && !isCompleted && "text-muted-foreground",
                    isClickable && !isActive && !isCompleted && "group-hover:text-primary"
                  )}
                >
                  {s.label}
                </p>
                <p className="text-xs text-muted-foreground hidden md:block">
                  {s.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: Compact horizontal layout */}
      <div className="flex sm:hidden items-center justify-between gap-1 px-2">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isActive = currentStep === s.step;
          const isCompleted = currentStep > s.step;
          const isClickable = canNavigate(s.step);

          return (
            <div key={s.step} className="flex items-center flex-1">
              <div 
                className={cn(
                  "flex items-center gap-2 flex-1",
                  isClickable && "cursor-pointer"
                )}
                onClick={() => handleClick(s.step)}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 shrink-0",
                    // Loading state (âmbar)
                    isLoading && loadingStep === s.step && "border-amber-500 bg-amber-500 text-white shadow-md scale-110",
                    // Active normal
                    isActive && !(isLoading && loadingStep === s.step) && "border-primary bg-primary text-primary-foreground shadow-md scale-110",
                    isCompleted && !(isLoading && loadingStep === s.step) && "border-green-500 bg-green-500 text-white",
                    !isActive && !isCompleted && !(isLoading && loadingStep === s.step) && "border-muted-foreground/30 bg-background text-muted-foreground"
                  )}
                >
                  {isLoading && loadingStep === s.step ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium truncate",
                    isActive && "text-primary",
                    isCompleted && "text-green-600",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {/* Connector line between steps */}
              {idx < steps.length - 1 && (
                <div 
                  className={cn(
                    "h-0.5 w-4 mx-1 rounded-full shrink-0",
                    currentStep > s.step ? "bg-green-500" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
