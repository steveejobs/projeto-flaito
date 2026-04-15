import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface BancoJuridicoItem {
  id: string;
  office_id: string;
  tipo: 'PETICAO' | 'TESE' | 'DOUTRINA' | 'SUMULA';
  titulo: string;
  descricao?: string;
  area_direito?: string;
  texto_completo?: string;
  tags: string[];
  autor?: string;
}

export function useLegalBanco() {
  const { toast } = useToast();

  const searchBanco = async (query: string, tipo?: string) => {
    try {
      let q = supabase
        .from('banco_juridico')
        .select('*');

      if (query) {
        q = q.or(`titulo.ilike.%${query}%,descricao.ilike.%${query}%,area_direito.ilike.%${query}%`);
      }

      if (tipo) {
        q = q.eq('tipo', tipo);
      }

      const { data, error } = await q.order('created_at', { ascending: false });

      if (error) throw error;
      return data as BancoJuridicoItem[];
    } catch (error: any) {
      toast({
        title: "Erro ao buscar no banco",
        description: error.message,
        variant: "destructive",
      });
      return [];
    }
  };

  const addItem = async (item: Omit<BancoJuridicoItem, 'id' | 'office_id'>, officeId: string) => {
    try {
      const { data, error } = await supabase
        .from('banco_juridico')
        .insert([{ ...item, office_id: officeId }])
        .select()
        .single();

      if (error) throw error;
      toast({ title: "Sucesso", description: "Item adicionado ao banco jurídico." });
      return data;
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar item",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return { searchBanco, addItem };
}
