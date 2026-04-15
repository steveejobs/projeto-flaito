import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Delegacia {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  tipo: string;
  endereco: string | null;
  telefone: string | null;
}

export const useDelegaciaLookup = () => {
    const [delegacias, setDelegacias] = useState<Delegacia[]>([]);
    const [loading, setLoading] = useState(false);

    const searchDelegacias = async (filters: { cidade?: string; estado?: string; tipo?: string }) => {
        setLoading(true);
        try {
            let query = supabase.from('delegacias').select('*');

            if (filters.cidade) {
                query = query.ilike('cidade', `%${filters.cidade}%`);
            }
            if (filters.estado) {
                query = query.eq('estado', filters.estado);
            }
            if (filters.tipo) {
                query = query.eq('tipo', filters.tipo);
            }

            const { data, error } = await query.limit(50);
            if (error) throw error;
            setDelegacias(data || []);
            return data;
        } catch (error: any) {
            toast({
                title: 'Erro ao buscar delegacias',
                description: error.message,
                variant: 'destructive',
            });
            return [];
        } finally {
            setLoading(false);
        }
    };

    const getSuggestedDelegacia = async (clientId: string) => {
        try {
            const { data: client, error } = await supabase
                .from('clients')
                .select('metadata')
                .eq('id', clientId)
                .single();

            if (error) throw error;

            const meta = client?.metadata as Record<string, unknown> | null;
            const suggestedId = meta?.suggested_delegacia_id as string | undefined;
            if (suggestedId) {
                const { data: delegacia } = await supabase
                    .from('delegacias')
                    .select('*')
                    .eq('id', suggestedId)
                    .single();
                return delegacia;
            }
            return null;
        } catch (error) {
            console.error('Error fetching suggested delegacia:', error);
            return null;
        }
    };

    return { delegacias, loading, searchDelegacias, getSuggestedDelegacia };
};
