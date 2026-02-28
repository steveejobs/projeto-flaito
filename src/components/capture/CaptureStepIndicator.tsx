import { cn } from "@/lib/utils";

interface Step {
  key: string;
  label: string;
}

interface CaptureStepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function CaptureStepIndicator({ steps, currentStep }: CaptureStepIndicatorProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="mb-6">
      {/* Progress bar */}
      <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-3">
        <div
          className="h-full transition-all duration-300 ease-out rounded-full"
          style={{
            width: `${progress}%`,
            backgroundColor: "var(--brand-primary)",
          }}
        />
      </div>

      {/* Step info */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/60">
          Passo {currentStep + 1} de {steps.length}
        </span>
        <span className="text-sm font-medium text-white">
          {steps[currentStep]?.label}
        </span>
      </div>
    </div>
  );
}
