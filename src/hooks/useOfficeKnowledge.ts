import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface KnowledgeItem {
    id: string;
    office_id: string;
    type: 'piece' | 'thesis';
    title: string;
    content: string;
    tags: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
    created_by?: string;
    metadata?: any;
}

export const useOfficeKnowledge = (officeId?: string) => {
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const fetchItems = async (filters: { type?: string; search?: string } = {}) => {
        if (!officeId) return;
        setLoading(true);
        try {
            let query = supabase
                .from('office_knowledge')
                .select('*')
                .eq('office_id', officeId)
                .order('updated_at', { ascending: false });

            if (filters.type) {
                query = query.eq('type', filters.type);
            }
            if (filters.search) {
                query = query.ilike('title', `%${filters.search}%`);
            }

            const { data, error } = await query;

            if (error) throw error;
            setItems(data || []);
        } catch (error: any) {
            console.error('Error fetching knowledge:', error);
            // Non-blocking toast if table doesn't exist yet
            if (error.code !== 'PGRST116') {
                toast({
                    title: 'Erro ao carregar base de conhecimento',
                    description: error.message,
                    variant: 'destructive',
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const saveItem = async (item: Partial<KnowledgeItem>) => {
        if (!officeId) return;
        try {
            const { data, error } = await supabase
                .from('office_knowledge')
                .upsert({ ...item, office_id: officeId })
                .select()
                .single();

            if (error) throw error;
            
            // Disparar indexação vetorial (Background)
            supabase.functions.invoke('nija-embed-chunks', {
                body: { knowledge_id: data.id, office_id: officeId }
            }).catch(e => console.error('Error triggering embedding:', e));

            toast({ title: 'Sucesso', description: 'Item salvo e indexado na base de conhecimento.' });
            fetchItems();
            return data;
        } catch (error: any) {
            toast({
                title: 'Erro ao salvar item',
                description: error.message,
                variant: 'destructive',
            });
            throw error;
        }
    };

    const deleteItem = async (id: string) => {
        try {
            const { error } = await supabase
                .from('office_knowledge')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast({ title: 'Removido', description: 'Item excluído com sucesso.' });
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (error: any) {
            toast({
                title: 'Erro ao excluir item',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    useEffect(() => {
        if (officeId) {
            fetchItems();
        }
    }, [officeId]);

    return { items, loading, fetchItems, saveItem, deleteItem };
};
