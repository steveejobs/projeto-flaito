import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export function useProtocolos() {
  const { toast } = useToast();

  const addProtocolo = async (protocolo: any) => {
    try {
      const { data, error } = await supabase
        .from('protocolos_terapeuticos')
        .insert([protocolo])
        .select()
        .single();
      
      if (error) throw error;
      toast({ title: "Sucesso", description: "Protocolo terapêutico registrado." });
      return data;
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const addReceitaDieta = async (receita: any) => {
    try {
      const { data, error } = await supabase
        .from('receitas_dietas')
        .insert([receita])
        .select()
        .single();
      
      if (error) throw error;
      toast({ title: "Sucesso", description: "Receita/Dieta registrada." });
      return data;
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const getPacienteData = async (pacienteId: string) => {
    try {
      const { data: protocolos } = await supabase
        .from('protocolos_terapeuticos')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });

      const { data: receitas } = await supabase
        .from('receitas_dietas')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });

      return { protocolos: protocolos || [], receitas: receitas || [] };
    } catch (error) {
      console.error(error);
      return { protocolos: [], receitas: [] };
    }
  };

  return { addProtocolo, addReceitaDieta, getPacienteData };
}
