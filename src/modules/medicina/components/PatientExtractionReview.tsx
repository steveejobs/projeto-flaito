import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Check, 
  AlertCircle, 
  ShieldCheck, 
  ChevronRight, 
  AlertTriangle,
  History,
  UserPlus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PatientExtractionReviewProps {
  extraction: any; // Result from hook
  extractionId: string;
  documentId: string;
  onConfirm: (confirmedData: any) => void;
  onBack: () => void;
}

export const PatientExtractionReview: React.FC<PatientExtractionReviewProps> = ({ 
  extraction, 
  extractionId,
  documentId,
  onConfirm, 
  onBack 
}) => {
  const { toast } = useToast();
  const [isCommiting, setIsCommiting] = useState(false);
  const [editedData, setEditedData] = useState(() => {
    const f = extraction.fields;
    return {
      full_name: f.name || "",
      cpf: f.cpf || "",
      birth_date: f.birth_date || "",
      rg: f.rg || "",
      nome_mae: f.mother_name || "",
      nome_pai: f.father_name || "",
      nacionalidade: f.nationality || "Brasileira",
      naturalidade: f.city_of_birth || "",
      endereco_logradouro: f.address_street || "",
      endereco_numero: f.address_number || "",
      endereco_bairro: f.address_neighborhood || "",
      endereco_cidade: f.address_city || "",
      endereco_uf: f.address_uf || "",
      endereco_cep: f.address_zip || "",
    };
  });

  const [duplicates, setDuplicates] = useState<any[]>([]);

  useEffect(() => {
    // Buscar sugestões de deduplicação se houver CPF
    if (editedData.cpf) {
        supabase
          .from("patient_deduplication_suggestions")
          .select("*, target:pacientes(id, full_name, cpf)")
          .eq("status", "PENDING")
          .then(({ data }) => {
              if (data) setDuplicates(data);
          });
    }
  }, [editedData.cpf]);

  const getConfidenceColor = (field: string) => {
    const conf = extraction.confidence?.[field] || 0.5;
    if (conf >= 0.9) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (conf >= 0.7) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-rose-100 text-rose-700 border-rose-200";
  };

  const handleFieldChange = (field: string, value: string) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const handleFinalConfirm = async () => {
    setIsCommiting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      // Chamada para o COMMIT_INTAKE (Stage 6 Hardening)
      // Nota: Se patient_id for null, o processador criará um novo ou usará o confirmado
      const { data: res, error } = await supabase.functions.invoke("patient-intake-processor", {
        body: {
          action: "COMMIT_INTAKE",
          extraction_id: extractionId,
          confirmed_data: editedData,
          user_id: session?.session?.user?.id,
          // Se soubermos o patient_id, passamos aqui
        }
      });

      if (error) throw error;

      toast({
        title: "Intake Finalizado",
        description: "Dados confirmados e registrados com auditoria.",
      });

      onConfirm(editedData);
    } catch (err: any) {
      toast({
        title: "Erro na confirmação",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsCommiting(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh] animate-in slide-in-from-right duration-500 font-inter">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-50 rounded-xl shadow-inner">
            <ShieldCheck className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Curadoria de Dados (Intake)</h3>
                <Badge variant="outline" className="text-[10px] font-bold text-teal-600 border-teal-200 bg-teal-50">
                    V{extraction.version}
                </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
              Reforço de Integridade Stage 6 • {extraction.document_type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500 text-xs font-bold hover:bg-slate-100 rounded-xl px-4">
               Voltar
           </Button>
           <Button 
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-11 px-8 font-black shadow-[0_4px_14px_rgba(13,148,136,0.3)] transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            onClick={handleFinalConfirm}
            disabled={isCommiting}
           >
             {isCommiting ? "Salvando..." : "Confirmar & Auditar"}
             <ChevronRight className="ml-2 h-4 w-4" />
           </Button>
        </div>
      </div>

      {/* Warnings & Suggestions */}
      {duplicates.length > 0 && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 animate-pulse">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
                <p className="text-sm font-bold text-amber-800">Possível Duplicidade Detectada</p>
                <p className="text-xs text-amber-700 mt-0.5">
                    Foram encontrados {duplicates.length} pacientes com dados similares (CPF/Nome). 
                    O sistema bloqueia unificação automática para segurança.
                </p>
            </div>
            <Button variant="outline" size="sm" className="bg-white border-amber-200 text-amber-700 text-[10px] font-bold h-7 rounded-lg">
                Ver Conflitos
            </Button>
        </div>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 pt-6 overflow-hidden flex-1">
        <ScrollArea className="pr-4 h-full">
          <div className="space-y-10 pb-12">
            
            {/* Seção 1: Identificação */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <History className="h-4 w-4 text-blue-600" />
                </div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex-1">Identificação Civil</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <ReviewField 
                  label="Nome Completo" 
                  value={editedData.full_name} 
                  confidence={extraction.confidence?.name || 0}
                  onChange={(v) => handleFieldChange("full_name", v)}
                  colorFn={getConfidenceColor}
                />
                <ReviewField 
                  label="CPF" 
                  value={editedData.cpf} 
                  confidence={extraction.confidence?.cpf || 0}
                  onChange={(v) => handleFieldChange("cpf", v)}
                  isDocument
                  colorFn={getConfidenceColor}
                />
                <ReviewField 
                  label="Data de Nascimento" 
                  value={editedData.birth_date} 
                  type="date"
                  confidence={extraction.confidence?.birth_date || 0}
                  onChange={(v) => handleFieldChange("birth_date", v)}
                  colorFn={getConfidenceColor}
                />
                <ReviewField 
                  label="RG" 
                  value={editedData.rg} 
                  confidence={extraction.confidence?.rg || 0}
                  onChange={(v) => handleFieldChange("rg", v)}
                  colorFn={getConfidenceColor}
                />
              </div>
            </section>

            <Separator className="opacity-50" />

            {/* Seção 2: Geolocalização */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <UserPlus className="h-4 w-4 text-emerald-600" />
                </div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex-1">Endereço & Localização</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                    <ReviewField 
                      label="Logradouro" 
                      value={editedData.endereco_logradouro} 
                      confidence={extraction.confidence?.address_street || 0}
                      onChange={(v) => handleFieldChange("endereco_logradouro", v)}
                      colorFn={getConfidenceColor}
                    />
                </div>
                <ReviewField 
                  label="Número" 
                  value={editedData.endereco_numero} 
                  confidence={extraction.confidence?.address_number || 0}
                  onChange={(v) => handleFieldChange("endereco_numero", v)}
                  colorFn={getConfidenceColor}
                />
                <ReviewField 
                  label="Bairro" 
                  value={editedData.endereco_bairro} 
                  confidence={extraction.confidence?.address_neighborhood || 0}
                  onChange={(v) => handleFieldChange("endereco_bairro", v)}
                  colorFn={getConfidenceColor}
                />
                <ReviewField 
                  label="Cidade" 
                  value={editedData.endereco_cidade} 
                  confidence={extraction.confidence?.address_city || 0}
                  onChange={(v) => handleFieldChange("endereco_cidade", v)}
                  colorFn={getConfidenceColor}
                />
                <ReviewField 
                  label="UF" 
                  value={editedData.endereco_uf} 
                  confidence={extraction.confidence?.address_uf || 0}
                  onChange={(v) => handleFieldChange("endereco_uf", v)}
                  colorFn={getConfidenceColor}
                />
              </div>
            </section>

          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

interface ReviewFieldProps {
  label: string;
  value: string;
  confidence: number;
  type?: string;
  isDocument?: boolean;
  onChange: (v: string) => void;
  colorFn: (field: string) => string;
}

const ReviewField = ({ label, value, confidence, type = "text", isDocument, onChange, colorFn }: ReviewFieldProps) => (
  <div className="space-y-2 group">
    <div className="flex items-center justify-between">
      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</Label>
      <div className="flex items-center gap-2">
          {confidence < 0.7 && (
              <Badge variant="destructive" className="text-[8px] h-4 py-0 font-bold uppercase">Atenção</Badge>
          )}
          <Badge variant="outline" className={`text-[9px] px-2 h-5 font-bold border-opacity-30 ${colorFn(label.toLowerCase())} transition-colors`}>
            {Math.round(confidence * 100)}%
          </Badge>
      </div>
    </div>
    <div className="relative">
      <Input 
        type={type}
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-xl h-12 bg-white border-slate-200 font-bold text-slate-700 transition-all focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 pl-4 pr-12
            ${confidence < 0.6 ? 'border-amber-200 bg-amber-50/20' : ''}`}
      />
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {confidence > 0.85 ? (
          <div className="p-1 bg-emerald-100 rounded-full"><Check className="h-3 w-3 text-emerald-600" /></div>
        ) : (
          <div className="p-1 bg-amber-100 rounded-full"><AlertCircle className="h-3.5 w-3.5 text-amber-600" /></div>
        )}
      </div>
    </div>
  </div>
);
