-- Migration: 20260407090000_medical_p0_security.sql
-- Description: Create audit_logs and medical_consents tables for P0 remediation.

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- e.g., 'access', 'export', 'clinical_view'
    actor_user_id UUID REFERENCES auth.users(id),
    actor_role TEXT, -- e.g., 'doctor', 'admin'
    patient_id UUID, -- UUID if linked to a patient, null otherwise
    resource_type TEXT NOT NULL, -- e.g., 'medical_record', 'iris_image', 'prescription'
    resource_id TEXT, -- ID of the resource (UUID or path)
    action TEXT NOT NULL, -- e.g., 'read', 'write', 'delete', 'download'
    timestamp TIMESTAMPTZ DEFAULT now(),
    ip TEXT,
    user_agent TEXT,
    office_id UUID REFERENCES public.offices(id),
    metadata_json JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow authenticated users to INSERT logs. Only admins/office owners can SELECT.
CREATE POLICY "Allow authenticated insert to audit_logs" ON public.audit_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow office members to view their own office logs" ON public.audit_logs
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM auth.users WHERE office_id = public.audit_logs.office_id
        ) OR (actor_user_id = auth.uid())
    );

-- 2. Create medical_consents table
CREATE TABLE IF NOT EXISTS public.medical_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL, -- Link to patient record
    office_id UUID REFERENCES public.offices(id),
    consent_version TEXT NOT NULL, -- e.g., '1.0'
    consent_text_snapshot TEXT NOT NULL, -- Full text of the TCLE at the time of signing
    purpose TEXT NOT NULL, -- e.g., 'iridology_analysis', 'data_sharing'
    ip TEXT,
    user_agent TEXT,
    signed_at TIMESTAMPTZ DEFAULT now(),
    revoked_at TIMESTAMPTZ, -- If null, consent is active
    metadata_json JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on medical_consents
ALTER TABLE public.medical_consents ENABLE ROW LEVEL SECURITY;

-- Policies for medical_consents
CREATE POLICY "Allow office members to manage consents" ON public.medical_consents
    FOR ALL USING (
        office_id IN (
            SELECT office_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id ON public.audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_office_id ON public.audit_logs(office_id);
CREATE INDEX IF NOT EXISTS idx_medical_consents_patient_id ON public.medical_consents(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_consents_office_id ON public.medical_consents(office_id);
