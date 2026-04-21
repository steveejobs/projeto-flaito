-- =====================================================================================
-- Migration: Seed Messaging MVP (Acervo Inicial do Flaito)
-- Description: Insere templates úteis para comunicação com os clientes
-- =====================================================================================

-- `message_templates` já permite `office_id` nulo.
-- A RLS atual `Users can manage templates of their office` no arquivo `messaging_v2_core`
-- diz: FOR ALL USING (office_id IS NULL OR office_id IN ...). 
-- Isso já dá leitura pública, mas talvez permita UPDATE público acidentalmente também dependendo de como o RLS foi escrito.
-- Apenas garantindo que is_system = true e is_active = true.

INSERT INTO public.message_templates (id, category_id, name, content, is_system, is_active)
VALUES 
(
    '60000000-0000-0000-0000-000000000001',
    'AGENDA',
    'Confirmação de Agendamento',
    'Prezado(a) {{client_name}}, seu agendamento conosco foi confirmado para o dia {{appointment_date}} às {{appointment_time}}. Para reagendamentos responda esta mensagem.',
    true,
    true
),
(
    '60000000-0000-0000-0000-000000000002',
    'LEGAL',
    'Aviso de Documento / Peça Disponível',
    'Olá {{client_name}}, a peça referente ao seu processo {{case_cnj}} está pronta para sua análise. Favor acessar o portal ou entrar em contato.',
    true,
    true
),
(
    '60000000-0000-0000-0000-000000000003',
    'LEGAL',
    'Lembrete de Prazo Legal',
    'Prezado(a) {{client_name}}, lembramos que o prazo para envio dos documentos pendentes solicitados encerra amanhã. Ficamos no aguardo.',
    true,
    true
),
(
    '60000000-0000-0000-0000-000000000004',
    'MEDICAL',
    'Aviso de Laudo Disponível',
    'Olá {{client_name}}, seu laudo e/ou plano nutricional já estão concluídos e foram enviados para o seu e-mail cadastrado. Um abraço!',
    true,
    true
)
ON CONFLICT (id) DO NOTHING;
