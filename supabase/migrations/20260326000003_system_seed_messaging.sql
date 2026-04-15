-- Seed: Messaging Module (Categorias e Templates)
-- Role: Principal Engineer + Data Architect
-- Target: message_template_categories, message_templates

-- 1. População de Categorias de Templates
INSERT INTO public.message_template_categories (id, name, description)
VALUES 
('ONBOARDING', 'Boas-vindas e Ativação', 'Templates para primeiro contato e cadastro de novos clientes/pacientes.'),
('REMINDER', 'Lembretes e Avisos', 'Templates para avisos de consultas, audiências e prazos.'),
('FEEDBACK', 'Pesquisa e Qualidade', 'Templates para coleta de feedback pós-atendimento.'),
('QUICK', 'Respostas Rápidas', 'Frases curtas para agilizar o atendimento manual.'),
('LEGAL_SPECIFIC', 'Jurídico - Específicos', 'Templates exclusivos para o fluxo jurídico.'),
('MEDICAL_SPECIFIC', 'Médico - Específicos', 'Templates exclusivos para o fluxo médico.')
ON CONFLICT (id) DO NOTHING;

-- 2. População de Templates de Mensagens
-- Campos: id, office_id, context_type, name, content, category_id, is_active
INSERT INTO public.message_templates (office_id, context_type, name, content, category_id, is_active)
VALUES 
('ff000000-0000-0000-0000-000000000000', 'MEDICAL', 'Boas-vindas (Clínica)', 'Olá {{client_name}}! Bem-vindo(a) à nossa clínica. Estamos muito felizes em tê-lo(a) conosco. Como podemos ajudar hoje?', 'ONBOARDING', true),
('ff000000-0000-0000-0000-000000000000', 'MEDICAL', 'Lembrete de Consulta (24h)', 'Olá {{client_name}}, passando para lembrar da sua consulta amanhã às {{appointment_time}}. Podemos confirmar sua presença?', 'REMINDER', true),
('ff000000-0000-0000-0000-000000000000', 'LEGAL', 'Boas-vindas (Jurídico)', 'Olá {{client_name}}! Somos o escritório Flaito. Recebemos seu caso e já estamos analisando os próximos passos. Em breve entraremos em contato.', 'ONBOARDING', true),
('ff000000-0000-0000-0000-000000000000', 'LEGAL', 'Aviso de Audiência', 'Prezado(a) {{client_name}}, informamos que sua audiência foi agendada para o dia {{event_date}} às {{event_time}}. Favor confirmar o recebimento.', 'LEGAL_SPECIFIC', true),
('ff000000-0000-0000-0000-000000000000', 'MEDICAL', 'Respostas Rápidas: Sem Vagas', 'Infelizmente não temos vagas para esta semana. Gostaria de entrar na lista de espera?', 'QUICK', true),
('ff000000-0000-0000-0000-000000000000', 'LEGAL', 'Respostas Rápidas: Documentação', 'Poderia nos enviar uma foto do seu RG e comprovante de residência atualizado?', 'QUICK', true);
