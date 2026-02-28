import React, { useRef, useState, useCallback } from "react";
import { Camera, X, FileImage, FileUp, Sparkles, Loader2, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { convertPdfFirstPageToImage } from "@/nija";
import { DocumentScannerModal } from "@/components/DocumentScannerModal";
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
  nationality?: string;
  marital_status?: string;
  profession?: string;
  address_line?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
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

const SUPABASE_FUNCTIONS_BASE = "https://uxrakfbedmkiqhidruxx.supabase.co/functions/v1";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4cmFrZmJlZG1raXFoaWRydXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2Nzc0NDksImV4cCI6MjA4MTI1MzQ0OX0.urYN1qLC5O_NHuiLamFEGTmjkskrOu6bldycZmOX-bo";

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
  const [scannerModalKind, setScannerModalKind] = useState<string>('IDENTIDADE');

  const handleScannerCapture = useCallback(async (capturedFiles: File[]) => {
    const newScannedFiles: ScannedFile[] = [];
    
    for (let i = 0; i < capturedFiles.length; i++) {
      const file = capturedFiles[i];
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
    
    // Replace existing files of same kind or add new
    const otherFiles = files.filter(f => f.kind !== scannerModalKind);
    onFilesChange([...otherFiles, ...newScannedFiles]);
    setScannerModalOpen(false);
    toast.success(`Documento capturado com sucesso!`);
  }, [scannerModalKind, files, onFilesChange]);

  const handlePaste = (e: React.ClipboardEvent, docKind: string) => {
    e.preventDefault();
    const items = e.clipboardData?.items;

    for (const item of Array.from(items || [])) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
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

      // Replace existing file of same kind or add new
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

    // Reset input
    event.target.value = "";
  };

  const handleRemove = (kind: string) => {
    onFilesChange(files.filter((f) => f.kind !== kind));
  };

  const getFileForKind = (kind: string) => files.find((f) => f.kind === kind);

  // Helper to convert PDF to image if needed
  const getDocumentImage = async (file: ScannedFile): Promise<string | null> => {
    // If it's already an image, return the dataUrl directly
    if (file.mimeType.startsWith("image/")) {
      return file.dataUrl;
    }

    // If it's a PDF, convert first page to image
    if (file.mimeType === "application/pdf") {
      try {
        // Convert dataUrl to File object for the conversion function
        const response = await fetch(file.dataUrl);
        const blob = await response.blob();
        const pdfFile = new File([blob], file.fileName, { type: "application/pdf" });

        const result = await convertPdfFirstPageToImage(pdfFile);

        if (!result.success || !result.imageBase64) {
          toast.error(`Erro ao processar PDF: ${result.error || "Falha na conversão"}`);
          return null;
        }

        // Show warning for multi-page PDFs
        if (result.totalPages && result.totalPages > 1) {
          toast.info(`PDF com ${result.totalPages} páginas. Apenas a 1ª página será analisada.`);
        }

        return result.imageBase64;
      } catch (err) {
        console.error("Error converting PDF:", err);
        toast.error("Erro ao converter PDF. Tente anexar uma imagem.");
        return null;
      }
    }

    // Unsupported file type
    toast.error("Formato não suportado. Use imagem ou PDF.");
    return null;
  };

  const extractDataFromDocuments = async () => {
    const identityFile = files.find((f) => f.kind === "IDENTIDADE");
    const addressFile = files.find((f) => f.kind === "COMPROVANTE_ENDERECO");

    if (!identityFile && !addressFile) {
      toast.error("Anexe pelo menos um documento para extrair dados");
      return;
    }

    setExtracting(true);

    try {
      const extractedData: ExtractedDocumentData = {};
      let fieldsExtracted = 0;

      // Extract from identity document
      if (identityFile) {
        try {
          const imageBase64 = await getDocumentImage(identityFile);
          if (!imageBase64) {
            // Skip this document but continue with others
          } else {
            const response = await fetch(`${SUPABASE_FUNCTIONS_BASE}/lexos-extract-document-data`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                imageBase64,
                focusOn: "identity",
              }),
            });

            if (response.status === 429) {
              toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
              return;
            }
            if (response.status === 402) {
              toast.error("Créditos insuficientes para extração. Continue manualmente.");
              return;
            }

            const result = await response.json();
            if (result.success && result.data) {
              Object.assign(extractedData, result.data);
              fieldsExtracted += result.fieldsFound?.length || Object.keys(result.data).length;
            }
          }
        } catch (err) {
          console.error("Error extracting identity:", err);
        }
      }

      // Extract from address document
      if (addressFile) {
        try {
          const imageBase64 = await getDocumentImage(addressFile);
          if (!imageBase64) {
            // Skip this document but continue with others
          } else {
            const response = await fetch(`${SUPABASE_FUNCTIONS_BASE}/lexos-extract-document-data`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                imageBase64,
                focusOn: "address",
              }),
            });

            if (response.status === 429) {
              toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
              return;
            }
            if (response.status === 402) {
              toast.error("Créditos insuficientes para extração. Continue manualmente.");
              return;
            }

            const result = await response.json();
            if (result.success && result.data) {
              // Merge address data (don't overwrite existing personal data)
              if (result.data.address_line) extractedData.address_line = result.data.address_line;
              if (result.data.neighborhood) extractedData.neighborhood = result.data.neighborhood;
              if (result.data.city) extractedData.city = result.data.city;
              if (result.data.state) extractedData.state = result.data.state;
              if (result.data.cep) extractedData.cep = result.data.cep;
              fieldsExtracted += result.fieldsFound?.length || Object.keys(result.data).length;
            }
          }
        } catch (err) {
          console.error("Error extracting address:", err);
        }
      }

      if (fieldsExtracted > 0) {
        toast.success(`${fieldsExtracted} campos extraídos automaticamente!`);
        onExtractedData?.(extractedData);
      } else {
        toast.info("Não foi possível extrair dados. Preencha manualmente.");
      }
    } catch (err) {
      console.error("Extraction error:", err);
      toast.error("Erro ao extrair dados. Tente novamente.");
    } finally {
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
              {/* Hidden inputs */}
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

      {/* AI Extraction Button */}
      {hasDocuments && (
        <Button
          type="button"
          onClick={extractDataFromDocuments}
          disabled={extracting}
          className="w-full gap-2"
          style={{
            backgroundColor: "var(--brand-primary)",
            color: "#000",
          }}
        >
          {extracting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analisando documentos...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Extrair dados com IA
            </>
          )}
        </Button>
      )}

      <p className="text-xs text-white/40 text-center">
        {hasDocuments
          ? "Clique em 'Extrair dados com IA' para preencher o formulário automaticamente"
          : "Opcional: você pode pular e digitar os dados manualmente"}
      </p>

      {/* Footer */}
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
          className="flex-1"
          variant="outline"
        >
          {hasDocuments ? "Continuar" : "Pular"}
        </Button>
      </div>

      {/* Paste Modal */}
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
              Depois selecione "Colar" no menu
            </p>
          </div>

          <p className="text-xs text-white/40 text-center">
            Funciona com prints de CNH Digital, comprovantes, etc.
          </p>
        </DialogContent>
      </Dialog>

      {/* Document Scanner Modal with visual guide */}
      <DocumentScannerModal
        open={scannerModalOpen}
        onClose={() => setScannerModalOpen(false)}
        mode={scannerModalKind === 'IDENTIDADE' ? 'double' : 'single'}
        documentLabel={scannerModalKind === 'IDENTIDADE' ? 'RG ou CNH' : 'Comprovante de Endereço'}
        onCapture={handleScannerCapture}
      />
    </div>
  );
}
