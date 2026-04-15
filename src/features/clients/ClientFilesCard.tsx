import React, { useState, useEffect, useRef, forwardRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Camera,
  Upload,
  Download,
  FileText,
  Loader2,
  
  Plus,
  Paperclip,
  X,
  ScanLine,
  IdCard,
  PenLine,
  FileSignature,
  Receipt,
  Image as ImageIcon,
  Pen,
  CheckCircle2,
  Clock,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DocumentScannerModal } from "@/components/DocumentScannerModal";
import { SignatureCanvas, SignatureCanvasApi } from "@/components/SignatureCanvas";
import { autoGenerateClientKit } from "@/lib/clientKit";
import type { LucideIcon } from "lucide-react";

type ClientFileKind =
  | "IDENTIDADE"
  | "CPF_CNPJ"
  | "COMPROVANTE_ENDERECO"
  | "COMPROVANTE_RENDA"
  | "ASSINATURA"
  | "CONTRATO_ASSINADO"
  | "OUTRO"
  | "KIT_PROCURACAO"
  | "KIT_DECLARACAO"
  | "KIT_CONTRATO";

// Tipos do kit (aparecem em outra aba)
const kitKinds: ClientFileKind[] = [
  "KIT_PROCURACAO",
  "KIT_DECLARACAO",
  "KIT_CONTRATO",
];

// Mapeamento de painéis principais
const MAIN_PANELS: {
  id: string;
  label: string;
  kinds: ClientFileKind[];
  icon: LucideIcon;
}[] = [
  { id: "identity", label: "Documento de Identidade", kinds: ["IDENTIDADE", "CPF_CNPJ"], icon: IdCard },
  { id: "signature", label: "Assinatura", kinds: ["ASSINATURA"], icon: PenLine },
  { id: "contract", label: "Contrato", kinds: ["CONTRATO_ASSINADO"], icon: FileSignature },
  { id: "payment", label: "Comprovante de Pagamento", kinds: ["COMPROVANTE_RENDA"], icon: Receipt },
];

// Tipos considerados "outros anexos"
const OTHER_KINDS: ClientFileKind[] = ["OUTRO", "COMPROVANTE_ENDERECO"];

type ClientFile = {
  id: string;
  client_id: string;
  office_id: string;
  case_id: string | null;
  kind: ClientFileKind;
  description: string | null;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
  metadata: Record<string, unknown>;
};

// Tipo para assinatura do cliente
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
  signed_at: string;
}

// Tipo para dados do cliente
interface ClientData {
  id: string;
  full_name: string;
  cpf: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  office_id: string;
}

export interface ClientFilesCardProps {
  clientId: string;
  officeId: string;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponente: DocumentPanel (painel principal com moldura "scanner")
// ─────────────────────────────────────────────────────────────────────────────
interface DocumentPanelProps {
  panel: (typeof MAIN_PANELS)[0];
  file: ClientFile;
  imageUrl?: string;
  onPreview: () => void;
  onDownload: () => void;
  onDelete?: () => void;
}

function DocumentPanel({ panel, file, imageUrl, onPreview, onDownload, onDelete }: DocumentPanelProps) {
  const Icon = panel.icon;
  const isImage = file.mime_type?.startsWith("image/");

  return (
    <div className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        <div className="p-1.5 rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-medium">{panel.label}</span>
        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Remover arquivo"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Preview com moldura scanner */}
      <div
        className="aspect-[1.58/1] bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 m-3 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
        onClick={onPreview}
      >
        {isImage && imageUrl ? (
          <img
            src={imageUrl}
            alt={file.file_name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/60">
            <FileText className="h-10 w-10" />
            <span className="text-xs">PDF</span>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="px-3 pb-3 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            {file.file_name}
          </span>
          <span className="text-[10px] text-muted-foreground/70">
            {format(new Date(file.uploaded_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────
export const ClientFilesCard = forwardRef<HTMLDivElement, ClientFilesCardProps>(
  function ClientFilesCard({ clientId, officeId }, ref) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [files, setFiles] = useState<ClientFile[]>([]);
    const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
    const [loadingFiles, setLoadingFiles] = useState(true);
    const [uploading, setUploading] = useState(false);
    
    const [uploadFormOpen, setUploadFormOpen] = useState(false);
    const [description, setDescription] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scannedBlob, setScannedBlob] = useState<Blob | null>(null);

    // Estados para assinatura integrada
    const [latestSignature, setLatestSignature] = useState<ClientSignature | null>(null);
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [signatureModalOpen, setSignatureModalOpen] = useState(false);
    const [savingSignature, setSavingSignature] = useState(false);
    const [confirmConsent, setConfirmConsent] = useState(false);
    const [signatureApi, setSignatureApi] = useState<SignatureCanvasApi | null>(null);

    // Estados para preview de arquivo
    const [previewFile, setPreviewFile] = useState<ClientFile | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // ─────────────────────────────────────────────────────────────────────────
    // Separar arquivos por categoria
    // ─────────────────────────────────────────────────────────────────────────
    const panelFiles = useMemo(() => {
      return MAIN_PANELS.map((panel) => {
        const matchingFiles = files
          .filter((f) => panel.kinds.includes(f.kind))
          .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
        return {
          ...panel,
          file: matchingFiles[0] || null,
        };
      });
    }, [files]);

    const otherFiles = useMemo(() => {
      return files
        .filter((f) => OTHER_KINDS.includes(f.kind))
        .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    }, [files]);

    const hasMainPanels = panelFiles.some((p) => p.file !== null);

    // ─────────────────────────────────────────────────────────────────────────
    // Carregar arquivos
    // ─────────────────────────────────────────────────────────────────────────
    const loadFiles = useCallback(async () => {
      if (!clientId) return;
      setLoadingFiles(true);
      try {
        const { data, error } = await supabase
          .from("client_files")
          .select("*")
          .eq("client_id", clientId)
          .not("kind", "in", `(${kitKinds.join(",")})`)
          .order("uploaded_at", { ascending: false });

        if (error) {
          console.error("[ClientFilesCard] Erro ao carregar arquivos:", error);
        } else {
          const loadedFiles = (data as ClientFile[]) || [];
          setFiles(loadedFiles);

          // Generate signed URLs for image files
          const urls: Record<string, string> = {};
          for (const file of loadedFiles) {
            if (file.mime_type?.startsWith("image/")) {
              const { data: urlData } = await supabase.storage
                .from(file.storage_bucket)
                .createSignedUrl(file.storage_path, 3600);
              if (urlData?.signedUrl) {
                urls[file.id] = urlData.signedUrl;
              }
            }
          }
          setFileUrls(urls);
        }
      } finally {
        setLoadingFiles(false);
      }
    }, [clientId]);

    useEffect(() => {
      loadFiles();
    }, [loadFiles]);

    // ─────────────────────────────────────────────────────────────────────────
    // Carregar assinatura e dados do cliente
    // ─────────────────────────────────────────────────────────────────────────
    const loadSignature = useCallback(async () => {
      if (!clientId) return;

      try {
        // Load client data
        const { data: client } = await supabase
          .from("clients")
          .select("id, full_name, cpf, cnpj, email, phone, office_id")
          .eq("id", clientId)
          .maybeSingle();

        if (client) {
          setClientData(client);
        }

        // Load latest signature
        const { data: signature } = await supabase
          .from("vw_client_signatures")
          .select("*")
          .eq("client_id", clientId)
          .order("signed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setLatestSignature(signature as any);
      } catch (err) {
        console.error("[ClientFilesCard] Erro ao carregar assinatura:", err);
      }
    }, [clientId]);

    useEffect(() => {
      loadSignature();
    }, [loadSignature]);

    // ─────────────────────────────────────────────────────────────────────────
    // Salvar assinatura
    // ─────────────────────────────────────────────────────────────────────────
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
          toast({
            title: "Erro ao salvar assinatura",
            description: "Não foi possível registrar a assinatura.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Assinatura registrada",
          description: "A assinatura do cliente foi salva com sucesso.",
        });

        setSignatureModalOpen(false);
        await loadSignature();

        // Gerar KIT após assinatura
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
        console.error("[ClientFilesCard] Erro ao salvar assinatura:", err);
        toast({
          title: "Erro inesperado",
          description: "Não foi possível salvar a assinatura.",
          variant: "destructive",
        });
      } finally {
        setSavingSignature(false);
      }
    };

    const handleOpenSignatureModal = () => {
      setSignatureApi(null);
      setConfirmConsent(false);
      setSignatureModalOpen(true);
    };

    const handleClearSignature = () => {
      signatureApi?.clear();
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Upload de arquivos (sempre como OUTRO)
    // ─────────────────────────────────────────────────────────────────────────
    const handleUpload = async () => {
      // Se tem blob escaneado, adiciona à lista de arquivos pendentes
      if (scannedBlob) {
        const scannedFile = new File([scannedBlob], `scan_${Date.now()}.jpg`, { type: "image/jpeg" });
        setSelectedFiles(prev => [...prev, scannedFile]);
        setScannedBlob(null);
        return;
      }

      if (selectedFiles.length === 0 || !officeId || !clientId) {
        toast({
          title: "Selecione ao menos um arquivo",
          variant: "destructive",
        });
        return;
      }

      setUploading(true);
      try {
        let successCount = 0;

        for (const file of selectedFiles) {
          const timestamp = Date.now();
          const storagePath = `${officeId}/${clientId}/${timestamp}_${file.name}`;

          // Upload para storage
          const { error: uploadError } = await supabase.storage
            .from("client-files")
            .upload(storagePath, file, {
              contentType: file.type,
            });

          if (uploadError) {
            console.error("Erro no upload:", file.name, uploadError);
            continue;
          }

          // Inserir registro (sempre como OUTRO)
          const { error: insertError } = await supabase.from("client_files").insert({
            client_id: clientId,
            office_id: officeId,
            kind: "OUTRO" as ClientFileKind,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || null,
            storage_path: storagePath,
            storage_bucket: "client-files",
            description: description || null,
          });

          if (!insertError) successCount++;
        }

        if (successCount > 0) {
          toast({
            title: `${successCount} arquivo(s) enviado(s) com sucesso`,
          });
        }
        
        clearSelection();
        loadFiles();
      } catch (err) {
        console.error("Erro no upload:", err);
        toast({
          title: "Erro ao enviar arquivo(s)",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    };

    const clearSelection = () => {
      setSelectedFiles([]);
      setDescription("");
      setScannedBlob(null);
    };

    const resetForm = () => {
      clearSelection();
      setUploadFormOpen(false);
    };

    const removeFileFromSelection = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Download de arquivo
    // ─────────────────────────────────────────────────────────────────────────
    const handleDownload = async (file: ClientFile) => {
      try {
        const { data, error } = await supabase.storage
          .from(file.storage_bucket)
          .createSignedUrl(file.storage_path, 60);

        if (error || !data?.signedUrl) {
          toast({
            title: "Erro ao gerar link",
            description: "Não foi possível gerar o link de download.",
            variant: "destructive",
          });
          return;
        }

        window.open(data.signedUrl, "_blank");
      } catch (err) {
        console.error("[ClientFilesCard] Erro ao baixar:", err);
      }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Preview de arquivo
    // ─────────────────────────────────────────────────────────────────────────
    const handlePreview = async (file: ClientFile) => {
      try {
        const { data, error } = await supabase.storage
          .from(file.storage_bucket)
          .createSignedUrl(file.storage_path, 300);

        if (error || !data?.signedUrl) {
          toast({
            title: "Erro ao carregar preview",
            description: "Não foi possível visualizar o arquivo.",
            variant: "destructive",
          });
          return;
        }

        setPreviewUrl(data.signedUrl);
        setPreviewFile(file);
      } catch (err) {
        console.error("[ClientFilesCard] Erro ao carregar preview:", err);
      }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Deletar arquivo
    // ─────────────────────────────────────────────────────────────────────────
    const handleDeleteFile = async (file: ClientFile) => {
      if (!confirm(`Remover o arquivo "${file.file_name}"?`)) return;

      try {
        // Remove do storage
        const { error: storageError } = await supabase.storage
          .from(file.storage_bucket)
          .remove([file.storage_path]);

        if (storageError) {
          console.error("[ClientFilesCard] Erro ao remover do storage:", storageError);
        }

        // Remove do banco
        const { error: dbError } = await supabase
          .from("client_files")
          .delete()
          .eq("id", file.id);

        if (dbError) throw dbError;

        toast({ title: "Arquivo removido" });
        loadFiles();
      } catch (err) {
        console.error("[ClientFilesCard] Erro ao remover arquivo:", err);
        toast({
          title: "Erro ao remover arquivo",
          variant: "destructive",
        });
      }
    };


    // ─────────────────────────────────────────────────────────────────────────
    // Scanner handlers
    // ─────────────────────────────────────────────────────────────────────────
    const handleScanComplete = (files: File[]) => {
      if (files.length > 0) {
        setSelectedFiles(prev => [...prev, ...files]);
      }
      setScannerOpen(false);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    if (loadingFiles) {
      return (
        <Card ref={ref} className="overflow-hidden h-full flex flex-col">
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 to-slate-50 dark:from-blue-950/30 dark:to-slate-900/50 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20">
                <Paperclip className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Arquivos do Cliente</h3>
                <p className="text-sm text-muted-foreground">Documentos digitalizados e anexos</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card ref={ref} className="overflow-hidden h-full flex flex-col">
        {/* Header Premium */}
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 to-slate-50 dark:from-blue-950/30 dark:to-slate-900/50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20">
                <Paperclip className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Arquivos do Cliente</h3>
                <p className="text-sm text-muted-foreground">Documentos digitalizados e anexos</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {files.length > 0 && (
                <>
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">
                    {files.length} arquivo{files.length !== 1 ? "s" : ""}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-6 flex-1">
        {/* Painéis Principais (pareamento fixo em 2 linhas) */}
          <div className="space-y-6">
            {/* LINHA 1: Identidade + Assinatura (sempre visível) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Documento de Identidade */}
              <div>
                {panelFiles[0]?.file ? (
                  <DocumentPanel
                    panel={panelFiles[0]}
                    file={panelFiles[0].file}
                    imageUrl={panelFiles[0].file ? fileUrls[panelFiles[0].file.id] : undefined}
                    onPreview={() => handlePreview(panelFiles[0].file!)}
                    onDownload={() => handleDownload(panelFiles[0].file!)}
                    onDelete={() => handleDeleteFile(panelFiles[0].file!)}
                  />
                ) : (
                  <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
                      <div className="p-1.5 rounded-md bg-primary/10">
                        <IdCard className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">Documento de Identidade</span>
                    </div>
                    <div className="aspect-[1.58/1] bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-700 m-3 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">Nenhum documento</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Assinatura (integrada) */}
              <div>
                <div className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-all duration-200">
                  {/* Header */}
                  <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <PenLine className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">Assinatura</span>
                    {latestSignature ? (
                      <Badge className="ml-auto bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 text-xs gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Coletada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-auto text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700 text-xs gap-1">
                        <Clock className="h-3 w-3" />
                        Pendente
                      </Badge>
                    )}
                  </div>

                  {/* Preview da assinatura ou botão coletar */}
                  <div 
                    className={`aspect-[1.58/1] bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 m-3 rounded-lg shadow-sm overflow-hidden flex items-center justify-center ${latestSignature?.signature_base64 ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors' : ''}`}
                    onClick={latestSignature?.signature_base64 ? handleOpenSignatureModal : undefined}
                    title={latestSignature?.signature_base64 ? "Clique para coletar nova assinatura" : undefined}
                  >
                    {latestSignature?.signature_base64 ? (
                      <img
                        src={latestSignature.signature_base64}
                        alt="Assinatura do cliente"
                        className="max-h-full max-w-full object-contain p-2"
                      />
                    ) : (
                      <Button
                        variant="outline"
                        onClick={handleOpenSignatureModal}
                        className="hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        <Pen className="h-4 w-4 mr-2" />
                        Coletar assinatura
                      </Button>
                    )}
                  </div>

                  {/* Footer info */}
                  {latestSignature && (
                    <div className="px-3 pb-3">
                      <span className="text-sm text-muted-foreground truncate block max-w-[200px]">
                        {latestSignature.signer_name}
                      </span>
                      <span className="text-xs text-muted-foreground/70">
                        {format(new Date(latestSignature.signed_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* LINHA 2: Contrato + Comprovante */}
            {(panelFiles[2]?.file || panelFiles[3]?.file) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  {panelFiles[2]?.file && (
                    <DocumentPanel
                      panel={panelFiles[2]}
                      file={panelFiles[2].file}
                      imageUrl={panelFiles[2].file ? fileUrls[panelFiles[2].file.id] : undefined}
                      onPreview={() => handlePreview(panelFiles[2].file!)}
                      onDownload={() => handleDownload(panelFiles[2].file!)}
                      onDelete={() => handleDeleteFile(panelFiles[2].file!)}
                    />
                  )}
                </div>
                <div>
                  {panelFiles[3]?.file && (
                    <DocumentPanel
                      panel={panelFiles[3]}
                      file={panelFiles[3].file}
                      imageUrl={panelFiles[3].file ? fileUrls[panelFiles[3].file.id] : undefined}
                      onPreview={() => handlePreview(panelFiles[3].file!)}
                      onDownload={() => handleDownload(panelFiles[3].file!)}
                      onDelete={() => handleDeleteFile(panelFiles[3].file!)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Seção Outros Anexos (condicional) */}
          {otherFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  Outros Anexos
                  <Badge variant="outline" className="text-xs">
                    {otherFiles.length}
                  </Badge>
                </h4>
                <Button size="sm" variant="outline" onClick={() => setUploadFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar anexo
                </Button>
              </div>

              {/* Grid de miniaturas */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {otherFiles.map((file) => {
                  const isImage = file.mime_type?.startsWith("image/");
                  return (
                    <div
                      key={file.id}
                      className="group relative rounded-lg border bg-muted/30 overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => handlePreview(file)}
                    >
                      {/* Botão de remover */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file);
                        }}
                        title="Remover arquivo"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <div className="aspect-square flex items-center justify-center">
                        {isImage && fileUrls[file.id] ? (
                          <img
                            src={fileUrls[file.id]}
                            alt={file.file_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-muted-foreground/60">
                            <FileText className="h-8 w-8" />
                            <span className="text-[10px]">
                              {file.file_name.split(".").pop()?.toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Overlay com info */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white truncate">
                          {file.description || file.file_name}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Formulário de Upload (apenas para Outros) */}
          {uploadFormOpen && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Novo Anexo</h4>
                <Button size="sm" variant="ghost" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Comprovante de residência"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setScannerOpen(true)}
                  >
                    <ScanLine className="h-4 w-4 mr-2" />
                    Escanear
                  </Button>
                  <label className="flex-1">
                    <Button type="button" variant="outline" className="w-full" asChild>
                      <span>
                        <Camera className="h-4 w-4 mr-2" />
                        Câmera
                      </span>
                    </Button>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setSelectedFiles(prev => [...prev, file]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="flex-1">
                    <Button type="button" variant="outline" className="w-full" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Arquivo
                      </span>
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) setSelectedFiles(prev => [...prev, ...files]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate flex-1">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => removeFileFromSelection(idx)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={handleUpload}
                    disabled={selectedFiles.length === 0 || uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      `Enviar ${selectedFiles.length > 0 ? selectedFiles.length : ""} Anexo${selectedFiles.length !== 1 ? "s" : ""}`
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    disabled={uploading}
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Estado vazio */}
          {files.length === 0 && !uploadFormOpen && (
            <div className="text-center py-8 space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Paperclip className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Nenhum arquivo</p>
                <p className="text-xs text-muted-foreground">
                  Os arquivos do cliente aparecerão aqui
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setUploadFormOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar anexo
              </Button>
            </div>
          )}

          {/* Botão para adicionar quando só tem painéis principais */}
          {hasMainPanels && otherFiles.length === 0 && !uploadFormOpen && (
            <div className="pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setUploadFormOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar outros anexos
              </Button>
            </div>
          )}
        </CardContent>

        {/* Scanner Modal */}
        <DocumentScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          mode="single"
          documentLabel="Documento"
          onCapture={handleScanComplete}
        />

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
                  onClick={handleClearSignature}
                  disabled={savingSignature}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Limpar
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveSignature}
                  disabled={!confirmConsent || savingSignature}
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

        {/* Preview Modal */}
        <Dialog open={!!previewFile} onOpenChange={() => { setPreviewFile(null); setPreviewUrl(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{previewFile?.file_name}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto min-h-0">
              {previewFile?.mime_type?.startsWith("image/") && previewUrl ? (
                <img
                  src={previewUrl}
                  alt={previewFile.file_name}
                  className="w-full h-auto max-h-[70vh] object-contain mx-auto"
                />
              ) : previewFile?.mime_type === "application/pdf" && previewUrl ? (
                <iframe
                  src={previewUrl}
                  title={previewFile.file_name}
                  className="w-full h-[70vh] border-0"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <FileText className="h-16 w-16 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Visualização não disponível para este tipo de arquivo
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => { setPreviewFile(null); setPreviewUrl(null); }}
              >
                Fechar
              </Button>
              <Button
                onClick={() => previewUrl && window.open(previewUrl, "_blank")}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }
);

ClientFilesCard.displayName = "ClientFilesCard";
