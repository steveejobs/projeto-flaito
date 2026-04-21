import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";

export interface MedicalData {
  alergias?: string | null;
  medicamentos_em_uso?: string | null;
  historico_medico?: string | null;
  status?: string | null;
}

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
  data_nascimento?: string | null;
  medical_data?: MedicalData | null;
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

    // Attempt to fetch medical extension data
    let medicalData: MedicalData | null = null;
    let dataNascimento: string | null = null;
    const { data: paciente } = await (supabase
      .from('pacientes' as any)
      .select('alergias, medicamentos_em_uso, historico_medico, birth_date, status')
      .eq('client_id', clientId)
      .maybeSingle() as any);

    if (paciente) {
      medicalData = {
        alergias: paciente.alergias,
        medicamentos_em_uso: paciente.medicamentos_em_uso,
        historico_medico: paciente.historico_medico,
        status: paciente.status,
      };
      dataNascimento = paciente.birth_date;
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
      data_nascimento: dataNascimento,
      medical_data: medicalData,
    };
  },

  async getProfileByPatientId(pacienteId: string): Promise<UnifiedProfile | null> {
    // Look up the pacientes table to find the linked client_id
    const { data: paciente, error } = await (supabase
      .from('pacientes' as any)
      .select('client_id')
      .eq('id', pacienteId)
      .maybeSingle() as any);

    if (error || !paciente?.client_id) {
      // Fallback: try treating the ID as a client_id directly
      return this.getFullProfile(pacienteId);
    }

    return this.getFullProfile(paciente.client_id);
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
