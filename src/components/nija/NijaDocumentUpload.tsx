// src/components/nija/NijaDocumentUpload.tsx
// Componente presentational para upload de documentos do NIJA
// Apenas renderiza UI e dispara callbacks - sem lógica de negócio

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProcessFile {
  id: string;
  file: File;
  filename: string;
  size: number;
  status: "uploading" | "extracting" | "ready" | "error" | "image_pdf" | "ocr_processing";
  extractedText: string;
  errorMessage?: string;
  isImagePdf?: boolean;
  extractionMethod?: "pdf_text" | "vision_ocr" | "text_file";
}

export interface ExtractionProgress {
  currentPage: number;
  totalPages: number;
  percent: number;
}

export interface NijaDocumentUploadProps {
  // Estado dos arquivos
  processFiles: ProcessFile[];
  
  // Callbacks
  onSelectFiles: () => void;
  onRemoveFile: (fileId: string) => void;
  onCancelExtraction: (fileId: string) => void;
  onRetryExtraction: (fileId: string) => void;
  onClearAll?: () => void;
  
  // Progresso
  getExtractionProgress: (fileId: string) => ExtractionProgress | null;
  
  // Contadores
  readyCount?: number;
  totalCount?: number;
  
  // Ref para input
  inputRef: React.RefObject<HTMLInputElement>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function NijaDocumentUpload({
  processFiles,
  onSelectFiles,
  onRemoveFile,
  onCancelExtraction,
  onRetryExtraction,
  onClearAll,
  getExtractionProgress,
  readyCount = 0,
  totalCount = 0,
  inputRef,
  onFileInputChange,
}: NijaDocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && inputRef.current) {
      const dataTransfer = new DataTransfer();
      Array.from(files).forEach(file => dataTransfer.items.add(file));
      inputRef.current.files = dataTransfer.files;
      onFileInputChange({ target: inputRef.current } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Arquivos do processo</CardTitle>
        </div>
        <CardDescription>
          Anexe PDFs, documentos Word ou imagens. Os arquivos são armazenados temporariamente para extração.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          type="file"
          ref={inputRef}
          className="hidden"
          accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif"
          multiple
          onChange={onFileInputChange}
        />

        {/* Zona de Drag & Drop */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={onSelectFiles}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer",
            isDragging 
              ? "border-primary bg-primary/5 scale-[1.02]" 
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <Upload className={cn("h-8 w-8 mx-auto mb-2", isDragging ? "text-primary" : "text-muted-foreground")} />
          <p className="text-sm font-medium">
            {isDragging ? "Solte os arquivos aqui" : "Arraste arquivos ou clique para selecionar"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, TXT, DOC, Imagens - máx 60MB
          </p>
        </div>

        {/* Header com contador e limpar todos */}
        {processFiles.length > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {readyCount}/{totalCount} prontos
            </span>
            {onClearAll && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearAll();
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Limpar todos
              </Button>
            )}
          </div>
        )}

        {processFiles.length > 0 && (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {processFiles.map((pf) => (
              <div
                key={pf.id}
                className="flex items-center justify-between gap-2 p-2 rounded border bg-muted/30"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{pf.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(pf.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pf.status === "uploading" && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Enviando...
                    </Badge>
                  )}
                  {pf.status === "extracting" && (() => {
                    const progress = getExtractionProgress(pf.id);
                    return (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          {progress && progress.totalPages > 0
                            ? `Página ${progress.currentPage}/${progress.totalPages} (${progress.percent}%)`
                            : "Extraindo..."}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => onCancelExtraction(pf.id)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    );
                  })()}
                  {pf.status === "ocr_processing" && (
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Lendo com IA...
                    </Badge>
                  )}
                  {pf.status === "ready" && (
                    <div className="flex items-center gap-1">
                      <Badge className="bg-green-600 text-white text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Pronto
                      </Badge>
                      {pf.extractionMethod === "vision_ocr" && (
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          OCR
                        </Badge>
                      )}
                    </div>
                  )}
                  {pf.status === "image_pdf" && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        PDF Imagem
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Sem texto extraível
                      </span>
                    </div>
                  )}
                  {pf.status === "error" && (
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {pf.errorMessage || "Falha"}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
                        onClick={() => onRetryExtraction(pf.id)}
                      >
                        Tentar novamente
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onRemoveFile(pf.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Os arquivos são salvos no storage para processamento. Documentos não vinculados a casos são removidos periodicamente.
        </p>
      </CardContent>
    </Card>
  );
}

NijaDocumentUpload.displayName = "NijaDocumentUpload";
