-- Migration: Standardize Dynamic Variables
-- Description: Unifies variable names to {{entity.field}} format, fixes mappings, and sets is_required correctly.

DELETE FROM public.dynamic_variables;

INSERT INTO public.dynamic_variables (name, label, context_type, source_type, source_table, source_field, is_required, description) VALUES
-- Global
('client.name', 'Nome do Cliente/Paciente', 'GLOBAL', 'TABLE_FIELD', 'clients', 'full_name', true, 'Nome completo do cliente ou paciente'),
('client.phone', 'Telefone do Cliente/Paciente', 'GLOBAL', 'TABLE_FIELD', 'clients', 'phone', false, 'Telefone de contato do cliente ou paciente'),
('client.email', 'E-mail do Cliente/Paciente', 'GLOBAL', 'TABLE_FIELD', 'clients', 'email', false, 'E-mail de contato'),
('client.cpf', 'CPF do Cliente/Paciente', 'GLOBAL', 'TABLE_FIELD', 'clients', 'cpf', false, 'CPF do cliente ou paciente'),
('office.name', 'Nome do Escritório/Clínica', 'GLOBAL', 'TABLE_FIELD', 'offices', 'nome', false, 'Nome do estabelecimento'),

-- Agenda
('appointment.date', 'Data do Agendamento', 'AGENDA', 'TABLE_FIELD', 'agenda_medica', 'data_hora', true, 'Data do agendamento formatada (DD/MM/AAAA)'),
('appointment.time', 'Horário do Agendamento', 'AGENDA', 'TABLE_FIELD', 'agenda_medica', 'data_hora', true, 'Horário do agendamento formatado (HH:MM)'),

-- Medical
('professional.name', 'Nome do Profissional', 'MEDICAL', 'TABLE_FIELD', 'profissionais', 'nome', false, 'Nome do médico ou profissional de saúde atendente'),
('protocol.link', 'Link do Protocolo', 'MEDICAL', 'COMPUTED', null, null, false, 'Link dinâmico gerado para protocolos de atendimento'),
('report.type', 'Tipo de Laudo', 'MEDICAL', 'TABLE_FIELD', 'medical_reports', 'tipo', false, 'Tipo de laudo emitido'),
('patient.name', 'Nome do Paciente', 'MEDICAL', 'TABLE_FIELD', 'pacientes', 'nome', true, 'Nome do paciente na ficha médica'),

-- Legal
('case.number', 'Número do Processo', 'LEGAL', 'TABLE_FIELD', 'cases', 'cnj_number', true, 'Número do processo judicial (CNJ)'),
('case.court', 'Nome da Vara/Tribunal', 'LEGAL', 'TABLE_FIELD', 'cases', 'court_name', true, 'Vara ou tribunal responsável pelo processo'),
('case.opponent', 'Parte Contrária', 'LEGAL', 'TABLE_FIELD', 'cases', 'opponent_name', true, 'Nome da parte contrária no processo'),
('deadline.date', 'Data Final do Prazo', 'LEGAL', 'TABLE_FIELD', 'case_deadlines', 'due_date', true, 'Data final para cumprimento do prazo processual'),
('legal.action_type', 'Tipo da Ação', 'LEGAL', 'TABLE_FIELD', 'cases', 'subtype', false, 'Tipo ou natureza da ação judicial')
ON CONFLICT (name) DO UPDATE SET
    label = EXCLUDED.label,
    context_type = EXCLUDED.context_type,
    source_table = EXCLUDED.source_table,
    source_field = EXCLUDED.source_field,
    is_required = EXCLUDED.is_required,
    description = EXCLUDED.description;
