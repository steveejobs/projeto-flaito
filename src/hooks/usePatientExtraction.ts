import { useState, useCallback } from "react";
import { supabase } from "../integrations/supabase/client";
import { useToast } from "./use-toast";
import { convertPdfFirstPageToImage } from "../nija/connectors/pdf/pdfToImage";
import { resolveDocumentContext } from "@/utils/documentContextResolver";

export interface PatientExtractionResult {
  document_type: string;
  fields: {
    name: { value: string | null; confidence: number };
    cpf: { value: string | null; confidence: number };
    rg?: { value: string | null; confidence: number };
    birth_date?: { value: string | null; confidence: number };
    mother_name?: { value: string | null; confidence: number };
    father_name?: { value: string | null; confidence: number };
    nationality?: { value: string | null; confidence: number };
    city_of_birth?: { value: string | null; confidence: number };
    address_street?: { value: string | null; confidence: number };
    address_number?: { value: string | null; confidence: number };
    address_neighborhood?: { value: string | null; confidence: number };
    address_city?: { value: string | null; confidence: number };
    address_uf?: { value: string | null; confidence: number };
    address_zip?: { value: string | null; confidence: number };
    issue_date?: { value: string | null; confidence: number };
    issuer?: { value: string | null; confidence: number };
    issue_uf?: { value: string | null; confidence: number };
  };
  raw_text?: string;
}

export function usePatientExtraction() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const computeFileHash = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const uploadAndExtract = useCallback(async (file: File) => {
    setIsProcessing(true);
    setProgress(10);
    
    try {
      // 1. Contexto do Escritório
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const { data: officeMember } = await supabase
        .from("office_members")
        .select("office_id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!officeMember?.office_id) throw new Error("Escritório não encontrado");
      const officeId = officeMember.office_id;

      // 2. Integridade e Hash
      const fileHash = await computeFileHash(file);
      setProgress(20);

      // 3. Upload para Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `intake/${officeId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("patient-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;
      setProgress(40);

      // 3.1 Resolve Institutional Context (Snapshot)
      const institutionalContext = await resolveDocumentContext({
        officeId,
        userId,
        isMedical: true
      });

      // 4. Criar Registro do Documento
      const { data: docRecord, error: docError } = await (supabase
        .from("patient_documents") as any)
        .insert({
          office_id: officeId,
          storage_path: filePath,
          file_name: file.name,
          mime_type: file.type,
          file_hash_sha256: fileHash,
          uploaded_by: userId,
          status: 'processing',
          institutional_snapshot: institutionalContext as any
        })
        .select()
        .single();

      if (docError) throw docError;
      setProgress(50);

      // 5. Preparar Imagem para OCR
      let imageBase64 = "";
      if (file.type === "application/pdf") {
        const conv = await convertPdfFirstPageToImage(file, 2.0);
        if (!conv.success || !conv.imageBase64) throw new Error(conv.error || "Erro ao converter PDF");
        imageBase64 = conv.imageBase64;
      } else {
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      setProgress(70);

      // 6. Chamada Inteligente Orquestrada (Hardened Intake Stage 6)
      const { data: extractionData, error: extractionError } = await supabase.functions.invoke("patient-intake-processor", {
        body: { 
          action: "PROCESS_DOCUMENT",
          document_id: docRecord.id,
          office_id: officeId
        }
      });

      if (extractionError) throw extractionError;
      if (!extractionData?.success) throw new Error(extractionData?.error || "Falha na extração");

      const result = extractionData.normalized as any;
      const extractionId = extractionData.extraction_id;
      const version = extractionData.version;
      
      setProgress(100);
      toast({
        title: `Extração V${version} concluída`,
        description: "Dados extraídos e normalizados com sucesso.",
      });

      return {
        documentId: docRecord.id,
        extractionId,
        extraction: {
          document_type: extractionData.document_type || 'Documento',
          fields: extractionData.normalized, // Agora vem normalizado do backend
          confidence: extractionData.confidence_json,
          version,
        }
      };

    } catch (err: any) {
      console.error("[usePatientExtraction] Erro:", err);
      toast({
        title: "Erro no processamento",
        description: err.message || "Não foi possível extrair os dados do documento.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  return {
    uploadAndExtract,
    isProcessing,
    progress
  };
}
