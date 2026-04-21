CREATE TABLE IF NOT EXISTS public.legal_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    type text, -- PETICAO, TESE, SUMULA, MODELO, PROCURACAO
    content text NOT NULL,
    tags text[],
    area text,
    office_id uuid,
    embedding vector(1536),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their office legal documents"
    ON public.legal_documents
    FOR SELECT
    USING (office_id IN (
        SELECT office_id FROM office_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create their office legal documents"
    ON public.legal_documents
    FOR INSERT
    WITH CHECK (office_id IN (
        SELECT office_id FROM office_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update their office legal documents"
    ON public.legal_documents
    FOR UPDATE
    USING (office_id IN (
        SELECT office_id FROM office_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete their office legal documents"
    ON public.legal_documents
    FOR DELETE
    USING (office_id IN (
        SELECT office_id FROM office_members WHERE user_id = auth.uid()
    ));

GRANT ALL ON TABLE public.legal_documents TO authenticated;
