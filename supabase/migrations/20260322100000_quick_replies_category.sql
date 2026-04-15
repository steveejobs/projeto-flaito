-- Migration: Quick Replies Category
INSERT INTO public.message_template_categories (id, name, description)
VALUES ('QUICK', 'Respostas Rápidas', 'Frases curtas e respostas frequentes para agilizar o atendimento')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;
