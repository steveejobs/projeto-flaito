-- Migration: Knowledge Base v1 (Phase 10)
-- Create office_knowledge table and RLS policies

CREATE TABLE IF NOT EXISTS public.office_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('piece', 'thesis')),
    title TEXT NOT NULL,
    content TEXT, -- Markdown content
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    updated_by UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- RLS POLICIES
ALTER TABLE public.office_knowledge ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Users can view knowledge from their office
CREATE POLICY "Users can view office knowledge"
    ON public.office_knowledge FOR SELECT
    USING (office_id IN (
        SELECT m.office_id FROM public.office_members m 
        WHERE m.user_id = auth.uid() AND m.is_active = true
    ));

-- 2. INSERT: Users can create knowledge for their office
CREATE POLICY "Users can insert office knowledge"
    ON public.office_knowledge FOR INSERT
    WITH CHECK (office_id IN (
        SELECT m.office_id FROM public.office_members m 
        WHERE m.user_id = auth.uid() AND m.is_active = true
    ));

-- 3. UPDATE: Users can update knowledge within their office
CREATE POLICY "Users can update office knowledge"
    ON public.office_knowledge FOR UPDATE
    USING (office_id IN (
        SELECT m.office_id FROM public.office_members m 
        WHERE m.user_id = auth.uid() AND m.is_active = true
    ));

-- 4. DELETE: Users can delete knowledge within their office
CREATE POLICY "Users can delete office knowledge"
    ON public.office_knowledge FOR DELETE
    USING (office_id IN (
        SELECT m.office_id FROM public.office_members m 
        WHERE m.user_id = auth.uid() AND m.is_active = true
    ));

-- INDEXES for search and filtering
CREATE INDEX IF NOT EXISTS idx_office_knowledge_office_id ON public.office_knowledge(office_id);
CREATE INDEX IF NOT EXISTS idx_office_knowledge_type ON public.office_knowledge(type);
CREATE INDEX IF NOT EXISTS idx_office_knowledge_active ON public.office_knowledge(is_active);

-- TRIGGER for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_office_knowledge_updated_at ON public.office_knowledge;
CREATE TRIGGER tr_office_knowledge_updated_at
BEFORE UPDATE ON public.office_knowledge
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
