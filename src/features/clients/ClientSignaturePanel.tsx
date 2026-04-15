import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignatureCanvas, SignatureCanvasApi } from "@/components/SignatureCanvas";
import { Pen, Loader2, CheckCircle2, Trash2, FileText, Link2, Copy, Check as CheckIcon, Maximize2, Minimize2, ExternalLink } from "lucide-react";
import { autoGenerateClientKit } from "@/lib/clientKit";

interface ClientSignature {
  id: string;
  client_id: string;
  client_name: string;
  office_id: string;
  signer_type: string;
  signer_name: string;
  signer_doc: string | null;
  signer_email: string | null;
  signer_phone: string | null;
  signature_base64: string | null;
  signed_at: string | null;
  signature_status?: string | null;
}

interface ClientData {
  id: string;
  full_name: string;
  person_type: "PF" | "PJ" | null;
  cpf: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  representative_name: string | null;
  representative_cpf: string | null;
  office_id: string;
}

interface ClientSignaturePanelProps {
  clientId: string;
}

export function ClientSignaturePanel({ clientId }: ClientSignaturePanelProps) {
  const { toast } = useToast();

  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [loadingSignatures, setLoadingSignatures] = useState(true);
  const [clientSignatures, setClientSignatures] = useState<ClientSignature[]>([]);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [signatureApi, setSignatureApi] = useState<SignatureCanvasApi | null>(null);

  // States for signature collection
  const [confirmConsent, setConfirmConsent] = useState(false);

  // States for remote signature link
  const [generatingLink, setGeneratingLink] = useState(false);
  const [remoteLink, setRemoteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const loadClientAndSignatures = useCallback(async () => {
    if (!clientId) return;

    setLoadingSignatures(true);

    try {
      // Load client data
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, full_name, person_type, representative_name, representative_cpf, cpf, cnpj, email, phone, office_id")
        .eq("id", clientId)
        .maybeSingle();

      if (clientError) {
        console.error("[Lexos] Erro ao carregar cliente:", clientError);
      } else if (client) {
        setClientData(client);
      }

      // Load signatures from view
      const { data: signatures, error: sigError } = await supabase
        .from("vw_client_signatures")
        .select("*")
        .eq("client_id", clientId)
        .order("signed_at", { ascending: false });

      if (sigError) {
        console.error("[Lexos] Erro ao carregar assinaturas:", sigError);
      } else {
        setClientSignatures((signatures as any) || []);
      }
    } catch (err) {
      console.error("[Lexos] Erro inesperado:", err);
    } finally {
      setLoadingSignatures(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClientAndSignatures();
  }, [loadClientAndSignatures]);


  const handleSaveSignature = async () => {
    if (!clientData || !signatureApi) return;


    if (!confirmConsent) {
      toast({
        title: "Confirmação necessária",
        description: "Por favor, confirme que a assinatura foi coletada com consentimento.",
        variant: "destructive",
      });
      return;
    }

    const dataUrl = signatureApi.getDataUrl();
    if (!dataUrl) return;

    setSavingSignature(true);

    try {
      // Generate a simple hash for signed_hash (required field)
      const signedHash = btoa(Date.now().toString() + clientData.id).slice(0, 32);

      const { error } = await supabase
        .from("e_signatures")
        .insert({
          office_id: clientData.office_id,
          client_id: clientData.id,
          case_id: null,
          generated_document_id: null,
          signer_type: "cliente",
          signer_name: clientData.person_type === "PJ" && clientData.representative_name
            ? clientData.representative_name
            : clientData.full_name,
          signer_doc: clientData.person_type === "PJ" && clientData.representative_cpf
            ? clientData.representative_cpf
            : (clientData.cpf || clientData.cnpj || null),
          signer_email: clientData.email || null,
          signer_phone: clientData.phone || null,
          signature_base64: dataUrl,
          signed_hash: signedHash,
          signed_at: new Date().toISOString(),
          ip: null,
          user_agent: navigator.userAgent || null,
          metadata: {},
        });

      if (error) {
        console.error("[Lexos] Erro ao salvar assinatura:", error);
        toast({
          title: "Erro ao salvar assinatura",
          description: "Não foi possível registrar a assinatura. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Assinatura registrada",
        description: "A assinatura do cliente foi salva com sucesso.",
      });

      setSignatureModalOpen(false);

      // Reload signatures
      await loadClientAndSignatures();

      // ====== GERAR KIT APÓS ASSINATURA ======
      // Verificar se já existe PROC ou DECL para evitar duplicação
      const { data: existingKit } = await supabase
        .from("client_files")
        .select("kind")
        .eq("client_id", clientData.id)
        .in("kind", ["KIT_PROCURACAO", "KIT_DECLARACAO"]);

      const hasProc = existingKit?.some(f => f.kind === "KIT_PROCURACAO");
      const hasDecl = existingKit?.some(f => f.kind === "KIT_DECLARACAO");

      if (hasProc && hasDecl) {
        toast({
          title: "KIT já existente",
          description: "Procuração e Declaração já foram geradas para este cliente.",
        });
        return;
      }

      // Gerar PROC + DECL
      toast({
        title: "Gerando Procuração e Declaração...",
        description: "Aguarde enquanto os documentos são criados.",
      });

      const kitResult = await autoGenerateClientKit(clientData.id, "BASIC");

      if (kitResult.ok) {
        toast({
          title: "KIT inicial gerado",
          description: "Procuração e Declaração criados com sucesso!",
        });
      } else {
        toast({
          title: "Assinatura salva, mas houve erro ao gerar o KIT",
          description: kitResult.reason || "Não foi possível gerar Procuração e Declaração.",
          variant: "destructive",
        });
      }

    } catch (err) {
      console.error("[Lexos] Erro inesperado ao salvar:", err);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível salvar a assinatura.",
        variant: "destructive",
      });
    } finally {
      setSavingSignature(false);
    }
  };

  const handleOpenModal = () => {
    setSignatureApi(null);
    setConfirmConsent(false);
    setSignatureModalOpen(true);
  };

  const handleClear = () => {
    signatureApi?.clear();
  };

  const handleGenerateLink = async () => {
    if (!clientData) return;
    setGeneratingLink(true);
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("signature_links")
        .insert({
          client_id: clientData.id,
          office_id: clientData.office_id,
          expires_at: expiresAt,
          status: "pending",
        })
        .select("token")
        .single();

      if (error || !data) throw error;

      const link = `${window.location.origin}/assinar/${(data as any).token}`;
      setRemoteLink(link);
    } catch (err: any) {
      console.error("[Lexos] Erro ao gerar link:", err);
      toast({
        title: "Erro ao gerar link (Detalhado)",
        description: err?.message || JSON.stringify(err) || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!remoteLink) return;
    await navigator.clipboard.writeText(remoteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };


  // Verificar se tem assinatura válida (COLLECTED manual ou signature_base64 presente)
  const hasValidSignature = clientSignatures.some(
    sig => sig.signature_status === "COLLECTED" || sig.signature_base64
  );
  const latestSignature = clientSignatures[0];
  const canSave = confirmConsent && !savingSignature;

  if (loadingSignatures) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando assinatura...
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">

        {/* Sem assinatura */}
        {!hasValidSignature ? (
          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/10 text-center space-y-3">
              <Pen className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma assinatura coletada ainda.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={handleOpenModal}
                className="flex-1 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-600 dark:hover:text-emerald-400 transition-colors btn-tactile"
              >
                <Pen className="h-4 w-4 mr-2" />
                Coletar presencialmente
              </Button>

              {/* Remote link */}
              {remoteLink ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border text-sm">
                  <ExternalLink className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span className="flex-1 truncate text-slate-600 dark:text-slate-400 font-mono text-xs">{remoteLink}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={handleCopyLink}>
                    {linkCopied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleGenerateLink}
                  disabled={generatingLink}
                  className="flex-1 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-600 dark:hover:text-blue-400 transition-colors btn-tactile"
                >
                  {generatingLink ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Gerar link para o cliente assinar
                </Button>
              )}

              {remoteLink && (
                <p className="text-xs text-center text-muted-foreground">
                  Válido por 24 horas · Compartilhe com o cliente pelo WhatsApp ou e-mail
                </p>
              )}
            </div>
          </div>
        ) : hasValidSignature ? (
          <div className="space-y-2">
            {latestSignature && (latestSignature.signature_base64 || latestSignature.signature_status === "SIGNED") && (
              <div className="border rounded-xl overflow-hidden bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30">
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Pen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Assinatura</span>
                  </div>
                  <Badge className="gap-1 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Coletada
                  </Badge>
                </div>
                <div className="p-4 flex items-center justify-center min-h-[100px] bg-white/50 dark:bg-slate-900/30">
                  {latestSignature.signature_base64 && (
                    <img src={latestSignature.signature_base64} alt="Assinatura do cliente" className="max-h-24 w-auto" />
                  )}
                </div>
                <div className="px-4 py-3 border-t bg-muted/20">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    {latestSignature.signer_name}
                  </div>
                  {latestSignature.signed_at && (
                    <div className="text-xs text-muted-foreground mt-0.5 ml-5">
                      Coletada em {new Date(latestSignature.signed_at).toLocaleDateString("pt-BR")} às {new Date(latestSignature.signed_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Signature Collection Modal */}
      <Dialog open={signatureModalOpen} onOpenChange={setSignatureModalOpen}>
        <DialogContent className={isExpanded ? "w-screen h-screen max-w-none m-0 rounded-none flex flex-col" : "sm:max-w-lg max-w-[95vw]"}>
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle>Assinatura do cliente</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="h-8 w-8 rounded-full border border-transparent hover:bg-slate-100">
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </DialogHeader>

          <div className={`space-y-4 ${isExpanded ? 'flex-1 flex flex-col' : ''}`}>
            <p className="text-sm text-muted-foreground">
              Peça para o cliente assinar na área abaixo, usando o dedo (celular) ou o mouse.
            </p>

            <div className={isExpanded ? 'flex-1' : ''}>
              <SignatureCanvas
                onReady={setSignatureApi}
                className={isExpanded ? "w-full h-full min-h-[50vh]" : "w-full h-[250px]"}
              />
            </div>

            {/* Consent checkbox */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
              <Checkbox
                id="confirm-consent"
                checked={confirmConsent}
                onCheckedChange={(checked) => setConfirmConsent(!!checked)}
                className="mt-0.5"
              />
              <Label
                htmlFor="confirm-consent"
                className="text-sm leading-relaxed cursor-pointer"
              >
                Confirmo que esta assinatura foi coletada com o consentimento do cliente e será utilizada para fins de representação legal.
              </Label>
            </div>

            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClear}
                disabled={savingSignature}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Limpar
              </Button>
              <Button
                type="button"
                onClick={handleSaveSignature}
                disabled={!canSave}
              >
                {savingSignature ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar assinatura"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
