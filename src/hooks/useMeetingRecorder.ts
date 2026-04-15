import { useState, useCallback, useEffect } from "react";
import { useSessionRecorder } from "./useSessionRecorder";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeRole } from "./useOfficeRole";

interface UseMeetingRecorderOptions {
  onUploadSuccess?: (chunkId: string) => void;
  onUploadError?: (error: any) => void;
}

export const useMeetingRecorder = (options?: UseMeetingRecorderOptions) => {
  const { user } = useAuth();
  const { officeId } = useOfficeRole();
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Instanciar o gravador base
  const {
    isRecording,
    syncStatus,
    error,
    startRecording: baseStart,
    stopRecording: baseStop
  } = useSessionRecorder(sessionId, officeId);

  // Efeito para tratar erros do gravador base
  useEffect(() => {
    if (error && options?.onUploadError) {
      options.onUploadError(new Error(error));
    }
  }, [error, options]);

  const startRecording = async () => {
    if (!officeId) {
      options?.onUploadError?.(new Error("Escritório não identificado"));
      return;
    }
    
    // Gerar um novo ID de sessão para a reunião jurídica se não houver um
    const newId = crypto.randomUUID();
    setSessionId(newId);
    
    // Pequeno delay para garantir que o estado do sessionId foi propagado
    // Em um cenário real, poderíamos passar o ID diretamente para o baseStart se ele suportasse
    setTimeout(async () => {
      await baseStart();
    }, 0);
  };

  const stopRecording = async () => {
    await baseStop();
    setSessionId(null);
  };

  return {
    isRecording,
    isSyncing: syncStatus.pending > 0,
    pendingChunks: syncStatus.pending,
    startRecording,
    stopRecording,
    error
  };
};
