import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export type IngestionStatus = "pending" | "extracting" | "converting" | "chunking" | "ready" | "error";

export interface KnowledgeFile {
  id: string;
  office_id: string;
  original_filename: string;
  file_type: string;
  file_size_bytes: number | null;
  storage_path: string;
  canonical_markdown: string | null;
  ingestion_status: IngestionStatus;
  ingestion_error: string | null;
  metadata: Record<string, unknown>;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBinding {
  id: string;
  agent_config_id: string;
  knowledge_file_id: string;
  created_at: string;
}

export function useKnowledgeFiles(officeId: string | null) {
  const { toast } = useToast();
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchFiles = useCallback(async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase.from("knowledge_files") as any)
        .select("*")
        .eq("office_id", officeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [officeId, toast]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    if (!officeId) return null;
    setUploading(true);

    try {
      const storagePath = `${officeId}/${Date.now()}_${file.name}`;

      // Upload to knowledge-files bucket
      const { error: uploadErr } = await supabase.storage
        .from("knowledge-files")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadErr) throw uploadErr;

      // Get session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      // Trigger ingestion pipeline
      const { data, error: invokeErr } = await supabase.functions.invoke("knowledge-ingest", {
        body: {
          file_name: file.name,
          storage_path: storagePath,
          office_id: officeId,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (invokeErr) throw invokeErr;

      toast({
        title: "Arquivo enviado",
        description: `${file.name} está sendo processado.`,
      });

      // Refresh file list
      await fetchFiles();

      return data?.knowledge_file_id || null;
    } catch (err: any) {
      toast({
        title: "Erro no upload",
        description: err.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  }, [officeId, toast, fetchFiles]);

  const deleteFile = useCallback(async (fileId: string) => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file) return;

      // Delete from storage
      await supabase.storage
        .from("knowledge-files")
        .remove([file.storage_path]);

      // Delete from DB (cascade will handle bindings)
      const { error } = await (supabase.from("knowledge_files") as any)
        .delete()
        .eq("id", fileId);

      if (error) throw error;

      toast({ title: "Arquivo removido" });
      await fetchFiles();
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  }, [files, toast, fetchFiles]);

  const getBindings = useCallback(async (agentConfigId: string): Promise<KnowledgeBinding[]> => {
    const { data, error } = await (supabase.from("agent_knowledge_bindings") as any)
      .select("*")
      .eq("agent_config_id", agentConfigId);

    if (error) return [];
    return data || [];
  }, []);

  const bindFile = useCallback(async (agentConfigId: string, knowledgeFileId: string) => {
    const { error } = await (supabase.from("agent_knowledge_bindings") as any)
      .insert({ agent_config_id: agentConfigId, knowledge_file_id: knowledgeFileId });

    if (error && !error.message.includes("duplicate")) {
      toast({ title: "Erro ao vincular", description: error.message, variant: "destructive" });
    }
  }, [toast]);

  const unbindFile = useCallback(async (agentConfigId: string, knowledgeFileId: string) => {
    const { error } = await (supabase.from("agent_knowledge_bindings") as any)
      .delete()
      .eq("agent_config_id", agentConfigId)
      .eq("knowledge_file_id", knowledgeFileId);

    if (error) {
      toast({ title: "Erro ao desvincular", description: error.message, variant: "destructive" });
    }
  }, [toast]);

  return {
    files,
    loading,
    uploading,
    fetchFiles,
    uploadFile,
    deleteFile,
    getBindings,
    bindFile,
    unbindFile,
  };
}
