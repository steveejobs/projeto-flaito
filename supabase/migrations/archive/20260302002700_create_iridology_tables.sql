-- =============================================
-- IRIDOLOGY MODULE — Database Schema
-- =============================================

-- Iris Images: fotos capturadas
CREATE TABLE IF NOT EXISTS iris_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    eye TEXT NOT NULL CHECK (eye IN ('left', 'right')),
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    quality_score NUMERIC(3,1),
    quality_notes JSONB DEFAULT '{}',
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Iris Analyses: análises realizadas
CREATE TABLE IF NOT EXISTS iris_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    left_image_id UUID REFERENCES iris_images(id),
    right_image_id UUID REFERENCES iris_images(id),
    analysis_type TEXT DEFAULT 'complete',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    ai_model TEXT DEFAULT 'gpt-4o',
    clinical_data TEXT,
    ai_response JSONB DEFAULT '{}',
    findings JSONB DEFAULT '[]',
    critical_alerts JSONB DEFAULT '[]',
    anamnesis_questions JSONB DEFAULT '[]',
    iridology_map TEXT DEFAULT 'jensen',
    annotations JSONB DEFAULT '[]',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Iris Findings: achados individuais por zona
CREATE TABLE IF NOT EXISTS iris_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES iris_analyses(id) ON DELETE CASCADE,
    eye TEXT NOT NULL CHECK (eye IN ('left', 'right')),
    zone_number INT,
    zone_name TEXT,
    organ_system TEXT,
    finding_type TEXT CHECK (finding_type IN ('lacuna', 'cripta', 'pigmentation', 'fiber_alteration', 'ring', 'other')),
    severity TEXT DEFAULT 'moderate' CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
    description TEXT,
    coordinates JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medical Reports: laudos médicos
CREATE TABLE IF NOT EXISTS medical_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    analysis_id UUID REFERENCES iris_analyses(id),
    report_type TEXT DEFAULT 'full',
    title TEXT NOT NULL,
    content JSONB DEFAULT '{}',
    patient_summary TEXT,
    annotated_images JSONB DEFAULT '[]',
    template_id UUID,
    version INT DEFAULT 1,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'signed')),
    signed_at TIMESTAMPTZ,
    signed_by UUID REFERENCES auth.users(id),
    signature_data TEXT,
    pdf_url TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report Templates: templates de laudo personalizáveis
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sections JSONB DEFAULT '[]',
    terminology_level TEXT DEFAULT 'technical',
    detail_level TEXT DEFAULT 'detailed',
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patient Consents: consentimento digital (TCLE)
CREATE TABLE IF NOT EXISTS patient_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    consent_type TEXT DEFAULT 'image_use',
    consent_text TEXT NOT NULL,
    accepted BOOLEAN DEFAULT false,
    accepted_at TIMESTAMPTZ,
    signature_data TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medical Access Logs: log de acesso a prontuários (LGPD)
CREATE TABLE IF NOT EXISTS medical_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    patient_id UUID REFERENCES patients(id),
    resource_type TEXT NOT NULL,
    resource_id UUID,
    action TEXT NOT NULL CHECK (action IN ('view', 'create', 'update', 'delete', 'export', 'print')),
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patient Tags: tags para categorizar pacientes
CREATE TABLE IF NOT EXISTS patient_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patient Tag Assignments
CREATE TABLE IF NOT EXISTS patient_tag_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES patient_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(patient_id, tag_id)
);

-- Return Reminders: lembretes de retorno
CREATE TABLE IF NOT EXISTS return_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    suggested_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'completed', 'cancelled')),
    notified_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_iris_images_patient ON iris_images(patient_id);
CREATE INDEX IF NOT EXISTS idx_iris_analyses_patient ON iris_analyses(patient_id);
CREATE INDEX IF NOT EXISTS idx_iris_findings_analysis ON iris_findings(analysis_id);
CREATE INDEX IF NOT EXISTS idx_medical_reports_patient ON medical_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_access_logs_patient ON medical_access_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_access_logs_user ON medical_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_tags_office ON patient_tags(office_id);
CREATE INDEX IF NOT EXISTS idx_return_reminders_patient ON return_reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_return_reminders_date ON return_reminders(suggested_date);
CREATE INDEX IF NOT EXISTS idx_patient_consents_patient ON patient_consents(patient_id);

-- RLS
ALTER TABLE iris_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE iris_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE iris_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies (same office pattern as existing tables)
CREATE POLICY "Users can manage iris_images in their office" ON iris_images FOR ALL USING (
    office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can manage iris_analyses in their office" ON iris_analyses FOR ALL USING (
    office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can manage iris_findings via analysis" ON iris_findings FOR ALL USING (
    analysis_id IN (SELECT id FROM iris_analyses WHERE office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid()))
);

CREATE POLICY "Users can manage medical_reports in their office" ON medical_reports FOR ALL USING (
    office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can manage report_templates in their office" ON report_templates FOR ALL USING (
    office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can manage patient_consents in their office" ON patient_consents FOR ALL USING (
    office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can view medical_access_logs in their office" ON medical_access_logs FOR SELECT USING (
    office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert medical_access_logs" ON medical_access_logs FOR INSERT WITH CHECK (
    office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can manage patient_tags in their office" ON patient_tags FOR ALL USING (
    office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can manage patient_tag_assignments" ON patient_tag_assignments FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid()))
);

CREATE POLICY "Users can manage return_reminders in their office" ON return_reminders FOR ALL USING (
    office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid())
);
