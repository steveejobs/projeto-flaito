import { supabase } from "@/integrations/supabase/client";

export type TimelineEventModule = 'medical' | 'legal' | 'comm' | 'system';
export type TimelineEventType = 'consulta' | 'processo' | 'whatsapp' | 'analise_iris' | 'laudo' | 'evento_sistema';

export interface UnifiedEvent {
    id: string;
    office_id: string;
    client_id: string;
    event_date: string;
    module: TimelineEventModule;
    event_type: TimelineEventType;
    title: string;
    status: string;
    metadata: any;
}

export const timelineService = {
    /**
     * Busca todos os eventos unificados de um cliente específico.
     */
    async getClientTimeline(clientId: string): Promise<UnifiedEvent[]> {
        if (!clientId) return [];

        const { data, error } = await supabase
            .from('unified_client_events')
            .select('*')
            .eq('client_id', clientId)
            .order('event_date', { ascending: false });

        if (error) {
            console.error('Erro ao buscar timeline unificada:', error);
            throw error;
        }

        return (data as unknown as UnifiedEvent[]) || [];
    },

    /**
     * Busca eventos filtrados por módulo.
     */
    async getFilteredTimeline(clientId: string, modules: TimelineEventModule[]): Promise<UnifiedEvent[]> {
        if (!clientId) return [];

        const { data, error } = await supabase
            .from('unified_client_events')
            .select('*')
            .eq('client_id', clientId)
            .in('module', modules)
            .order('event_date', { ascending: false });

        if (error) {
            console.error('Erro ao buscar timeline filtrada:', error);
            throw error;
        }

        return (data as unknown as UnifiedEvent[]) || [];
    }
};
