/**
 * ClientDocumentKit - Componente para gerenciamento do kit de documentos do cliente
 * 
 * Exibe status dos documentos (PROC, DECL, CONTRATO) e permite gerar/regenerar/visualizar
 * Suporta HTML-first: documentos são armazenados como HTML e podem ser impressos como PDF
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { FileText, Eye, Download, RefreshCw, Loader2, Plus, CheckCircle2, Clock, Printer, Info, Receipt } from "lucide-react";
import { KitFormDialog, KitAnswers, getDefaultKitAnswers } from "@/components/KitFormDialog";
import { ReciboFormDialog, ReciboAnswers, getDefaultReciboAnswers } from "@/components/ReciboFormDialog";
import { ClientKitValidationAlert } from "@/components/ClientKitValidationAlert";
import { SignatureRequirementsAlert, SignatureStatus } from "@/components/SignatureRequirementsAlert";
import { validateClientForKit, validateClientForRecibo, type ClientData, type ValidationField } from "@/lib/clientKitValidation";
import { generateClientKitHtml } from "@/lib/clientKitHtmlGenerator";

type KitDoc = {
  id: string;
  kind: string;
  description: string | null;
  storage_path: string;
  storage_bucket: string;
  file_name: string;
  mime_type: string | null;
  uploaded_at: string;
};

// Kit inicial (PROC, DECL, CONTRATO) - gerados juntos
const KIT_TYPES = [
  { code: "PROC", kind: "KIT_PROCURACAO", label: "Procuração", icon: FileText },
  { code: "DECL", kind: "KIT_DECLARACAO", label: "Declaração de Hipossuficiência", icon: FileText },
  { code: "CONTRATO", kind: "KIT_CONTRATO", label: "Contrato de Honorários", icon: FileText },
];

// Recibo é gerado separadamente quando há um pagamento
const RECIBO_TYPE = { code: "RECIBO", kind: "KIT_RECIBO", label: "Recibo de Pagamento", icon: Receipt };

type Props = {
  clientId: string;
  compact?: boolean;
};

export function ClientDocumentKit({ clientId, compact = false }: Props) {
  const safeClientId =
    typeof clientId === "string" ? clientId.trim() : String(clientId ?? "").trim();

  const [docs, setDocs] = useState<KitDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [officeId, setOfficeId] = useState<string | null>(null);

  // Preview dialog state for HTML documents
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewDocName, setPreviewDocName] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  

  // Kit form dialog state
  const [showKitDialog, setShowKitDialog] = useState(false);
  const [kitAnswers, setKitAnswers] = useState<KitAnswers>(getDefaultKitAnswers());
  const [pendingCodes, setPendingCodes] = useState<string[]>([]);

  // Recibo form dialog state
  const [showReciboDialog, setShowReciboDialog] = useState(false);
  const [reciboAnswers, setReciboAnswers] = useState<ReciboAnswers>(getDefaultReciboAnswers());
  const [generatingRecibo, setGeneratingRecibo] = useState(false);

  // Validation alert state
  const [showValidationAlert, setShowValidationAlert] = useState(false);
  const [missingFields, setMissingFields] = useState<ValidationField[]>([]);

  // Signature requirements state
  const [showSignatureAlert, setShowSignatureAlert] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<SignatureStatus>({
    clientSignature: false,
    officeSignature: false,
  });
  const [pendingCodesAfterSignature, setPendingCodesAfterSignature] = useState<string[]>([]);

  // Migration states (legacy)
  const [migratingKind, setMigratingKind] = useState<string | null>(null);
  const [migratingCode, setMigratingCode] = useState<string | null>(null);

  // Instructions modal state
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);

  // Helper functions for PDF/HTML detection
  const isPdfDoc = (d: KitDoc) =>
    d?.mime_type === "application/pdf" ||
    String(d?.storage_path || "").toLowerCase().endsWith(".pdf");

  const isHtmlDoc = (d: KitDoc) =>
    d?.mime_type === "text/html" ||
    String(d?.storage_path || "").toLowerCase().endsWith(".html");

  const getDocForKind = (kind: string) => {
    // Prefer HTML first (new format), then PDF (legacy)
    const html = docs.find(d => d.kind === kind && isHtmlDoc(d));
    if (html) return { doc: html, isHtmlFirst: true };

    const pdf = docs.find(d => d.kind === kind && isPdfDoc(d));
    if (pdf) return { doc: pdf, isHtmlFirst: false };

    return { doc: null, isHtmlFirst: false };
  };

  // Load documents
  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_files")
        .select("id, kind, description, storage_path, storage_bucket, file_name, mime_type, uploaded_at")
        .eq("client_id", clientId)
        .in("kind", ["KIT_PROCURACAO", "KIT_DECLARACAO", "KIT_CONTRATO", "KIT_RECIBO"])
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      
      const loaded = (data as KitDoc[]) || [];
      setDocs(loaded);

      return loaded;
    } catch (err) {
      console.error("[ClientDocumentKit] Load error:", err);
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Fetch office ID from client
  useEffect(() => {
    async function fetchOfficeId() {
      if (!safeClientId) return;
      const { data } = await supabase
        .from("clients")
        .select("office_id")
        .eq("id", safeClientId)
        .single();
      if (data?.office_id) setOfficeId(data.office_id);
    }
    fetchOfficeId();
  }, [safeClientId]);

  // Generate kit for specific codes (explicit parameter - no state dependency)
  const handleGenerateKitForCodes = async (codes: string[], answersOverride?: KitAnswers) => {
    if (!safeClientId) {
      console.warn("[ClientDocumentKit] clientId ainda não definido — pulando geração");
      setRegeneratingCode(null);
      setGenerating(false);
      return;
    }

    if (codes.length === 0) {
      console.warn("[ClientDocumentKit] Nenhum código para gerar");
      setRegeneratingCode(null);
      setGenerating(false);
      return;
    }

    // Prevent duplicate generation
    if (generating) {
      console.warn("[ClientDocumentKit] Geração já em andamento");
      return;
    }

    setGenerating(true);
    setShowKitDialog(false);

    try {
      const answers = answersOverride || kitAnswers;
      
      // Build variables from kitAnswers (do NOT insert into client_contract_terms - read only)
      const variables: Record<string, unknown> = {
        tipo_remuneracao: answers.tipo_remuneracao,
        percentual_honorarios: answers.percentual_honorarios,
        valor_fixo_honorarios: answers.valor_fixo_honorarios,
        forma_pagamento: answers.forma_pagamento,
        valor_entrada: answers.valor_entrada,
        numero_parcelas: answers.numero_parcelas,
        valor_parcela: answers.valor_parcela,
        datas_parcelas: answers.datas_parcelas?.map(d => d.toISOString()),
        metodo_pagamento: answers.metodo_pagamento,
        chave_pix: answers.chave_pix,
        // Advogados selecionados
        allLawyers: answers.allLawyers,
        selectedLawyerIds: answers.selectedLawyerIds,
        primaryLawyerId: answers.primaryLawyerId,
      };

      // Gerar HTML localmente (HTML-first, sem PDF)
      console.log("[ClientDocumentKit] Gerando documentos HTML...", codes);
      const result = await generateClientKitHtml(safeClientId, codes, variables);

      // Handle errors with detailed feedback
      if (!result.ok) {
        const msg = result.errors.length
          ? result.errors.map(e => `${e.code}: ${e.reason}`).join(" | ").slice(0, 900)
          : "Erro ao gerar documentos";
        console.error("[ClientDocumentKit] KIT generation failed:", result.errors);
        toast.error(msg);
        
        // Still reload if some docs were created
        if (result.created.length > 0) {
          toast.success(`${result.created.length} documento(s) gerado(s)!`);
          await loadDocs();
        }
        return;
      }

      // Salvar advogados selecionados para próximas gerações
      if (!answers.allLawyers && answers.selectedLawyerIds.length > 0) {
        // Remover vínculos antigos
        await supabase
          .from("client_assigned_lawyers")
          .delete()
          .eq("client_id", safeClientId);
        
        // Inserir novos vínculos
        const records = answers.selectedLawyerIds.map(memberId => ({
          client_id: safeClientId,
          member_id: memberId,
          is_primary: memberId === answers.primaryLawyerId,
        }));
        await supabase.from("client_assigned_lawyers").insert(records);
      } else if (answers.allLawyers) {
        // Se "todos advogados", limpar vínculos específicos
        await supabase
          .from("client_assigned_lawyers")
          .delete()
          .eq("client_id", safeClientId);
      }

      toast.success(`${result.created.length} documento(s) gerado(s)!`);
      await loadDocs();
    } catch (err: any) {
      console.error("[ClientDocumentKit] Generate error:", err);
      toast.error(err.message || "Erro ao gerar kit");
    } finally {
      setGenerating(false);
      setPendingCodes([]);
      setRegeneratingCode(null);
    }
  };

  // Wrapper for dialog confirmation (uses pendingCodes from state)
  const handleGenerateKit = async () => {
    await handleGenerateKitForCodes(pendingCodes);
  };

  // Check signature requirements
  const checkSignatureRequirements = async (): Promise<SignatureStatus> => {
    try {
      // Check client signature
      const { data: clientSig } = await supabase
        .from("vw_client_signatures")
        .select("id")
        .eq("client_id", safeClientId)
        .limit(1)
        .maybeSingle();

      // Check office signature (from active office session)
      const { data: healthRaw } = await supabase.rpc("lexos_healthcheck_session");
      const health = (healthRaw as Array<{ ok: boolean; office_id: string }> | null)?.[0];
      
      let officeHasSignature = false;
      if (health?.office_id) {
        const { data: office } = await supabase
          .from("offices")
          .select("signature_storage_path")
          .eq("id", health.office_id)
          .maybeSingle();
        
        officeHasSignature = !!office?.signature_storage_path;
      }

      return {
        clientSignature: !!clientSig,
        officeSignature: officeHasSignature,
      };
    } catch (err) {
      console.error("[ClientDocumentKit] Error checking signatures:", err);
      return { clientSignature: false, officeSignature: false };
    }
  };

  // Validate client before opening kit dialog
  const validateAndOpenDialog = async (codes: string[]) => {
    if (!safeClientId) {
      console.warn("[ClientDocumentKit] clientId ainda não definido — pulando validação");
      setRegeneratingCode(null);
      return;
    }

    try {
      const { data: client, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", safeClientId)
        .single();

      if (error || !client) {
        toast.error("Erro ao buscar dados do cliente");
        setRegeneratingCode(null);
        return;
      }

      // Garantir officeId antes de abrir dialog
      let currentOfficeId = officeId;
      if (!currentOfficeId && client.office_id) {
        currentOfficeId = client.office_id;
        setOfficeId(currentOfficeId);
      }

      const validation = validateClientForKit(client as ClientData);
      
      if (!validation.isValid) {
        setMissingFields(validation.missingFields);
        setShowValidationAlert(true);
        setRegeneratingCode(null);
        return;
      }

      // Check signature requirements
      const sigStatus = await checkSignatureRequirements();
      setSignatureStatus({
        ...sigStatus,
        clientName: (client as any).full_name,
      });

      if (!sigStatus.clientSignature || !sigStatus.officeSignature) {
        setPendingCodesAfterSignature(codes);
        setShowSignatureAlert(true);
        setRegeneratingCode(null);
        return;
      }

      // Check if CONTRATO is in the codes - show dialog for contract or lawyer selection
      const hasContrato = codes.some(c => c === "CONTRATO");
      const hasProcOrContrato = codes.some(c => c === "PROC" || c === "CONTRATO");
      
      // Always show dialog when PROC or CONTRATO to allow lawyer selection
      if (!hasProcOrContrato) {
        // For DECL only, generate directly without dialog
        await handleGenerateKitForCodes(codes);
        return;
      }

      // Load saved contract terms if any (only for CONTRATO)
      if (hasContrato) {
        const { data: terms } = await supabase
          .from("client_contract_terms")
          .select("tipo_remuneracao, percentual_honorarios, valor_fixo_honorarios, forma_pagamento, valor_entrada, numero_parcelas, valor_parcela, data_primeira_parcela, datas_parcelas, metodo_pagamento, chave_pix")
          .eq("client_id", safeClientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (terms) {
          setKitAnswers(prev => ({
            ...prev,
            tipo_remuneracao: (terms.tipo_remuneracao as any) || prev.tipo_remuneracao,
            percentual_honorarios: terms.percentual_honorarios?.toString() || prev.percentual_honorarios,
            valor_fixo_honorarios: terms.valor_fixo_honorarios?.toString() || prev.valor_fixo_honorarios,
            forma_pagamento: (terms.forma_pagamento as any) || prev.forma_pagamento,
            valor_entrada: terms.valor_entrada?.toString() || prev.valor_entrada,
            numero_parcelas: terms.numero_parcelas?.toString() || prev.numero_parcelas,
            valor_parcela: terms.valor_parcela?.toString() || prev.valor_parcela,
            metodo_pagamento: (terms.metodo_pagamento as any) || prev.metodo_pagamento,
            chave_pix: terms.chave_pix || prev.chave_pix,
          }));
        }
      }

      // Resetar kitAnswers para valores padrão antes de abrir o diálogo
      // Os advogados serão carregados pelo ClientLawyerSelector via loadExistingAssignments
      setKitAnswers(getDefaultKitAnswers());

      setPendingCodes(codes);
      setShowKitDialog(true);
    } catch (err) {
      console.error("[ClientDocumentKit] Validation error:", err);
      toast.error("Erro ao validar dados do cliente");
      setRegeneratingCode(null);
    }
  };

  // Handle collect client signature from alert
  const handleCollectClientSignature = () => {
    setShowSignatureAlert(false);
    // Dispatch event to open signature panel
    window.dispatchEvent(new CustomEvent("lexos:open-client-signature", { detail: { clientId: safeClientId } }));
  };

  // View document - HTML opens in preview dialog with print option
  const handleView = async (doc: KitDoc) => {
    setViewingId(doc.id);
    setLoadingPreview(true);
    try {
      const { data, error } = await supabase.storage
        .from(doc.storage_bucket)
        .createSignedUrl(doc.storage_path, 3600);

      if (error || !data?.signedUrl) {
        throw new Error("Não foi possível gerar URL de visualização");
      }

      if (isPdfDoc(doc)) {
        // PDF: open in new tab
        window.open(data.signedUrl, '_blank');
      } else {
        // HTML: Fetch content and show in preview dialog
        const response = await fetch(data.signedUrl);
        const htmlContent = await response.text();
        setPreviewHtml(htmlContent);
        setPreviewDocName(doc.description || doc.file_name);
        
        setPreviewOpen(true);
      }
    } catch (err: any) {
      console.error("[ClientDocumentKit] View error:", err);
      toast.error(err.message || "Erro ao abrir documento");
    } finally {
      setViewingId(null);
      setLoadingPreview(false);
    }
  };

  // Print HTML document (user saves as PDF via browser)
  const handlePrint = () => {
    try {
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    } catch (err) {
      console.error("[ClientDocumentKit] Print error:", err);
      toast.error("Erro ao imprimir. Tente abrir em nova aba.");
    }
  };

  // Download document
  const handleDownload = async (doc: KitDoc) => {
    try {
      const { data, error } = await supabase.storage
        .from(doc.storage_bucket)
        .createSignedUrl(doc.storage_path, 3600);

      if (error || !data?.signedUrl) {
        throw new Error("Não foi possível baixar o documento");
      }

      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name || (isPdfDoc(doc) ? "documento.pdf" : "documento.html");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Download iniciado!");
    } catch (err: any) {
      console.error("[ClientDocumentKit] Download error:", err);
      toast.error(err.message || "Erro ao baixar documento");
    }
  };

  // Regenerate single document
  const handleRegenerate = (code: string) => {
    setRegeneratingCode(code);
    if (code === "RECIBO") {
      handleOpenReciboDialog();
    } else {
      validateAndOpenDialog([code]);
    }
  };

  // Open Recibo dialog with validation
  const handleOpenReciboDialog = async () => {
    if (!safeClientId) {
      console.warn("[ClientDocumentKit] clientId ainda não definido — pulando validação");
      return;
    }

    try {
      const { data: client, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", safeClientId)
        .single();

      if (error || !client) {
        toast.error("Erro ao buscar dados do cliente");
        return;
      }

      const validation = validateClientForRecibo(client as ClientData);
      
      if (!validation.isValid) {
        setMissingFields(validation.missingFields);
        setShowValidationAlert(true);
        return;
      }

      setReciboAnswers(getDefaultReciboAnswers());
      setShowReciboDialog(true);
    } catch (err) {
      console.error("[ClientDocumentKit] Validation error:", err);
      toast.error("Erro ao validar dados do cliente");
    }
  };

  // Generate Recibo
  const handleGenerateRecibo = async () => {
    if (!safeClientId) return;

    setGeneratingRecibo(true);
    setShowReciboDialog(false);

    try {
      // Parse valor to number for extenso
      const valorNum = parseFloat(reciboAnswers.valor.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
      
      // Build variables for recibo template
      const variables: Record<string, unknown> = {
        valor: reciboAnswers.valor,
        valor_extenso: valorPorExtensoSimple(valorNum),
        data_pagamento: reciboAnswers.data_pagamento,
        descricao_pagamento: reciboAnswers.descricao_pagamento,
        tipo_pagamento: reciboAnswers.tipo_pagamento,
        numero_parcela: reciboAnswers.numero_parcela,
        total_parcelas: reciboAnswers.total_parcelas,
        metodo_pagamento: reciboAnswers.metodo_pagamento,
      };

      const result = await generateClientKitHtml(safeClientId, ["RECIBO"], variables);

      if (!result.ok) {
        const msg = result.errors.length
          ? result.errors.map(e => `${e.code}: ${e.reason}`).join(" | ").slice(0, 900)
          : "Erro ao gerar recibo";
        toast.error(msg);
        return;
      }

      toast.success("Recibo gerado com sucesso!");
      await loadDocs();
    } catch (err: any) {
      console.error("[ClientDocumentKit] Generate recibo error:", err);
      toast.error(err.message || "Erro ao gerar recibo");
    } finally {
      setGeneratingRecibo(false);
    }
  };

  // Helper for valor por extenso (simplified version for recibo)
  const valorPorExtensoSimple = (valor: number): string => {
    if (valor === 0) return "zero reais";
    const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
    const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
    const converterGrupo = (n: number): string => {
      if (n === 0) return "";
      if (n === 100) return "cem";
      let resultado = "";
      const c = Math.floor(n / 100);
      const resto = n % 100;
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      if (c > 0) resultado += centenas[c];
      if (resto > 0) { if (c > 0) resultado += " e "; if (resto < 10) resultado += unidades[resto]; else if (resto < 20) resultado += especiais[resto - 10]; else { resultado += dezenas[d]; if (u > 0) resultado += " e " + unidades[u]; } }
      return resultado;
    };
    const parteInteira = Math.floor(valor);
    const centavos = Math.round((valor - parteInteira) * 100);
    let resultado = "";
    if (parteInteira >= 1000) { const milhares = Math.floor(parteInteira / 1000); resultado += milhares === 1 ? "mil" : converterGrupo(milhares) + " mil"; const resto = parteInteira % 1000; if (resto > 0) resultado += resto < 100 ? " e " : " "; }
    const unidadesParte = parteInteira % 1000;
    if (unidadesParte > 0) resultado += converterGrupo(unidadesParte);
    if (parteInteira === 1) resultado += " real"; else if (parteInteira > 0) resultado += " reais";
    if (centavos > 0) { if (parteInteira > 0) resultado += " e "; resultado += converterGrupo(centavos) + (centavos === 1 ? " centavo" : " centavos"); }
    return resultado.trim();
  };

  // Handle validation alert close
  const handleCompleteRegistration = () => {
    setShowValidationAlert(false);
    // Dispatch event to open client edit form
    window.dispatchEvent(new CustomEvent("lexos:open-client-edit", { detail: { clientId } }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate status - HTML is now the preferred format
  const allDocsGenerated = KIT_TYPES.every(kt => {
    const { doc } = getDocForKind(kt.kind);
    return doc !== null;
  });

  const missingKitTypes = KIT_TYPES.filter(kt => {
    const { doc } = getDocForKind(kt.kind);
    return !doc;
  });

  const hasAnyDoc = docs.length > 0;

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!allDocsGenerated && (
          <Button
            onClick={() => validateAndOpenDialog(missingKitTypes.map(kt => kt.code))}
            disabled={generating}
            size={compact ? "sm" : "default"}
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : hasAnyDoc ? (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Gerar Faltantes
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Gerar Kit Completo
              </>
            )}
          </Button>
        )}

        {allDocsGenerated && (
          <Button
            variant="outline"
            onClick={() => validateAndOpenDialog(["PROC", "DECL", "CONTRATO"])}
            disabled={generating}
            size={compact ? "sm" : "default"}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerar Todos
          </Button>
        )}
      </div>

      {/* Document Cards */}
      <div className="grid gap-3">
        {KIT_TYPES.map(kt => {
          const { doc, isHtmlFirst } = getDocForKind(kt.kind);
          const Icon = kt.icon;
          const isRegenerating = regeneratingCode === kt.code;

          return (
            <Card 
              key={kt.kind} 
              className={
                doc 
                  ? "border-green-500/30 bg-green-500/5" 
                  : "border-dashed"
              }
            >
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg ${doc ? "bg-green-500/10" : "bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${doc ? "text-green-600" : "text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{kt.label}</p>
                    {doc ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-green-600">
                          {isHtmlFirst ? "Documento (HTML)" : "Gerado (PDF)"}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Pendente</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {doc ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleView(doc)}
                        disabled={viewingId === doc.id}
                        title="Visualizar"
                      >
                        {viewingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownload(doc)}
                        title="Baixar"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRegenerate(kt.code)}
                        disabled={isRegenerating || generating}
                        title="Regenerar"
                      >
                        <RefreshCw className={`h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`} />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => validateAndOpenDialog([kt.code])}
                      disabled={generating}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Gerar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Separator */}
        <div className="my-2 border-t border-border/40" />

        {/* Recibo Card - gerado separadamente */}
        {(() => {
          const { doc, isHtmlFirst } = getDocForKind(RECIBO_TYPE.kind);
          const Icon = RECIBO_TYPE.icon;
          const isRegenerating = regeneratingCode === RECIBO_TYPE.code;

          return (
            <Card 
              key={RECIBO_TYPE.kind} 
              className={
                doc 
                  ? "border-amber-500/30 bg-amber-500/5" 
                  : "border-dashed"
              }
            >
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg ${doc ? "bg-amber-500/10" : "bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${doc ? "text-amber-600" : "text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{RECIBO_TYPE.label}</p>
                    {doc ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-amber-600" />
                        <span className="text-xs text-amber-600">
                          {isHtmlFirst ? "Documento (HTML)" : "Gerado (PDF)"}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Gerar quando houver pagamento</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {doc ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleView(doc)}
                        disabled={viewingId === doc.id}
                        title="Visualizar"
                      >
                        {viewingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownload(doc)}
                        title="Baixar"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRegenerate(RECIBO_TYPE.code)}
                        disabled={isRegenerating || generatingRecibo}
                        title="Novo Recibo"
                      >
                        <RefreshCw className={`h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`} />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenReciboDialog}
                      disabled={generatingRecibo}
                    >
                      {generatingRecibo ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-1 h-3 w-3" />
                          Gerar Recibo
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* Kit Form Dialog */}
      <KitFormDialog
        open={showKitDialog}
        onOpenChange={(open) => {
          setShowKitDialog(open);
          if (!open) {
            setRegeneratingCode(null);
            setMigratingCode(null);
            setMigratingKind(null);
            setPendingCodes([]);
          }
        }}
        kitAnswers={kitAnswers}
        setKitAnswers={setKitAnswers}
        loading={generating}
        onConfirm={handleGenerateKit}
        title={pendingCodes.length === 1 ? `Gerar ${KIT_TYPES.find(kt => kt.code === pendingCodes[0])?.label}` : "Gerar Kit de Documentos"}
        description="Informe os dados para gerar o(s) documento(s)."
        confirmLabel={pendingCodes.length === 1 ? "Gerar documento" : "Gerar kit"}
        templateCodes={pendingCodes}
        officeId={officeId || undefined}
        clientId={safeClientId}
      />

      {/* Recibo Form Dialog */}
      <ReciboFormDialog
        open={showReciboDialog}
        onOpenChange={(open) => {
          setShowReciboDialog(open);
          if (!open) setRegeneratingCode(null);
        }}
        reciboAnswers={reciboAnswers}
        setReciboAnswers={setReciboAnswers}
        loading={generatingRecibo}
        onConfirm={handleGenerateRecibo}
      />

      {/* Validation Alert */}
      <ClientKitValidationAlert
        open={showValidationAlert}
        onOpenChange={setShowValidationAlert}
        missingFields={missingFields}
        onComplete={handleCompleteRegistration}
      />

      {/* Signature Requirements Alert */}
      {showSignatureAlert && (
        <Dialog open={showSignatureAlert} onOpenChange={setShowSignatureAlert}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Pendências de Assinatura</DialogTitle>
              <DialogDescription className="sr-only">
                Verificação de assinaturas necessárias para gerar documentos
              </DialogDescription>
            </DialogHeader>
            <SignatureRequirementsAlert
              status={signatureStatus}
              onCollectClientSignature={handleCollectClientSignature}
              onClose={() => setShowSignatureAlert(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* HTML Preview Dialog with Print Button */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle>{previewDocName || "Pré-visualização do Documento"}</DialogTitle>
              <div className="flex items-center gap-2 pr-8">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir / Salvar como PDF
                </Button>
              </div>
            </div>
            <DialogDescription className="sr-only">
              Pré-visualização do documento em HTML. Use o botão Imprimir para salvar como PDF.
            </DialogDescription>
          </DialogHeader>

          {/* PDF Save Instructions Alert */}
          <Alert className="flex-shrink-0 bg-muted/50 border-border/60">
            <Info className="h-4 w-4" />
            <AlertTitle className="text-sm font-semibold">Salvar em PDF</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground space-y-1">
              <p>Clique em "Imprimir / Salvar como PDF".</p>
              <p>No diálogo do navegador, selecione "Salvar como PDF" e confirme.</p>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-primary hover:underline"
                onClick={() => setShowInstructionsModal(true)}
              >
                Ver instruções detalhadas
              </Button>
            </AlertDescription>
          </Alert>


          <div className="flex-1 overflow-hidden bg-white rounded border min-h-0">
            {loadingPreview ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                title="Preview"
                className="w-full h-full border-0"
                style={{ minHeight: "60vh" }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Instructions Modal */}
      <Dialog open={showInstructionsModal} onOpenChange={setShowInstructionsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Como salvar em PDF</DialogTitle>
            <DialogDescription>
              Siga os passos abaixo para salvar o documento como PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ol className="list-decimal list-inside space-y-3 text-sm">
              <li className="text-foreground">
                <span className="font-medium">Clique em "Imprimir / Salvar como PDF"</span>
                <p className="text-muted-foreground text-xs mt-1 ml-5">
                  O diálogo de impressão do navegador será aberto.
                </p>
              </li>
              <li className="text-foreground">
                <span className="font-medium">Destino: "Salvar como PDF"</span>
                <p className="text-muted-foreground text-xs mt-1 ml-5">
                  Na opção "Destino" ou "Impressora", selecione "Salvar como PDF".
                </p>
              </li>
              <li className="text-foreground">
                <span className="font-medium">Layout: A4 | Margens padrão</span>
                <p className="text-muted-foreground text-xs mt-1 ml-5">
                  Verifique se o tamanho do papel está como A4 e mantenha as margens padrão.
                </p>
              </li>
              <li className="text-foreground">
                <span className="font-medium">Confirmar / Salvar</span>
                <p className="text-muted-foreground text-xs mt-1 ml-5">
                  Clique em "Salvar" e escolha onde deseja guardar o arquivo PDF.
                </p>
              </li>
            </ol>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowInstructionsModal(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
