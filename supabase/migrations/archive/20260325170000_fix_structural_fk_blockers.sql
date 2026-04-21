-- ============================================================
-- MIGRATION: Fix Structural FK Blockers
-- Target: Standardize clinical tables to 'pacientes' and 'agenda_medica'
-- Date: 2026-03-25
-- ============================================================

-- 1. FIX: Standardize FKs from 'patients' (legacy/typo) to 'pacientes' (active)

-- iris_images
ALTER TABLE public.iris_images DROP CONSTRAINT IF EXISTS iris_images_patient_id_fkey;
ALTER TABLE public.iris_images ADD CONSTRAINT iris_images_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;

-- iris_analyses
ALTER TABLE public.iris_analyses DROP CONSTRAINT IF EXISTS iris_analyses_patient_id_fkey;
ALTER TABLE public.iris_analyses ADD CONSTRAINT iris_analyses_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;

-- medical_reports
ALTER TABLE public.medical_reports DROP CONSTRAINT IF EXISTS medical_reports_patient_id_fkey;
ALTER TABLE public.medical_reports ADD CONSTRAINT medical_reports_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;

-- patient_consents
ALTER TABLE public.patient_consents DROP CONSTRAINT IF EXISTS patient_consents_patient_id_fkey;
ALTER TABLE public.patient_consents ADD CONSTRAINT patient_consents_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;

-- medical_access_logs
ALTER TABLE public.medical_access_logs DROP CONSTRAINT IF EXISTS medical_access_logs_patient_id_fkey;
ALTER TABLE public.medical_access_logs ADD CONSTRAINT medical_access_logs_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE SET NULL;

-- patient_tag_assignments
ALTER TABLE public.patient_tag_assignments DROP CONSTRAINT IF EXISTS patient_tag_assignments_patient_id_fkey;
ALTER TABLE public.patient_tag_assignments ADD CONSTRAINT patient_tag_assignments_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;

-- return_reminders
ALTER TABLE public.return_reminders DROP CONSTRAINT IF EXISTS return_reminders_patient_id_fkey;
ALTER TABLE public.return_reminders ADD CONSTRAINT return_reminders_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;


-- 2. FIX: Resolve 'consultas' phantom table reference in 'prescricoes_medicas'

-- Adjust prescricoes_medicas to reference agenda_medica
ALTER TABLE public.prescricoes_medicas DROP CONSTRAINT IF EXISTS prescricoes_medicas_consulta_id_fkey;
ALTER TABLE public.prescricoes_medicas ADD CONSTRAINT prescricoes_medicas_consulta_id_fkey 
    FOREIGN KEY (consulta_id) REFERENCES public.agenda_medica(id) ON DELETE CASCADE;

-- 3. AUDIT LOG
INSERT INTO public.audit_logs (action, entity, table_name, details)
VALUES ('SCHEMA_FIX', 'CORE_DB', 'multiple', '{"message": "Standardized medical FKs and resolved phantom consultas reference."}');
