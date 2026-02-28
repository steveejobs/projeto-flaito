// src/components/nija/NijaComplementaryDoc.tsx
// Componente para documento complementar do NIJA com drag & drop

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUp, Upload, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NijaComplementaryDocProps {
  label: string;
  onLabelChange: (label: string) => void;
  text: string;
  onTextChange: (text: string) => void;
  onClear?: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function NijaComplementaryDoc({
  label,
  onLabelChange,
  text,
  onTextChange,
  onClear,
  inputRef,
  onFileInputChange,
}: NijaComplementaryDocProps) {
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
      dataTransfer.items.add(files[0]); // Only first file for complementary
      inputRef.current.files = dataTransfer.files;
      onFileInputChange({ target: inputRef.current } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const hasContent = label.trim().length > 0 || text.trim().length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Documento complementar</CardTitle>
          </div>
          {hasContent && onClear && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={onClear}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>
        <CardDescription>
          Use para sentenças, acórdãos, despachos, peças ou trechos específicos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="Nome / rótulo do documento (ex.: Sentença, Acórdão, Contrato)"
          className="text-sm"
        />

        <input
          type="file"
          ref={inputRef}
          className="hidden"
          accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif"
          onChange={onFileInputChange}
        />

        {/* Zona de Drag & Drop */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer",
            isDragging 
              ? "border-primary bg-primary/5 scale-[1.02]" 
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <Upload className={cn("h-6 w-6 mx-auto mb-1", isDragging ? "text-primary" : "text-muted-foreground")} />
          <p className="text-xs font-medium">
            {isDragging ? "Solte o arquivo aqui" : "Arraste arquivo ou clique para anexar"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            PDF, TXT, DOC, Imagens
          </p>
        </div>

        <Textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          rows={6}
          placeholder="Cole aqui o conteúdo da peça, decisão, sentença, acórdão, contrato ou outro documento que deseja analisar."
          className="text-sm"
        />

        <p className="text-xs text-muted-foreground">
          Esse conteúdo é tratado como documento adicional na análise. Arquivos anexados têm seu texto extraído automaticamente.
        </p>
      </CardContent>
    </Card>
  );
}

NijaComplementaryDoc.displayName = "NijaComplementaryDoc";
