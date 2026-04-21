-- Update pacientes table
ALTER TABLE public.pacientes 
ADD COLUMN IF NOT EXISTS historico_medico TEXT,
ADD COLUMN IF NOT EXISTS alergias TEXT,
ADD COLUMN IF NOT EXISTS medicamentos_em_uso TEXT;

-- Create prescricoes_medicas table
CREATE TABLE IF NOT EXISTS public.prescricoes_medicas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    consulta_id UUID REFERENCES public.consultas(id) ON DELETE SET NULL,
    paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
    profissional_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    medicamentos JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.prescricoes_medicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view prescriptions from their office"
    ON public.prescricoes_medicas FOR SELECT
    USING (office_id IN (SELECT office_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert prescriptions to their office"
    ON public.prescricoes_medicas FOR INSERT
    WITH CHECK (office_id IN (SELECT office_id FROM user_roles WHERE user_id = auth.uid()));

-- Create user_medical_snippets table
CREATE TABLE IF NOT EXISTS public.user_medical_snippets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    shortcut TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, shortcut)
);

ALTER TABLE public.user_medical_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own medical snippets"
    ON public.user_medical_snippets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own medical snippets"
    ON public.user_medical_snippets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own medical snippets"
    ON public.user_medical_snippets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own medical snippets"
    ON public.user_medical_snippets FOR DELETE
    USING (auth.uid() = user_id);
