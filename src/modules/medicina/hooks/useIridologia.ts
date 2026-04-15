import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export function useIridologia() {
  const { toast } = useToast();

  const createAvaliacao = async (avaliacao: any) => {
    try {
      const { data, error } = await supabase
        .from('iris_analyses')
        .insert([avaliacao])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const createLaudo = async (laudo: any) => {
    try {
      const { data, error } = await supabase
        .from('medical_reports')
        .insert([laudo])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const getPacienteAvaliacoes = async (pacienteId: string) => {
    try {
      const { data, error } = await supabase
        .from('iris_analyses')
        .select('*, medical_reports(*)')
        .eq('patient_id', pacienteId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error(error);
      return [];
    }
  };

  const saveImage = async (image: any) => {
    try {
      const { data, error } = await supabase
        .from('iris_images')
        .insert([image])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  return { createAvaliacao, createLaudo, getPacienteAvaliacoes, saveImage };
}
