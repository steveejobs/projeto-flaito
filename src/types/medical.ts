export interface PacienteUnified {
  id: string;
  office_id: string | null;
  nome: string | null;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  status: string | null;
  risk_level: string | null;
  last_appointment: string | null;
  next_appointment: string | null;
  total_appointments: number | null;
  created_at: string | null;
  updated_at: string | null;
}
