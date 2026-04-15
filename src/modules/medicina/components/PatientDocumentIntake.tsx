import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, Camera, FileText, Loader2, X } from "lucide-react";
import { usePatientExtraction, type PatientExtractionResult } from "@/hooks/usePatientExtraction";

interface PatientDocumentIntakeProps {
  onExtractionComplete: (result: { documentId: string; extraction: PatientExtractionResult }) => void;
  onCancel: () => void;
}

export const PatientDocumentIntake: React.FC<PatientDocumentIntakeProps> = ({ 
  onExtractionComplete, 
  onCancel 
}) => {
  const { uploadAndExtract, isProcessing, progress } = usePatientExtraction();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    const result = await uploadAndExtract(file);
    if (result) {
      onExtractionComplete(result);
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="relative">
          <Loader2 className="h-16 w-16 text-teal-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-teal-700">{progress}%</span>
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-slate-800">Processando Documento</h3>
          <p className="text-sm text-slate-500 max-w-xs">
            Nossa inteligência artificial está extraindo dados e verificando a integridade do documento...
          </p>
        </div>
        <Progress value={progress} className="w-full max-w-md h-2 bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2">
      <div 
        className={`relative border-2 border-dashed rounded-2xl p-10 transition-all duration-300 flex flex-col items-center justify-center text-center space-y-4
          ${dragActive ? 'border-teal-500 bg-teal-50/50 scale-[1.02]' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'}`}
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
      >
        <div className="p-4 bg-white rounded-full shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
          <Upload className="h-8 w-8 text-teal-600" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-800">Arraste seu documento aqui</h3>
          <p className="text-sm text-slate-500">
            Suportamos PDF, JPG e PNG (RG, CNH ou CPF)
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button 
            className="rounded-xl px-6 h-11 bg-teal-600 hover:bg-teal-700 gap-2 font-bold shadow-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileText className="h-4 w-4" />
            Selecionar Arquivo
          </Button>
          <Button 
            variant="outline"
            className="rounded-xl px-6 h-11 gap-2 font-bold border-slate-200"
            onClick={() => {/* Implementação de câmera no futuro */}}
          >
            <Camera className="h-4 w-4" />
            Usar Câmera
          </Button>
        </div>
        
        <input 
          ref={fileInputRef}
          type="file" 
          className="hidden" 
          accept="image/*,application/pdf"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureItem 
          icon={<Loader2 className="h-4 w-4 text-emerald-500" />}
          title="Extração Imediata"
          desc="Dados lidos em segundos via Vision AI"
        />
        <FeatureItem 
          icon={<Loader2 className="h-4 w-4 text-blue-500" />}
          title="Verificação de Hash"
          desc="Garantia de integridade do arquivo"
        />
        <FeatureItem 
          icon={<Loader2 className="h-4 w-4 text-purple-500" />}
          title="Auditável"
          desc="Trilha completa de origem dos dados"
        />
      </div>
    </div>
  );
};

const FeatureItem = ({ icon, title, desc }: { icon: React.ReactNode; title: string, desc: string }) => (
  <Card className="p-4 border-none bg-slate-50/50 shadow-none space-y-2">
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">{title}</span>
    </div>
    <p className="text-[11px] text-slate-500 leading-tight">{desc}</p>
  </Card>
);
