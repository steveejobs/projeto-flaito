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
import { Pen, Loader2, CheckCircle2, Clock, Trash2, FileText, ExternalLink, RefreshCw } from "lucide-react";
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
  zapsign_doc_token?: string | null;
}

interface ClientData {
  id: string;
  full_name: string;
  cpf: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  office_id: string;
}

interface ClientSignaturePanelProps {
  clientId: string;
}

export function ClientSignaturePanel({ clientId }: ClientSignaturePanelProps) {
  const { toast } = useToast();
  
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [loadingSignatures, setLoadingSignatures] = useState(true);
  const [clientSignatures, setClientSignatures] = useState<ClientSignature[]>([]);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [signatureApi, setSignatureApi] = useState<SignatureCanvasApi | null>(null);
  const [sendingToZapSign, setSendingToZapSign] = useState(false);
  
  // States for signature collection
  const [confirmConsent, setConfirmConsent] = useState(false);

  const loadClientAndSignatures = useCallback(async () => {
    if (!clientId) return;
    
    setLoadingSignatures(true);
    
    try {
      // Load client data
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, full_name, cpf, cnpj, email, phone, office_id")
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
        setClientSignatures((signatures as ClientSignature[]) || []);
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
          signer_name: clientData.full_name,
          signer_doc: clientData.cpf || clientData.cnpj || null,
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

  const handleSendToZapSign = async () => {
    if (!clientData) return;
    
    setSendingToZapSign(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapsign-send-document", {
        body: {
          office_id: clientData.office_id,
          client_id: clientData.id,
          document_type: "CADASTRO_CLIENTE"
        }
      });
      
      if (error || !data?.ok) {
        toast({
          title: "Erro ao enviar para ZapSign",
          description: data?.error || "Não foi possível criar o documento para assinatura.",
          variant: "destructive",
        });
        return;
      }
      
      // Abrir URL de assinatura em nova aba
      if (data.sign_url) {
        window.open(data.sign_url, "_blank");
      }
      
      toast({
        title: "Documento enviado",
        description: "O termo de cadastro foi enviado para assinatura. Acompanhe o status abaixo.",
      });
      
      // Recarregar para mostrar status PENDING
      await loadClientAndSignatures();
      
    } catch (err) {
      console.error("[Lexos] Erro ao enviar para ZapSign:", err);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível enviar para assinatura.",
        variant: "destructive",
      });
    } finally {
      setSendingToZapSign(false);
    }
  };

  // Verificar se tem assinatura válida (COLLECTED manual ou SIGNED via ZapSign)
  const hasValidSignature = clientSignatures.some(
    sig => sig.signature_status === "COLLECTED" || sig.signature_status === "SIGNED" || sig.signature_base64
  );
  // Verificar se tem pendente no ZapSign
  const hasPendingZapSign = clientSignatures.some(sig => sig.signature_status === "PENDING");
  const latestSignature = clientSignatures[0];
  const canSave = confirmConsent && !savingSignature;

  if (loadingSignatures) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="py-4">
          {/* Mostrar status de assinatura pendente no ZapSign */}
          {hasPendingZapSign && !hasValidSignature && (
            <div className="flex items-center gap-3 p-3 mb-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
              <span className="text-sm text-purple-700 dark:text-purple-300 flex-1">
                Aguardando assinatura via ZapSign...
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={loadClientAndSignatures}
                className="h-7 px-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          
          {!hasValidSignature && !hasPendingZapSign ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleOpenModal}
                    className="hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    <Pen className="h-4 w-4 mr-2" />
                    Coletar manualmente
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleSendToZapSign}
                    disabled={sendingToZapSign}
                    className="hover:border-purple-400 hover:text-purple-600 dark:hover:border-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    {sendingToZapSign ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Assinar via ZapSign
                  </Button>
                </div>
                <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700 gap-1">
                  <Clock className="h-3 w-3" />
                  Pendente
                </Badge>
              </div>
            </div>
          ) : hasValidSignature ? (
            <div className="space-y-0">
              {/* Card integrado com header, assinatura e footer */}
              {latestSignature && (latestSignature.signature_base64 || latestSignature.signature_status === "SIGNED") && (
                <div className="border rounded-xl overflow-hidden bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30">
                  {/* Header interno */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Pen className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Assinatura</span>
                    </div>
                    <Badge className={`gap-1 text-xs ${
                      latestSignature.signature_status === "SIGNED" 
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-400"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-400"
                    }`}>
                      <CheckCircle2 className="h-3 w-3" />
                      {latestSignature.signature_status === "SIGNED" ? "ZapSign" : "Coletada"}
                    </Badge>
                  </div>
                  
                  {/* Área da assinatura */}
                  <div className="p-4 flex items-center justify-center min-h-[100px] bg-white/50 dark:bg-slate-900/30">
                    {latestSignature.signature_base64 ? (
                      <img
                        src={latestSignature.signature_base64}
                        alt="Assinatura do cliente"
                        className="max-h-24 w-auto"
                      />
                    ) : latestSignature.signature_status === "SIGNED" ? (
                      <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-medium">Assinado digitalmente via ZapSign</span>
                      </div>
                    ) : null}
                  </div>
                  
                  {/* Footer com informações do signatário */}
                  <div className="px-4 py-3 border-t bg-muted/20">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {latestSignature.signer_name}
                    </div>
                    {latestSignature.signed_at && (
                      <div className="text-xs text-muted-foreground mt-0.5 ml-5">
                        {latestSignature.signature_status === "SIGNED" ? "Assinado" : "Coletada"} em {new Date(latestSignature.signed_at).toLocaleDateString("pt-BR")} às {new Date(latestSignature.signed_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Signature Collection Modal */}
      <Dialog open={signatureModalOpen} onOpenChange={setSignatureModalOpen}>
        <DialogContent className="sm:max-w-lg max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Assinatura do cliente</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Peça para o cliente assinar na área abaixo, usando o dedo (celular) ou o mouse.
            </p>

            <SignatureCanvas onReady={setSignatureApi} />

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
