-- Create iridology_exams table
CREATE TABLE IF NOT EXISTS public.iridology_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    right_eye_image_url TEXT,
    left_eye_image_url TEXT,
    analysis_summary TEXT,
    analysis_details JSONB,
    vitality_index INTEGER
);

-- Enable RLS
ALTER TABLE public.iridology_exams ENABLE ROW LEVEL SECURITY;

-- Create Policies for iridology_exams
CREATE POLICY "Users can manage iridology_exams in their office" ON public.iridology_exams FOR ALL USING (
    office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
);

-- Create bucket for iridology images if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('iridology-images', 'iridology-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for iridology-images bucket (Public read, Authenticated write/delete)
CREATE POLICY "iridology_images_read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'iridology-images');

CREATE POLICY "iridology_images_insert" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'iridology-images' AND auth.role() = 'authenticated');

CREATE POLICY "iridology_images_update" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'iridology-images' AND auth.role() = 'authenticated');

CREATE POLICY "iridology_images_delete" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'iridology-images' AND auth.role() = 'authenticated');
