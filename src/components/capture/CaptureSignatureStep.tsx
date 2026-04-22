import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, RotateCcw, Trash2, ShieldCheck, Check, AlertTriangle, Link2, Copy, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignatureCanvas, SignatureCanvasApi } from "@/components/SignatureCanvas";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CaptureSignatureStepProps {
  signatureDataUrl: string | null;
  onSignatureChange: (dataUrl: string | null) => void;
  lgpdAccepted: boolean;
  onLgpdChange: (accepted: boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  clientName?: string;
  officeSlug?: string;
  onTokenChange?: (token: string | null) => void;
}

export function CaptureSignatureStep({
  signatureDataUrl,
  onSignatureChange,
  lgpdAccepted,
  onLgpdChange,
  onSubmit,
  onBack,
  submitting,
  clientName,
  officeSlug,
  onTokenChange,
}: CaptureSignatureStepProps) {
  const [signatureApi, setSignatureApi] = useState<SignatureCanvasApi | null>(null);
  const [isSignatureValid, setIsSignatureValid] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [remoteLink, setRemoteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  const handleSignatureReady = (api: SignatureCanvasApi) => {
    setSignatureApi(api);
  };

  const handleValidChange = (isValid: boolean) => {
    setIsSignatureValid(isValid);
    setHasDrawn(!signatureApi?.isEmpty());
    
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

  const handleGenerateRemoteLink = async () => {
    setGeneratingLink(true);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Gerar token único
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72h

      // Obter office_id pelo slug
      let officeId: string | null = null;

      if (officeSlug) {
        const officeRes = await fetch(
          `${SUPABASE_URL}/functions/v1/public-client-registration?officeSlug=${encodeURIComponent(officeSlug)}`,
          { headers: { apikey: SUPABASE_ANON_KEY, "x-frontend-client": "flaito-app" } }
        );
        const officeData = await officeRes.json();
        if (officeData.ok) {
          officeId = officeData.office.id;
        }
      }

      if (!officeId) {
        throw new Error("Não foi possível identificar o escritório");
      }

      // Inserir signature_link via REST API do Supabase
      const res = await fetch(`${SUPABASE_URL}/rest/v1/signature_links`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          token,
          office_id: officeId,
          client_name: clientName || "Cliente",
          expires_at: expiresAt,
          status: "pending",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Erro ao criar link:", err);
        throw new Error("Erro ao gerar link de assinatura. Verifique se a tabela signature_links existe.");
      }

      const appBaseUrl = window.location.origin;
      const link = `${appBaseUrl}/assinatura/${token}`;
      setRemoteLink(link);
      onTokenChange?.(token);
      toast.success("Link gerado! Copie e envie ao cliente.");
    } catch (err: unknown) {
      console.error("Erro ao gerar link remoto:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao gerar link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!remoteLink) return;
    try {
      await navigator.clipboard.writeText(remoteLink);
      setLinkCopied(true);
      toast.success("Link copiado! Envie por WhatsApp ou e-mail ao cliente.");
      setTimeout(() => setLinkCopied(false), 3000);
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione o link manualmente.");
    }
  };

  // Monitorar link remoto para capturar a assinatura automaticamente
  useEffect(() => {
    let interval: number | null = null;

    if (remoteLink && !signatureDataUrl) {
      const token = remoteLink.split("/").pop();
      if (token) {
        // Poll every 3 seconds
        interval = window.setInterval(async () => {
          const { data, error } = await supabase
            .from("signature_links")
            .select("signature_base64, status")
            .eq("token", token)
            .single();

          if (!error && data?.signature_base64 && data.status === "completed") {
            onSignatureChange(data.signature_base64);
            setIsSignatureValid(true);
            setHasDrawn(true);
            toast.success("✅ Assinatura recebida do celular!");
            if (interval) window.clearInterval(interval);
          }
        }, 3000);
      }
    }

    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [remoteLink, signatureDataUrl, onSignatureChange]);

  // Permite submeter quando: (1) assinatura local válida OU (2) assinatura remota recebida via polling
  const hasRemoteSignature = !!signatureDataUrl && !isSignatureValid;
  const canSubmit = (isSignatureValid || hasRemoteSignature) && lgpdAccepted && !submitting;

  return (
    <div className="space-y-5 capture-animate-in">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-white tracking-tight">
          Assinatura do Cliente
        </h2>
        <p className="text-base text-white/50 mt-1">
          Assine no espaço abaixo com o dedo ou mouse
        </p>
      </div>

      {/* Signature canvas */}
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

      {/* Mensagem de segurança */}
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

      {/* Botões de ação */}
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

      {/* Assinatura Remota */}
      <div className="mt-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/30 uppercase tracking-widest font-medium">Alternativa</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {!remoteLink ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateRemoteLink}
            disabled={generatingLink}
            className="w-full border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200 flex items-center justify-center gap-2"
          >
            {generatingLink ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Link2 className="w-4 h-4 shrink-0" />
            )}
            <div className="text-left">
              <span className="font-medium block">Enviar link para assinatura remota</span>
              <span className="text-[11px] text-white/40 uppercase tracking-wide">O cliente assina do próprio celular</span>
            </div>
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Link gerado! Válido por 72 horas.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-xs text-white/60 truncate font-mono">
                {remoteLink}
              </div>
              <Button
                type="button"
                onClick={handleCopyLink}
                className={cn(
                  "shrink-0 h-auto px-4 rounded-lg transition-all duration-200 border",
                  linkCopied
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                )}
              >
                {linkCopied ? (
                  <CheckCheck className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-white/40">
              Envie por WhatsApp, e-mail ou SMS. O cliente abre e assina no celular.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
