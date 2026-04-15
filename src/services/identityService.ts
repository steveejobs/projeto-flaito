import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";

export interface UnifiedProfile {
  id: string;
  office_id: string | null;
  full_name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  cep: string | null;
  city: string | null;
  state: string | null;
}

export const identityService = {
  async getFullProfile(clientId: string): Promise<UnifiedProfile | null> {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error("Error fetching client profile:", clientError);
      return null;
    }

    return {
      id: client.id,
      office_id: client.office_id,
      full_name: client.full_name,
      cpf: client.cpf,
      email: client.email,
      phone: client.phone,
      address_line: client.address_line,
      cep: client.cep,
      city: client.city,
      state: client.state,
    };
  },

  async getProfileByPatientId(_pacienteId: string): Promise<UnifiedProfile | null> {
    console.warn("getProfileByPatientId is deprecated: pacientes table no longer exists in schema");
    return null;
  },

  async updateProfile(clientId: string, data: Partial<UnifiedProfile>): Promise<boolean> {
    const updatePayload: TablesUpdate<'clients'> = {
      updated_at: new Date().toISOString(),
    };

    if (data.full_name !== undefined) updatePayload.full_name = data.full_name;
    if (data.cpf !== undefined) updatePayload.cpf = data.cpf;
    if (data.email !== undefined) updatePayload.email = data.email;
    if (data.phone !== undefined) updatePayload.phone = data.phone;
    if (data.address_line !== undefined) updatePayload.address_line = data.address_line;
    if (data.cep !== undefined) updatePayload.cep = data.cep;
    if (data.city !== undefined) updatePayload.city = data.city;
    if (data.state !== undefined) updatePayload.state = data.state;

    const { error: clientUpdateError } = await supabase
      .from('clients')
      .update(updatePayload)
      .eq('id', clientId);

    if (clientUpdateError) {
      console.error("Error updating client profile:", clientUpdateError);
      return false;
    }

    return true;
  }
};
