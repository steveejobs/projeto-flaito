import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface EscavadorSearchRequest {
  id: string;
  numero_processo: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'DUPLICATE';
  created_at: string;
  tipo_busca: string;
}

export function useEscavador() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoke = useCallback(async (action: string, payload: any) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke("escavador-api", {
        body: { action, payload }
      });

      if (functionError) throw functionError;
      return data;
    } catch (err: any) {
      const msg = err.message || "Ocorreu um erro ao comunicar com a API do Escavador.";
      setError(msg);
      toast({
        title: "Erro na Integração Escavador",
        description: msg,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchProcesso = useCallback((numero: string) => 
    invoke("search_processo", { numero }), [invoke]);

  const getSaldo = useCallback(() => 
    invoke("get_saldo", {}), [invoke]);

  const listMonitoramentos = useCallback(() => 
    invoke("list_monitoramentos", {}), [invoke]);

  const createMonitoramento = useCallback((numero: string, frequencia: string) => 
    invoke("create_monitoramento", { numero, frequencia }), [invoke]);

  const removeMonitoramento = useCallback((id: string, external_id: string) => 
    invoke("delete_monitoramento", { id, external_id }), [invoke]);

  const searchByClient = useCallback((clientId: string) => 
    invoke("search_by_context", { client_id: clientId }), [invoke]);

  const linkToClient = useCallback((payload: { 
    client_id: string; 
    numero_processo: string; 
    external_id?: string; 
    search_request_id?: string;
    match_input_type: 'CPF_CNPJ' | 'CNJ' | 'NOME' | 'OAB'
  }) => invoke("link_process_to_client", payload), [invoke]);

  const getSummary = useCallback((numero: string) => 
    invoke("get_process_summary", { numero_processo: numero }), [invoke]);

  const rejectSuggestion = useCallback((link_id: string, is_permanent: boolean = false) => 
    invoke("reject_suggestion", { link_id, is_permanent }), [invoke]);

  const getMetrics = useCallback(() => 
    invoke("get_performance_metrics", {}), [invoke]);

  const autoProvisionCase = useCallback((link_id: string, acting_side?: 'AUTOR' | 'REU') => 
    invoke("auto_provision_case", { link_id, acting_side }), [invoke]);

  const triggerNija = useCallback(async (caseId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("nija-pipeline-orchestrator", {
        body: { case_id: caseId, options: { notify_lawyer: true } }
      });
      if (error) throw error;
      toast({
        title: "Pipeline NIJA Iniciado",
        description: "A auditoria forense está sendo processada em segundo plano.",
      });
      return data;
    } catch (err: any) {
      toast({
        title: "Erro no NIJA",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    searchProcesso,
    getSaldo,
    listMonitoramentos,
    createMonitoramento,
    removeMonitoramento,
    searchByClient,
    linkToClient,
    getSummary,
    rejectSuggestion,
    getMetrics,
    triggerNija
  };
};
