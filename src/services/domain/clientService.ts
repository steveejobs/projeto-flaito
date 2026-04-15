import { supabase } from "@/integrations/supabase/client";

export interface ClientProfile {
  id: string;
  full_name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  office_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Service to handle unified client data and identity
 */
export const clientService = {
  /**
   * Fetch a single client by ID
   */
  async getById(id: string): Promise<ClientProfile | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[clientService] Error fetching client:', error);
      return null;
    }

    return data;
  },

  /**
   * Fetch clinical extension for a client
   */
  async getClinicalData(clientId: string) {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('client_id', clientId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
      console.error('[clientService] Error fetching clinical data:', error);
    }

    return data;
  },

  /**
   * List all medical patients for the current office (unified with identity)
   */
  async listMedicalPatients(officeId: string) {
    const { data, error } = await supabase
      .from('v_pacientes_unified')
      .select('*')
      .eq('office_id', officeId)
      .order('nome');

    if (error) {
      console.error('[clientService] Error listing medical patients:', error);
      
      // Fallback for safety during migration
      const { data: fallbackData } = await supabase
        .from('pacientes')
        .select('id, nome')
        .eq('office_id', officeId)
        .order('nome');
      return fallbackData || [];
    }

    return data || [];
  },

  /**
   * List all clients for the current office
   */
  async listByOffice(officeId: string): Promise<ClientProfile[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('office_id', officeId)
      .order('full_name');

    if (error) {
      console.error('[clientService] Error listing clients:', error);
      return [];
    }

    return data || [];
  }
};
