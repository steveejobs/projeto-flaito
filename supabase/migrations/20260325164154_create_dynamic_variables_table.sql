-- Migration: create_dynamic_variables_table

CREATE TYPE public.variable_context AS ENUM ('GLOBAL', 'LEGAL', 'MEDICAL', 'AGENDA');
CREATE TYPE public.variable_source AS ENUM ('TABLE_FIELD', 'COMPUTED', 'STATIC', 'CUSTOM');

CREATE TABLE IF NOT EXISTS public.dynamic_variables (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    label text NOT NULL,
    context_type public.variable_context NOT NULL DEFAULT 'GLOBAL',
    source_type public.variable_source NOT NULL DEFAULT 'TABLE_FIELD',
    source_table text,
    source_field text,
    is_required boolean DEFAULT false,
    is_active boolean DEFAULT true,
    description text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for quick lookups by name
CREATE INDEX IF NOT EXISTS idx_dynamic_variables_name ON public.dynamic_variables(name);
CREATE INDEX IF NOT EXISTS idx_dynamic_variables_context ON public.dynamic_variables(context_type);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_dynamic_variables_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dynamic_variables_modtime
BEFORE UPDATE ON public.dynamic_variables
FOR EACH ROW EXECUTE FUNCTION update_dynamic_variables_updated_at();

-- RLS
ALTER TABLE public.dynamic_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dynamic Variables are viewable by everyone." 
ON public.dynamic_variables FOR SELECT USING (true);
CREATE POLICY "Dynamic Variables are insertable by everyone." 
ON public.dynamic_variables FOR INSERT WITH CHECK (true);
CREATE POLICY "Dynamic Variables are updatable by everyone." 
ON public.dynamic_variables FOR UPDATE USING (true);

-- Insert Basic Variables (Consolidated & Standardized)
INSERT INTO public.dynamic_variables (name, label, context_type, source_type, source_table, source_field, description) VALUES
-- Global
('client.name', 'Nome do Cliente/Paciente', 'GLOBAL', 'TABLE_FIELD', 'clients', 'full_name', 'Nome completo do cliente ou paciente'),
('client.phone', 'Telefone do Cliente/Paciente', 'GLOBAL', 'TABLE_FIELD', 'clients', 'phone', 'Telefone de contato do cliente ou paciente'),
('client.email', 'E-mail do Cliente/Paciente', 'GLOBAL', 'TABLE_FIELD', 'clients', 'email', 'E-mail de contato'),
('office.name', 'Nome do Escritório/Clínica', 'GLOBAL', 'TABLE_FIELD', 'offices', 'nome', 'Nome do estabelecimento'),

-- Agenda
('appointment.date', 'Data do Agendamento', 'AGENDA', 'TABLE_FIELD', 'agenda_medica', 'data_hora', 'Data do agendamento formatada (DD/MM/AAAA)'),
('appointment.time', 'Horário do Agendamento', 'AGENDA', 'TABLE_FIELD', 'agenda_medica', 'data_hora', 'Horário do agendamento formatado (HH:MM)'),

-- Medical
('professional.name', 'Nome do Profissional', 'MEDICAL', 'TABLE_FIELD', 'profissionais', 'nome', 'Nome do médico ou profissional de saúde atendente'),
('protocol.link', 'Link do Protocolo', 'MEDICAL', 'COMPUTED', null, null, 'Link dinâmico gerado para protocolos de atendimento'),
('report.type', 'Tipo de Laudo', 'MEDICAL', 'TABLE_FIELD', 'medical_reports', 'tipo', 'Tipo de laudo emitido'),

-- Legal
('case.number', 'Número do Processo', 'LEGAL', 'TABLE_FIELD', 'cases', 'number', 'Número do processo judicial'),
('case.court', 'Nome da Vara/Tribunal', 'LEGAL', 'TABLE_FIELD', 'cases', 'court', 'Vara ou tribunal responsável pelo processo'),
('case.opponent', 'Parte Contrária', 'LEGAL', 'TABLE_FIELD', 'cases', 'opponent_name', 'Nome da parte contrária no processo'),
('deadline.date', 'Data Final do Prazo', 'LEGAL', 'TABLE_FIELD', 'tasks', 'due_date', 'Data final para cumprimento do prazo processual'),
('legal.action_type', 'Tipo da Ação', 'LEGAL', 'TABLE_FIELD', 'cases', 'action_type', 'Tipo ou natureza da ação judicial'),

-- Legacy Support (Aliases)
('client_name', '[LEGACY] Nome do Cliente', 'GLOBAL', 'TABLE_FIELD', 'clients', 'full_name', 'Alias para client.name'),
('client_phone', '[LEGACY] Telefone do Cliente', 'GLOBAL', 'TABLE_FIELD', 'clients', 'phone', 'Alias para client.phone'),
('case_number', '[LEGACY] Número do Processo', 'LEGAL', 'TABLE_FIELD', 'cases', 'number', 'Alias para case.number')
ON CONFLICT (name) DO UPDATE SET
    label = EXCLUDED.label,
    context_type = EXCLUDED.context_type,
    source_table = EXCLUDED.source_table,
    source_field = EXCLUDED.source_field,
    description = EXCLUDED.description;
