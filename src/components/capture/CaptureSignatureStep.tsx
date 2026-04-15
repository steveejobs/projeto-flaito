import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, RotateCcw, Trash2, ShieldCheck, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignatureCanvas, SignatureCanvasApi } from "@/components/SignatureCanvas";

interface CaptureSignatureStepProps {
  signatureDataUrl: string | null;
  onSignatureChange: (dataUrl: string | null) => void;
  lgpdAccepted: boolean;
  onLgpdChange: (accepted: boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}

export function CaptureSignatureStep({
  signatureDataUrl,
  onSignatureChange,
  lgpdAccepted,
  onLgpdChange,
  onSubmit,
  onBack,
  submitting,
}: CaptureSignatureStepProps) {
  const [signatureApi, setSignatureApi] = useState<SignatureCanvasApi | null>(null);
  const [isSignatureValid, setIsSignatureValid] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const handleSignatureReady = (api: SignatureCanvasApi) => {
    setSignatureApi(api);
  };

  const handleValidChange = (isValid: boolean) => {
    setIsSignatureValid(isValid);
    setHasDrawn(!signatureApi?.isEmpty());
    
    // Update parent with signature data
    if (signatureApi && isValid) {
      onSignatureChange(signatureApi.getDataUrl());
    } else if (!isValid) {
      onSignatureChange(null);
    }
  };

  const handleClear = () => {
    signatureApi?.clear();
    setIsSignatureValid(false);
    setHasDrawn(false);
    onSignatureChange(null);
  };

  const canSubmit = isSignatureValid && lgpdAccepted && !submitting;

  return (
    <div className="space-y-5 capture-animate-in">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-white tracking-tight">
          Sua Assinatura
        </h2>
        <p className="text-base text-white/50 mt-1">
          Assine no espaço abaixo com o dedo ou mouse
        </p>
      </div>

      {/* Signature canvas - using unified component */}
      <div className="rounded-xl overflow-hidden border border-white/20 shadow-lg">
        <SignatureCanvas
          onReady={handleSignatureReady}
          minCoverage={0.5}
          onValidChange={handleValidChange}
          width={1600}
          height={500}
        />
      </div>

      {/* Validation feedback */}
      <div className="flex items-center justify-center gap-2">
        {isSignatureValid ? (
          <span className="text-sm text-emerald-400 flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            Assinatura válida
          </span>
        ) : hasDrawn ? (
          <span className="text-sm text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Assinatura muito pequena - continue desenhando
          </span>
        ) : (
          <span className="text-sm text-white/50">
            Desenhe sua assinatura no campo acima
          </span>
        )}
      </div>

      {/* Canvas controls */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="flex-1 bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white active:scale-[0.98] transition-all duration-200"
        >
          <Trash2 className="w-4 h-4 mr-1.5" />
          Limpar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="flex-1 bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white active:scale-[0.98] transition-all duration-200"
        >
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Refazer
        </Button>
      </div>

      {/* Preview */}
      {signatureDataUrl && isSignatureValid && (
        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-white/50 mb-2">Preview da assinatura:</p>
          <img
            src={signatureDataUrl}
            alt="Preview"
            className="h-20 w-auto mx-auto"
          />
        </div>
      )}

      {/* LGPD checkbox */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
        <Checkbox
          id="lgpd"
          checked={lgpdAccepted}
          onCheckedChange={(checked) => onLgpdChange(checked === true)}
          className="mt-1 w-5 h-5 border-white/30 data-[state=checked]:bg-[var(--brand-primary)] data-[state=checked]:border-[var(--brand-primary)]"
        />
        <Label
          htmlFor="lgpd"
          className="text-base text-white/80 leading-relaxed cursor-pointer"
        >
          Li e aceito a{" "}
          <a href="#" className="underline text-white hover:text-white/80">
            Política de Privacidade
          </a>{" "}
          e autorizo o tratamento dos meus dados conforme a LGPD.
        </Label>
      </div>

      {/* Mensagem de segurança obrigatória */}
      <div className="flex items-center justify-center gap-2 text-sm text-white/40 py-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400/60" />
        <span>Ambiente protegido por criptografia</span>
      </div>

      {/* Honeypot */}
      <input
        type="text"
        name="hp"
        autoComplete="off"
        tabIndex={-1}
        className="absolute -left-[9999px] opacity-0 pointer-events-none"
      />

      {/* Footer */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={submitting}
          className="flex-1 text-white/70 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all duration-200"
        >
          Voltar
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={cn(
            "flex-1 font-bold h-12 rounded-xl border-none shadow-xl transition-all duration-200",
            canSubmit 
              ? "bg-white text-black hover:bg-white/90 active:scale-[0.98]" 
              : "bg-white/20 text-white/40 cursor-not-allowed opacity-50"
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Finalizando...
            </>
          ) : (
            "Finalizar Cadastro"
          )}
        </Button>
      </div>
    </div>
  );
}
