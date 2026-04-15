import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, Loader2, Sparkles, FileText, Home, X, FolderOpen, ZoomIn, ImageOff } from "lucide-react";
import { convertPdfFirstPageToImage } from "@/nija/connectors/pdf/pdfToImage";
import { DocumentScannerModal } from "@/components/DocumentScannerModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ExtractedData = {
  full_name?: string | null;
  cpf?: string | null;
  rg?: string | null;
  rg_issuer?: string | null;
  birth_date?: string | null;
  nationality?: string | null;
  marital_status?: string | null;
  profession?: string | null;
  address_line?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
};

export type ScannedDocument = {
  file: File;
  preview: string;
  kind: 'IDENTIDADE' | 'COMPROVANTE_ENDERECO';
};

type Props = {
  onDataExtracted: (data: ExtractedData) => void;
  disabled?: boolean;
  scannedDocuments: ScannedDocument[];
  onScannedDocumentsChange: (docs: ScannedDocument[]) => void;
};

export function DocumentScanner({ 
  onDataExtracted, 
  disabled, 
  scannedDocuments,
  onScannedDocumentsChange 
}: Props) {
  const { toast } = useToast();
  const docCameraRef = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);
  const addressCameraRef = useRef<HTMLInputElement>(null);
  const addressFileRef = useRef<HTMLInputElement>(null);
  
  const [extracting, setExtracting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<'IDENTIDADE' | 'COMPROVANTE_ENDERECO' | null>(null);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [scannerModalKind, setScannerModalKind] = useState<'IDENTIDADE' | 'COMPROVANTE_ENDERECO'>('IDENTIDADE');

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB - limite do bucket

  const addDocumentFile = useCallback((file: File, kind: 'IDENTIDADE' | 'COMPROVANTE_ENDERECO') => {
    // Validar tamanho do arquivo
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: `O arquivo "${file.name}" excede o limite de 10MB.`,
        variant: "destructive",
      });
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    const isAccepted = isImage || isPdf || file.type.includes("document");

    if (isAccepted) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newDoc: ScannedDocument = {
          file,
          preview: isImage ? (ev.target?.result as string) : "",
          kind
        };
        onScannedDocumentsChange([...scannedDocuments, newDoc]);
      };
      reader.readAsDataURL(file);
    }
  }, [scannedDocuments, onScannedDocumentsChange, toast]);

  const handleScannerCapture = useCallback((files: File[]) => {
    files.forEach(file => {
      addDocumentFile(file, scannerModalKind);
    });
    setScannerModalOpen(false);
  }, [scannerModalKind, addDocumentFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, kind: 'IDENTIDADE' | 'COMPROVANTE_ENDERECO') => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    files.forEach(file => addDocumentFile(file, kind));
    e.target.value = '';
  };

  const handlePaste = useCallback((e: React.ClipboardEvent, kind: 'IDENTIDADE' | 'COMPROVANTE_ENDERECO') => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/") || item.type === "application/pdf") {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          addDocumentFile(file, kind);
          toast({
            title: "Arquivo colado!",
            description: `Arquivo adicionado como ${kind === 'IDENTIDADE' ? 'documento pessoal' : 'comprovante de endereço'}.`,
          });
        }
        break;
      }
    }
  }, [addDocumentFile, toast]);

  const handleDragOver = (e: React.DragEvent, kind: 'IDENTIDADE' | 'COMPROVANTE_ENDERECO') => {
    e.preventDefault();
    setIsDragging(kind);
  };

  const handleDragLeave = () => {
    setIsDragging(null);
  };

  const handleDrop = (e: React.DragEvent, kind: 'IDENTIDADE' | 'COMPROVANTE_ENDERECO') => {
    e.preventDefault();
    setIsDragging(null);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => addDocumentFile(file, kind));
  };

  const removeDocument = (index: number) => {
    const updated = scannedDocuments.filter((_, i) => i !== index);
    onScannedDocumentsChange(updated);
  };

  // Verifica se há documentos válidos para extração (imagens ou PDFs)
  const hasExtractableDocuments = scannedDocuments.some(
    d => d.file.type.startsWith("image/") || d.file.type === "application/pdf"
  );

  // Função auxiliar para obter imagem de um documento (converte PDF se necessário)
  const getDocumentImage = async (doc: ScannedDocument): Promise<string | null> => {
    // Se é imagem com preview, usar diretamente
    if (doc.file.type.startsWith("image/") && doc.preview && doc.preview.startsWith("data:image/")) {
      return doc.preview;
    }
    
    // Se é PDF, converter primeira página para imagem
    if (doc.file.type === "application/pdf") {
      console.log("[DocumentScanner] Convertendo PDF para imagem:", doc.file.name);
      const result = await convertPdfFirstPageToImage(doc.file);
      
      if (result.success && result.imageBase64) {
        if (result.totalPages && result.totalPages > 1) {
          toast({
            title: "Aviso: PDF com múltiplas páginas",
            description: `O PDF "${doc.file.name}" tem ${result.totalPages} páginas. Apenas a 1ª página será analisada.`,
          });
        }
        return result.imageBase64;
      } else {
        console.error("[DocumentScanner] Erro ao converter PDF:", result.error);
        toast({
          title: "Erro ao processar PDF",
          description: `Não foi possível converter "${doc.file.name}". Tente enviar uma foto.`,
          variant: "destructive",
        });
        return null;
      }
    }
    
    return null;
  };

  const extractDataFromImages = async () => {
    if (scannedDocuments.length === 0) return;

    // Filtrar documentos que podem ser extraídos (imagens e PDFs)
    const extractableDocs = scannedDocuments.filter(
      d => d.file.type.startsWith("image/") || d.file.type === "application/pdf"
    );

    if (extractableDocs.length === 0) {
      toast({
        title: "Nenhum documento para extrair",
        description: "Anexe fotos (JPG, PNG) ou PDFs para extração automática.",
        variant: "destructive",
      });
      return;
    }

    setExtracting(true);
    
    try {
      const personalDoc = extractableDocs.find(d => d.kind === 'IDENTIDADE');
      const addressDoc = extractableDocs.find(d => d.kind === 'COMPROVANTE_ENDERECO');
      
      let extractedData: ExtractedData = {};
      let totalFieldsFound = 0;

      if (personalDoc) {
        console.log("[DocumentScanner] Processando documento pessoal...", {
          fileType: personalDoc.file.type,
          fileName: personalDoc.file.name
        });
        
        const imageBase64 = await getDocumentImage(personalDoc);
        
        if (imageBase64) {
          const { data, error } = await supabase.functions.invoke("lexos-extract-document-data", {
            body: { imageBase64 }
          });

          if (error) {
            console.error("[DocumentScanner] Erro documento pessoal:", error);
            if (error.message?.includes("429") || error.message?.includes("rate")) {
              toast({
                title: "Limite de requisições",
                description: "Aguarde alguns segundos e tente novamente.",
                variant: "destructive",
              });
              return;
            }
            if (error.message?.includes("402") || error.message?.includes("payment")) {
              toast({
                title: "Créditos insuficientes",
                description: "Entre em contato com o suporte para adicionar créditos.",
                variant: "destructive",
              });
              return;
            }
          } else if (data?.success && data?.data) {
            extractedData = { ...extractedData, ...data.data };
            totalFieldsFound += data.fieldsFound?.length || 0;
          }
        }
      }

      if (addressDoc) {
        console.log("[DocumentScanner] Processando comprovante de endereço...", {
          fileType: addressDoc.file.type,
          fileName: addressDoc.file.name
        });
        
        const imageBase64 = await getDocumentImage(addressDoc);
        
        if (imageBase64) {
          const { data, error } = await supabase.functions.invoke("lexos-extract-document-data", {
            body: { 
              imageBase64,
              focusOn: 'address'
            }
          });

          if (error) {
            console.error("[DocumentScanner] Erro comprovante endereço:", error);
          } else if (data?.success && data?.data) {
            const addressFields = ['address_line', 'neighborhood', 'city', 'state', 'cep'];
            addressFields.forEach(field => {
              if (data.data[field]) {
                extractedData[field as keyof ExtractedData] = data.data[field];
              }
            });
            totalFieldsFound += data.fieldsFound?.filter((f: string) => addressFields.includes(f)).length || 0;
          }
        }
      }

      // Avisar se havia docs que não puderam ser processados
      const nonExtractableDocs = scannedDocuments.filter(
        d => !d.file.type.startsWith("image/") && d.file.type !== "application/pdf"
      );
      const hasIgnoredDocs = nonExtractableDocs.length > 0;

      if (totalFieldsFound > 0) {
        onDataExtracted(extractedData);
        toast({
          title: "Dados extraídos!",
          description: hasIgnoredDocs 
            ? `${totalFieldsFound} campo(s) encontrado(s). Alguns arquivos foram ignorados.`
            : `${totalFieldsFound} campo(s) encontrado(s) nos documentos.`,
        });
      } else {
        toast({
          title: "Nenhum dado encontrado",
          description: "Não foi possível identificar dados. Tente documentos mais nítidos.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("[DocumentScanner] Erro inesperado:", err);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível processar os documentos.",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const personalDocs = scannedDocuments.filter(d => d.kind === 'IDENTIDADE');
  const addressDocs = scannedDocuments.filter(d => d.kind === 'COMPROVANTE_ENDERECO');

  const DocumentDropZone = ({ 
    kind, 
    docs, 
    cameraRef, 
    fileRef, 
    label, 
    icon: Icon 
  }: { 
    kind: 'IDENTIDADE' | 'COMPROVANTE_ENDERECO';
    docs: ScannedDocument[];
    cameraRef: React.RefObject<HTMLInputElement>;
    fileRef: React.RefObject<HTMLInputElement>;
    label: string;
    icon: typeof FileText;
  }) => (
    <div 
      className="space-y-2"
      onPaste={(e) => handlePaste(e, kind)}
      tabIndex={0}
    >
      <label className="text-sm font-medium flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </label>
      
      {/* Hidden inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileChange(e, kind)}
        disabled={disabled || extracting}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        multiple
        className="hidden"
        onChange={(e) => handleFileChange(e, kind)}
        disabled={disabled || extracting}
      />
      
      {/* Drop zone */}
      <div
        onDragOver={(e) => handleDragOver(e, kind)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, kind)}
        className={`
          border-2 border-dashed rounded-lg p-3 transition-colors
          ${isDragging === kind 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }
        `}
      >
        {docs.length === 0 ? (
          <div className="text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              Arraste uma imagem ou cole (Ctrl+V)
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 transition-colors"
                onClick={() => {
                  setScannerModalKind(kind);
                  setScannerModalOpen(true);
                }}
                disabled={disabled || extracting}
              >
                <Camera className="h-4 w-4 mr-1 text-teal-600" />
                Câmera
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
                onClick={() => fileRef.current?.click()}
                disabled={disabled || extracting}
              >
                <FolderOpen className="h-4 w-4 mr-1 text-blue-600" />
                Arquivo
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {docs.map((doc, i) => {
              const globalIndex = scannedDocuments.findIndex(d => d === doc);
              const isImage = doc.file.type.startsWith("image/");
              const isPdf = doc.file.type === "application/pdf";
              
              return (
                <div 
                  key={i} 
                  className="relative aspect-[4/3] rounded-lg overflow-hidden border bg-muted group cursor-pointer"
                  onClick={() => isImage && doc.preview ? setPreviewImage(doc.preview) : null}
                >
                  {isImage && doc.preview ? (
                    <>
                      <img src={doc.preview} alt={`Documento ${i+1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground text-center truncate max-w-full">
                        {isPdf ? 'PDF' : doc.file.name.split('.').pop()?.toUpperCase()}
                      </span>
                      <span className="text-[9px] text-muted-foreground/70 truncate max-w-full">
                        {doc.file.name}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDocument(globalIndex);
                    }}
                    className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1 aspect-[4/3] flex flex-col items-center justify-center gap-1 hover:bg-teal-50 hover:text-teal-700 border-teal-100/50"
                onClick={() => {
                  setScannerModalKind(kind);
                  setScannerModalOpen(true);
                }}
                disabled={disabled || extracting}
              >
                <Camera className="h-4 w-4 text-teal-600" />
                <span className="text-[10px]">Foto</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 aspect-[4/3] flex flex-col items-center justify-center gap-1 hover:bg-blue-50 hover:text-blue-700 border-blue-100/50"
                onClick={() => fileRef.current?.click()}
                disabled={disabled || extracting}
              >
                <FolderOpen className="h-4 w-4 text-blue-600" />
                <span className="text-[10px]">Arquivo</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-5 w-5" />
            Digitalizar documentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tire fotos do RG/CNH e do comprovante de residência. A IA vai extrair os dados automaticamente.
          </p>

          <DocumentDropZone
            kind="IDENTIDADE"
            docs={personalDocs}
            cameraRef={docCameraRef}
            fileRef={docFileRef}
            label="Documento pessoal (RG/CNH)"
            icon={FileText}
          />

          <DocumentDropZone
            kind="COMPROVANTE_ENDERECO"
            docs={addressDocs}
            cameraRef={addressCameraRef}
            fileRef={addressFileRef}
            label="Comprovante de endereço"
            icon={Home}
          />

          {scannedDocuments.length > 0 && (
            <div className="space-y-2">
              <Button
                type="button"
                variant={hasExtractableDocuments ? "default" : "secondary"}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-all"
                onClick={extractDataFromImages}
                disabled={disabled || extracting || !hasExtractableDocuments}
              >
                {!hasExtractableDocuments ? (
                  <>
                    <ImageOff className="h-4 w-4 mr-2" />
                    Anexe fotos ou PDFs para extrair dados
                  </>
                ) : extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extraindo dados...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Extrair dados com IA
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="text-xs text-muted-foreground flex items-start gap-2 p-2 bg-muted/30 rounded">
            <FileText className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Dica: Use fotos nítidas ou PDFs dos documentos. Para PDFs com múltiplas páginas, apenas a 1ª página será analisada.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Visualização do documento</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="flex items-center justify-center overflow-auto">
              <img 
                src={previewImage} 
                alt="Documento ampliado" 
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Document Scanner Modal with visual guide */}
      <DocumentScannerModal
        open={scannerModalOpen}
        onClose={() => setScannerModalOpen(false)}
        mode={scannerModalKind === 'IDENTIDADE' ? 'double' : 'single'}
        documentLabel={scannerModalKind === 'IDENTIDADE' ? 'Documento Pessoal' : 'Comprovante de Endereço'}
        onCapture={handleScannerCapture}
      />
    </>
  );
}

// Mapeamento de nomes amigáveis para tipos de documentos
const kindFriendlyNames: Record<'IDENTIDADE' | 'COMPROVANTE_ENDERECO', string> = {
  IDENTIDADE: "Identidade",
  COMPROVANTE_ENDERECO: "Comprovante de Endereco",
};

// Helper function to save scanned documents to client_files
export async function saveScannedDocumentsToClientFiles(
  scannedDocuments: ScannedDocument[],
  clientId: string,
  officeId: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const doc of scannedDocuments) {
    try {
      // Gerar nome amigável baseado no tipo do documento
      const extension = doc.file.name.split('.').pop() || 'jpg';
      const friendlyName = kindFriendlyNames[doc.kind];
      
      // Numerar se houver múltiplos do mesmo tipo
      const sameKindIndex = scannedDocuments
        .slice(0, scannedDocuments.indexOf(doc))
        .filter(d => d.kind === doc.kind).length;
      const suffix = sameKindIndex > 0 ? ` (${sameKindIndex + 1})` : '';
      
      const displayFileName = `${friendlyName}${suffix}.${extension}`;
      const sanitizedStorageName = displayFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      
      // Generate unique storage path
      const timestamp = Date.now();
      const storagePath = `${officeId}/${clientId}/${timestamp}_${sanitizedStorageName}`;
      
      // Upload directly to client-files bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("client-files")
        .upload(storagePath, doc.file, {
          contentType: doc.file.type,
          upsert: false
        });

      if (uploadError) {
        console.error("[saveScannedDocuments] Upload error:", uploadError);
        errors.push(`Erro ao fazer upload de ${displayFileName}: ${uploadError.message}`);
        continue;
      }

      console.log("[saveScannedDocuments] Uploaded to:", uploadData.path);

      // Insert record in client_files with friendly name
      const { error: insertError } = await supabase.from("client_files").insert({
        client_id: clientId,
        office_id: officeId,
        file_name: displayFileName,
        file_size: doc.file.size,
        mime_type: doc.file.type,
        storage_bucket: "client-files",
        storage_path: storagePath,
        kind: doc.kind,
        description: doc.kind === 'IDENTIDADE' 
          ? 'Documento de identificação (digitalizado no cadastro)' 
          : 'Comprovante de endereço (digitalizado no cadastro)',
        metadata: { 
          auto_scanned: true, 
          scanned_at: new Date().toISOString(),
          original_filename: doc.file.name
        }
      });

      if (insertError) {
        console.error("[saveScannedDocuments] Insert error:", insertError);
        errors.push(`Erro ao registrar ${displayFileName}`);
        continue;
      }

      console.log(`[saveScannedDocuments] Saved: ${displayFileName}`);
    } catch (err) {
      console.error("[saveScannedDocuments] Unexpected error:", err);
      errors.push(`Erro inesperado com ${doc.file.name}`);
    }
  }

  return { success: errors.length === 0, errors };
}
