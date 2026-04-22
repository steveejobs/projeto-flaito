import { supabase } from "@/integrations/supabase/client";
import type { ClientStudyContext } from "@/types/clientStudyContext";

export const clientStudyContextService = {
  async getByClientId(clientId: string): Promise<ClientStudyContext | null> {
    const { data, error } = await (supabase as any)
      .from("client_study_context")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      console.error("[clientStudyContextService] get error:", error);
      return null;
    }
    return data as ClientStudyContext | null;
  },

  async upsert(
    clientId: string,
    officeId: string,
    fields: Partial<ClientStudyContext>
  ): Promise<ClientStudyContext | null> {
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      client_id: clientId,
      office_id: officeId,
      ...fields,
      updated_by: user?.id ?? null,
    };

    // Check if exists
    const existing = await this.getByClientId(clientId);

    if (existing) {
      const { data, error } = await (supabase as any)
        .from("client_study_context")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("[clientStudyContextService] update error:", error);
        return null;
      }
      return data as ClientStudyContext;
    }

    // Insert
    const { data, error } = await (supabase as any)
      .from("client_study_context")
      .insert({ ...payload, created_by: user?.id ?? null })
      .select()
      .single();

    if (error) {
      console.error("[clientStudyContextService] insert error:", error);
      return null;
    }
    return data as ClientStudyContext;
  },
};
