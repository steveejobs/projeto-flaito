import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SignatureCanvas, SignatureCanvasApi } from "@/components/SignatureCanvas";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, Pen, Trash2 } from "lucide-react";

type LinkStatus = "loading" | "valid" | "expired" | "used" | "invalid" | "success";

export default function PublicSignaturePage() {
    const { token } = useParams<{ token: string }>();

    const [status, setStatus] = useState<LinkStatus>("loading");
    const [clientName, setClientName] = useState("");
    const [officeName, setOfficeName] = useState("");
    const [linkId, setLinkId] = useState<string | null>(null);
    const [clientId, setClientId] = useState<string | null>(null);
    const [officeId, setOfficeId] = useState<string | null>(null);

    const [signatureApi, setSignatureApi] = useState<SignatureCanvasApi | null>(null);
    const [consent, setConsent] = useState(false);
    const [saving, setSaving] = useState(false);

    // Load link data
    useEffect(() => {
        if (!token) {
            setStatus("invalid");
            return;
        }

        const load = async () => {
            const { data, error } = await supabase
                .from("signature_links")
                .select("id, client_id, office_id, expires_at, used_at, status, clients(full_name), offices(name)")
                .eq("token", token)
                .maybeSingle();

            if (error || !data) {
                setStatus("invalid");
                return;
            }

            if ((data as any).status === "completed" || (data as any).used_at) {
                setStatus("used");
                return;
            }

            if (new Date((data as any).expires_at) < new Date()) {
                setStatus("expired");
                return;
            }

            setLinkId((data as any).id);
            setClientId((data as any).client_id);
            setOfficeId((data as any).office_id);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setClientName((data as any).clients?.full_name || "Cliente");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setOfficeName((data as any).offices?.name || "Escritório");
            setStatus("valid");
        };

        load();
    }, [token]);

    const handleSave = async () => {
        if (!signatureApi || !consent || !clientId || !officeId || !linkId) return;
        if (signatureApi.isEmpty()) return;

        setSaving(true);
        try {
            const dataUrl = signatureApi.getDataUrl();
            const signedHash = btoa(Date.now().toString() + clientId).slice(0, 32);

            // Save signature
            const { error: sigError } = await supabase.from("e_signatures").insert({
                office_id: officeId,
                client_id: clientId,
                case_id: null,
                generated_document_id: null,
                signer_type: "cliente",
                signer_name: clientName,
                signer_doc: null,
                signer_email: null,
                signer_phone: null,
                signature_base64: dataUrl,
                signed_hash: signedHash,
                signed_at: new Date().toISOString(),
                ip: null,
                user_agent: navigator.userAgent || null,
                metadata: { via: "signature_link" },
            });

            if (sigError) throw sigError;

            // Mark link as used
            await supabase
                .from("signature_links")
                .update({ status: "completed", used_at: new Date().toISOString() })
                .eq("id", linkId);

            setStatus("success");
        } catch (err) {
            console.error("[Lexos] Erro ao salvar assinatura remota:", err);
        } finally {
            setSaving(false);
        }
    };

    // ─── Status screens ──────────────────────────────────────────────────────────

    if (status === "loading") {
        return (
            <Screen>
                <Loader2 className="h-10 w-10 animate-spin text-slate-400 mx-auto" />
                <p className="text-slate-500 mt-3 text-center">Carregando...</p>
            </Screen>
        );
    }

    if (status === "expired") {
        return (
            <Screen>
                <AlertCircle className="h-12 w-12 text-amber-400 mx-auto" />
                <h2 className="text-xl font-semibold text-center mt-3">Link expirado</h2>
                <p className="text-slate-500 text-center text-sm mt-2">
                    Este link de assinatura expirou. Peça ao escritório um novo link.
                </p>
            </Screen>
        );
    }

    if (status === "used") {
        return (
            <Screen>
                <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
                <h2 className="text-xl font-semibold text-center mt-3">Assinatura já realizada</h2>
                <p className="text-slate-500 text-center text-sm mt-2">
                    Você já assinou por este link. Obrigado!
                </p>
            </Screen>
        );
    }

    if (status === "invalid") {
        return (
            <Screen>
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
                <h2 className="text-xl font-semibold text-center mt-3">Link inválido</h2>
                <p className="text-slate-500 text-center text-sm mt-2">
                    Este link não existe. Verifique com o escritório.
                </p>
            </Screen>
        );
    }

    if (status === "success") {
        return (
            <Screen>
                <div className="flex flex-col items-center gap-3">
                    <CheckCircle2 className="h-16 w-16 text-emerald-400" />
                    <h2 className="text-2xl font-bold text-center">Assinatura enviada!</h2>
                    <p className="text-slate-500 text-center text-sm">
                        Sua assinatura foi registrada com sucesso. Você pode fechar esta página.
                    </p>
                </div>
            </Screen>
        );
    }

    // ─── Main signing page ────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b px-4 py-4">
                <div className="max-w-lg mx-auto">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">{officeName}</p>
                    <h1 className="text-lg font-bold text-slate-800 mt-0.5">Assinatura do cliente</h1>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-4 py-6">
                <div className="max-w-lg mx-auto space-y-5">
                    {/* Client info */}
                    <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <Pen className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Assinante</p>
                            <p className="font-semibold text-slate-800">{clientName}</p>
                        </div>
                    </div>

                    {/* Instructions */}
                    <p className="text-sm text-slate-500 text-center">
                        Assine no campo abaixo usando o dedo. Tente preencher o espaço com traços contínuos.
                    </p>

                    {/* Canvas */}
                    <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
                        <SignatureCanvas
                            onReady={setSignatureApi}
                            className="w-full h-[220px]"
                            showValidation
                            onValidChange={undefined}
                        />
                    </div>

                    {/* Clear button */}
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-slate-500"
                            onClick={() => signatureApi?.clear()}
                        >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Limpar
                        </Button>
                    </div>

                    {/* Consent */}
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-white border">
                        <Checkbox
                            id="consent"
                            checked={consent}
                            onCheckedChange={(v) => setConsent(!!v)}
                            className="mt-0.5"
                        />
                        <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer text-slate-700">
                            Confirmo que esta assinatura representa minha vontade e autorizo sua utilização para fins de representação legal.
                        </Label>
                    </div>

                    {/* Submit */}
                    <Button
                        className="w-full h-12 text-base font-semibold shadow-lg active:scale-95 transition-transform"
                        disabled={!consent || saving || !signatureApi || signatureApi.isEmpty()}
                        onClick={handleSave}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            "Confirmar assinatura"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Simple centered layout for status screens
function Screen({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12">
            <div className="bg-white rounded-2xl border shadow-sm p-8 max-w-sm w-full space-y-2">
                {children}
            </div>
        </div>
    );
}
