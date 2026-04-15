import { supabase } from "@/integrations/supabase/client";

export interface Delegacia {
  id: string;
  nome: string;
  tipo: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
}

export function useDelegaciaLookup() {
  const findByLocation = async (cidade: string, estado: string) => {
    try {
      const { data, error } = await supabase
        .from('delegacias')
        .select('*')
        .eq('cidade', cidade)
        .eq('estado', estado);

      if (error) throw error;
      return data as Delegacia[];
    } catch (error) {
      console.error("Erro ao buscar delegacia:", error);
      return [];
    }
  };

  return { findByLocation };
}
