import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TimelineEvent = Database['public']['Views']['unified_client_events']['Row'];

/**
 * Hook to consume the unified client timeline
 */
export function useTimeline(clientId?: string) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!clientId) {
      setEvents([]);
      return;
    }

    async function fetchTimeline() {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: supabaseError } = await supabase
          .from('unified_client_events')
          .select('*')
          .eq('client_id', clientId)
          .order('event_date', { ascending: false });

        if (supabaseError) throw supabaseError;
        setEvents(data || []);
      } catch (err: any) {
        console.error('[useTimeline] Error:', err);
        setError(err instanceof Error ? err : new Error('Unknown error fetching timeline'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchTimeline();
  }, [clientId]);

  return { events, isLoading, error };
}
