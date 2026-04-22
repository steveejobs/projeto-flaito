import React, { useRef, useState, useCallback } from "react";
import { Camera, X, FileImage, FileUp, Sparkles, Loader2, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { convertPdfFirstPageToImage } from "@/nija/connectors/pdf/pdfToImage";
import { DocumentScannerModal } from "@/components/DocumentScannerModal";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ScannedFile {
  kind: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  preview?: string;
}

export interface ExtractedDocumentData {
  full_name?: string;
  cpf?: string;
  rg?: string;
  rg_issuer?: string;
  birth_date?: string;
  nationality?: string;
  marital_status?: string;
  profession?: string;
  address_line?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  // Pessoa Jurídica
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
}

interface CaptureDocumentScanStepProps {
  files: ScannedFile[];
  onFilesChange: (files: ScannedFile[]) => void;
  onContinue: () => void;
  onBack: () => void;
  onExtractedData?: (data: ExtractedDocumentData) => void;
}

const DOC_TYPES = [
  { 
    kind: "IDENTIDADE", 
    label: "RG ou CNH", 
    hint: "CNH Digital? Anexe o PDF ou cole o print"
  },
  { 
    kind: "COMPROVANTE_ENDERECO", 
    label: "Comprovante de Endereço",
    hint: "Conta digital? Anexe o PDF ou cole o print"
  },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function CaptureDocumentScanStep({
  files,
  onFilesChange,
  onContinue,
  onBack,
  onExtractedData,
}: CaptureDocumentScanStepProps) {
  const cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [extracting, setExtracting] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState<string | null>(null);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [scannerModalKind, setScannerModalKind] = useState<string>("IDENTIDADE");

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite de 5MB.`);
      return false;
    }
    
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato não suportado. Use JPG, PNG, WEBP ou PDF.");
      return false;
    }

    if (file.size === 0) {
      toast.error("Arquivo parece estar vazio ou corrompido.");
      return false;
    }

    return true;
  };

  const handleScannerCapture = useCallback(async (capturedFiles: File[]) => {
    const newScannedFiles: ScannedFile[] = [];
    
    for (const file of capturedFiles) {
      if (!validateFile(file)) continue;

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      newScannedFiles.push({
        kind: scannerModalKind,
        fileName: file.name,
        mimeType: file.type,
        dataUrl,
        preview: dataUrl,
      });
    }
    
    if (newScannedFiles.length > 0) {
      const otherFiles = files.filter(f => f.kind !== scannerModalKind);
      onFilesChange([...otherFiles, ...newScannedFiles]);
      setScannerModalOpen(false);
      toast.success(`Documento capturado com sucesso!`);
    }
  }, [scannerModalKind, files, onFilesChange]);

  const handlePaste = (e: React.ClipboardEvent, docKind: string) => {
    e.preventDefault();
    const items = e.clipboardData?.items;

    for (const item of Array.from(items || [])) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          if (!validateFile(file)) return;

          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const newFile: ScannedFile = {
              kind: docKind,
              fileName: `colado_${Date.now()}.png`,
              mimeType: file.type,
              dataUrl,
              preview: dataUrl,
            };

            const existingIndex = files.findIndex((f) => f.kind === docKind);
            if (existingIndex >= 0) {
              const updated = [...files];
              updated[existingIndex] = newFile;
              onFilesChange(updated);
            } else {
              onFilesChange([...files, newFile]);
            }

            toast.success("Imagem colada com sucesso!");
          };
          reader.readAsDataURL(file);
          setPasteModalOpen(null);
          return;
        }
      }
    }

    toast.error("Nenhuma imagem encontrada. Copie uma imagem primeiro.");
  };

  const handleFileSelect = async (kind: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!validateFile(file)) {
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newFile: ScannedFile = {
        kind,
        fileName: file.name,
        mimeType: file.type,
        dataUrl,
        preview: file.type.startsWith("image/") ? dataUrl : undefined,
      };

      const existingIndex = files.findIndex((f) => f.kind === kind);
      if (existingIndex >= 0) {
        const updated = [...files];
        updated[existingIndex] = newFile;
        onFilesChange(updated);
      } else {
        onFilesChange([...files, newFile]);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleRemove = (kind: string) => {
    onFilesChange(files.filter((f) => f.kind !== kind));
  };

  const getFileForKind = (kind: string) => files.find((f) => f.kind === kind);

  // Compressão mais agressiva: largura até 1200px e qualidade 0.65
  // Reduz ~40% o tamanho da imagem sem perder legibilidade para OCR
  const compressImage = async (dataUrl: string, maxWidth = 1200, quality = 0.65): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = dataUrl;
    });
  };

  const getDocumentImage = async (file: ScannedFile): Promise<string | null> => {
    let finalDataUrl = file.dataUrl;

    if (file.mimeType === "application/pdf") {
      try {
        const response = await fetch(file.dataUrl);
        const blob = await response.blob();
        const pdfFile = new File([blob], file.fileName, { type: "application/pdf" });

        const result = await convertPdfFirstPageToImage(pdfFile);

        if (!result.success || !result.imageBase64) {
          toast.error(`Erro ao processar PDF: ${result.error || "Falha na conversão"}`);
          return null;
        }

        if (result.totalPages && result.totalPages > 1) {
          toast.info(`PDF com ${result.totalPages} páginas. Apenas a 1ª página será analisada.`);
        }

        finalDataUrl = result.imageBase64;
      } catch (err) {
        console.error("Error converting PDF:", err);
        toast.error("Erro ao converter PDF. Tente anexar uma imagem.");
        return null;
      }
    }

    // Compress anyway if it's an image or converted PDF
    try {
      console.log(`[IA] Comprimindo imagem original (${(finalDataUrl.length / 1024 / 1024).toFixed(2)} MB)...`);
      const compressed = await compressImage(finalDataUrl);
      console.log(`[IA] Imagem comprimida (${(compressed.length / 1024 / 1024).toFixed(2)} MB).`);
      return compressed;
    } catch (err) {
      console.warn("[IA] Falha na compressão, usando original:", err);
      return finalDataUrl;
    }
  };

  const extractDataFromDocuments = async () => {
    const identityFile = files.find((f) => f.kind === "IDENTIDADE");
    const addressFile = files.find((f) => f.kind === "COMPROVANTE_ENDERECO");

    if (!identityFile && !addressFile) {
      toast.error("Anexe pelo menos um documento para extrair dados");
      return;
    }

    setExtracting(true);

    console.group("IA Extraction Debug");
    console.log("Documents to process:", files.map(f => ({ doc: f.kind, size: f.dataUrl.length, type: f.mimeType })));
    
    try {
      const extractedData: ExtractedDocumentData = {};
      let totalFieldsFound = 0;

      // Timeout helper: rejeita após 25s com mensagem amigável
      const withTimeout = <T,>(promise: Promise<T>, ms = 25000): Promise<T> => {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), ms)
        );
        return Promise.race([promise, timeout]);
      };

      // Prepara as imagens em paralelo antes de enviar
      const [identityImage, addressImage] = await Promise.all([
        identityFile ? getDocumentImage(identityFile) : Promise.resolve(null),
        addressFile ? getDocumentImage(addressFile) : Promise.resolve(null),
      ]);

      // Chama a IA para os dois documentos em paralelo
      const [identityResult, addressResult] = await Promise.all([
        identityImage
          ? withTimeout(supabase.functions.invoke("lexos-extract-document-data", {
              body: { imageBase64: identityImage, focusOn: "identity" }
            }))
          : Promise.resolve({ data: null, error: null }),
        addressImage
          ? withTimeout(supabase.functions.invoke("lexos-extract-document-data", {
              body: { imageBase64: addressImage, focusOn: "address" }
            }))
          : Promise.resolve({ data: null, error: null }),
      ]);

      console.log("Identity result:", identityResult);
      console.log("Address result:", addressResult);

      if (identityResult.error) throw identityResult.error;
      if (addressResult.error) throw addressResult.error;

      // Mescla dados de identidade
      if (identityResult.data?.success && identityResult.data?.data) {
        Object.assign(extractedData, identityResult.data.data);
        totalFieldsFound += identityResult.data.fieldsFound?.length || 0;
      }

      // Mescla apenas campos de endereço do comprovante
      if (addressResult.data?.success && addressResult.data?.data) {
        const addr = addressResult.data.data;
        if (addr.address_line) extractedData.address_line = addr.address_line;
        if (addr.neighborhood) extractedData.neighborhood = addr.neighborhood;
        if (addr.city) extractedData.city = addr.city;
        if (addr.state) extractedData.state = addr.state;
        if (addr.cep) extractedData.cep = addr.cep;
        totalFieldsFound += addressResult.data.fieldsFound?.length || 0;
      }

      if (totalFieldsFound > 0) {
        toast.success(`${totalFieldsFound} campos extraídos com sucesso!`);
        onExtractedData?.(extractedData);
      } else {
        toast.warning("Não foi possível extrair dados legíveis destes documentos.");
      }
    } catch (err: any) {
      console.error("Extraction error (FULL):", err);
      
      let errorMessage = "Erro de conexão com o servidor";
      
      if (err.message === "timeout") {
        toast.error("A análise demorou muito. Tente com uma imagem mais leve ou preencha manualmente.");
        return;
      }

      if (err.context) {
        try {
          const body = await err.context.json();
          errorMessage = body.error || body.message || errorMessage;
        } catch (e) {
          errorMessage = err.message || errorMessage;
        }
      } else {
        errorMessage = err.message || errorMessage;
      }

      const status = err.status || err.statusCode;

      if (status === 402 || errorMessage.includes("Créditos")) {
        toast.error("Créditos insuficientes para extrair dados automaticamente. Preencha manualmente.");
      } else if (status === 401 || status === 403) {
        toast.error("Sua sessão pode ter expirado ou permissão negada. Tente fazer login novamente.");
      } else if (status === 429) {
        toast.error("Muitas tentativas simultâneas. Aguarde um momento.");
      } else {
        toast.error(`Falha no preenchimento: ${errorMessage}`);
        console.warn("Dica: Verifique se a OPENAI_API_KEY está configurada no Supabase Secrets.");
      }
    } finally {
      console.groupEnd();
      setExtracting(false);
    }
  };

  const hasDocuments = files.length > 0;

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Anexar Documentos
        </h2>
        <p className="text-sm text-white/60 mt-1">
          Fotografe ou selecione os documentos
        </p>
      </div>

      <div className="space-y-4">
        {DOC_TYPES.map((docType) => {
          const file = getFileForKind(docType.kind);

          return (
            <div key={docType.kind}>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={(el) => (cameraInputRefs.current[docType.kind] = el)}
                onChange={(e) => handleFileSelect(docType.kind, e)}
                className="hidden"
              />
              <input
                type="file"
                accept="image/*,application/pdf"
                ref={(el) => (fileInputRefs.current[docType.kind] = el)}
                onChange={(e) => handleFileSelect(docType.kind, e)}
                className="hidden"
              />

              {file ? (
                <div className="relative p-4 rounded-xl border border-white/20 bg-white/5">
                  <div className="flex items-center gap-3">
                    {file.preview ? (
                      <img
                        src={file.preview}
                        alt={file.fileName}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center">
                        <FileImage className="w-6 h-6 text-white/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {docType.label}
                      </p>
                      <p className="text-xs text-white/50 truncate">
                        {file.fileName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(docType.kind)}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4 text-white/60" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-white/20 bg-white/5 space-y-3">
                  <p className="text-base font-medium text-white text-center">
                    {docType.label}
                  </p>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScannerModalKind(docType.kind);
                        setScannerModalOpen(true);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-xl",
                        "bg-white/10 hover:bg-white/15 border border-white/10",
                        "transition-all duration-200 active:scale-[0.98]"
                      )}
                    >
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                        <Camera className="w-4 h-4 text-white/70" />
                      </div>
                      <span className="text-xs font-medium text-white">Fotografar</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[docType.kind]?.click()}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-xl",
                        "bg-white/10 hover:bg-white/15 border border-white/10",
                        "transition-all duration-200 active:scale-[0.98]"
                      )}
                    >
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                        <FileUp className="w-4 h-4 text-white/70" />
                      </div>
                      <span className="text-xs font-medium text-white">Anexar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPasteModalOpen(docType.kind)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-xl",
                        "bg-white/10 hover:bg-white/15 border border-white/10",
                        "transition-all duration-200 active:scale-[0.98]"
                      )}
                    >
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                        <Clipboard className="w-4 h-4 text-white/70" />
                      </div>
                      <span className="text-xs font-medium text-white">Colar</span>
                    </button>
                  </div>
                  
                  <p className="text-xs text-white/40 text-center">
                    {docType.hint}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasDocuments && (
        <Button
          type="button"
          onClick={extractDataFromDocuments}
          disabled={extracting}
          className={cn(
            "w-full gap-3 h-14 rounded-2xl transition-all duration-300",
            "bg-gradient-to-r from-[var(--brand-primary)] to-[#818cf8]",
            "hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/20 active:scale-[0.98]",
            "border-none text-white font-bold text-base",
            extracting ? "opacity-90" : "animate-pulse-subtle"
          )}
        >
          {extracting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 fill-white/20" />
              Extrair
            </>
          )}
        </Button>
      )}

      <p className="text-xs text-white/40 text-center">
        {hasDocuments
          ? "Clique em 'Extrair' para ler os dados automaticamente"
          : "Opcional: você pode pular e digitar os dados manualmente"}
      </p>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
        >
          Voltar
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          disabled={extracting}
          className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40 transition-colors"
          variant="outline"
        >
          {hasDocuments ? "Continuar" : "Pular"}
        </Button>
      </div>

      <Dialog open={pasteModalOpen !== null} onOpenChange={() => setPasteModalOpen(null)}>
        <DialogContent className="bg-slate-900 border-white/20 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-center">Colar Imagem</DialogTitle>
          </DialogHeader>
          
          <div 
            tabIndex={0}
            onPaste={(e) => handlePaste(e, pasteModalOpen!)}
            className={cn(
              "min-h-[180px] border-2 border-dashed border-white/30 rounded-xl",
              "flex flex-col items-center justify-center bg-white/5",
              "focus:ring-2 focus:ring-primary focus:border-primary/50",
              "cursor-pointer transition-all outline-none"
            )}
          >
            <Clipboard className="h-10 w-10 text-white/40 mb-3" />
            <p className="font-medium text-white text-center px-4">
              Toque e segure aqui
            </p>
            <p className="text-sm text-white/50 mt-1 text-center px-4">
              Depois selecione \"Colar\" no menu
            </p>
          </div>

          <p className="text-xs text-white/40 text-center">
            Funciona com prints de CNH Digital, comprovantes, etc.
          </p>
        </DialogContent>
      </Dialog>

      <DocumentScannerModal
        open={scannerModalOpen}
        onClose={() => setScannerModalOpen(false)}
        mode={scannerModalKind === "IDENTIDADE" ? "double" : "single"}
        documentLabel={scannerModalKind === "IDENTIDADE" ? "RG ou CNH" : "Comprovante de Endereço"}
        onCapture={handleScannerCapture}
      />
    </div>
  );
}
