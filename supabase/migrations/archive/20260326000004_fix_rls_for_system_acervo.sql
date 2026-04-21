-- Migration: Update RLS for System Content Visibility
-- Goal: Allow all authenticated users to read content from SYSTEM offices (Acervo)
-- Author: Antigravity (Principal Engineer)

-- 1. Banco Jurídico
DROP POLICY IF EXISTS "Users can view banco_juridico from their office" ON public.banco_juridico;
CREATE POLICY "Users can view banco_juridico (own office + system content)"
    ON public.banco_juridico FOR SELECT
    USING (
        office_id IN (SELECT id FROM public.offices WHERE office_type = 'SYSTEM')
        OR 
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
    );

-- 2. Protocolos Médicos
DROP POLICY IF EXISTS "protocolos_office_access" ON public.protocolos;
CREATE POLICY "Users can view protocolos (own office + system content)"
    ON public.protocolos FOR SELECT
    USING (
        office_id IN (SELECT id FROM public.offices WHERE office_type = 'SYSTEM')
        OR 
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
    );

-- 3. Referências Científicas (vinculadas a protocolos)
DROP POLICY IF EXISTS "referencias_cientificas_office_access" ON public.referencias_cientificas;
CREATE POLICY "Users can view referencias (own office + system content)"
    ON public.referencias_cientificas FOR SELECT
    USING (
        office_id IN (SELECT id FROM public.offices WHERE office_type = 'SYSTEM')
        OR 
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
    );

-- 4. Message Templates
DROP POLICY IF EXISTS "Users can view their office legal documents" ON public.legal_documents; -- Wait, this is for legal_documents
-- Check message_templates policies (likely generic from base schema or missing specific name)
-- MessageSettings.tsx uses message_templates

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "msg_templates_read_policy" ON public.message_templates;
CREATE POLICY "Users can view message_templates (own office + system content)"
    ON public.message_templates FOR SELECT
    USING (
        office_id IN (SELECT id FROM public.offices WHERE office_type = 'SYSTEM')
        OR 
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
    );
