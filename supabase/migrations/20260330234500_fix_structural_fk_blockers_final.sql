-- ============================================================
-- MIGRATION: Final Structural FK Blockers Fix
-- Target: Standardize clinical tables to 'pacientes' and 'agenda_medica'
-- Date: 2026-03-30
-- Description: Replaces all phantom/legacy references to 'patients' and 'consultas'
--              with the active SSOT tables 'pacientes' and 'agenda_medica'.
-- ============================================================

-- ============================================================
-- PARTE B - FIX: patients → pacientes
-- ============================================================

-- 1. iris_images
ALTER TABLE IF EXISTS public.iris_images DROP CONSTRAINT IF EXISTS iris_images_patient_id_fkey;
ALTER TABLE IF EXISTS public.iris_images ADD CONSTRAINT iris_images_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;

-- 2. iris_analyses
ALTER TABLE IF EXISTS public.iris_analyses DROP CONSTRAINT IF EXISTS iris_analyses_patient_id_fkey;
ALTER TABLE IF EXISTS public.iris_analyses ADD CONSTRAINT iris_analyses_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;

-- 3. medical_reports
ALTER TABLE IF EXISTS public.medical_reports DROP CONSTRAINT IF EXISTS medical_reports_patient_id_fkey;
ALTER TABLE IF EXISTS public.medical_reports ADD CONSTRAINT medical_reports_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;

-- 4. patient_consents
ALTER TABLE IF EXISTS public.patient_consents DROP CONSTRAINT IF EXISTS patient_consents_patient_id_fkey;
ALTER TABLE IF EXISTS public.patient_consents ADD CONSTRAINT patient_consents_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;

-- 5. medical_access_logs
ALTER TABLE IF EXISTS public.medical_access_logs DROP CONSTRAINT IF EXISTS medical_access_logs_patient_id_fkey;
ALTER TABLE IF EXISTS public.medical_access_logs ADD CONSTRAINT medical_access_logs_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE SET NULL;

-- 6. patient_tag_assignments
ALTER TABLE IF EXISTS public.patient_tag_assignments DROP CONSTRAINT IF EXISTS patient_tag_assignments_patient_id_fkey;
ALTER TABLE IF EXISTS public.patient_tag_assignments ADD CONSTRAINT patient_tag_assignments_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;

-- 7. return_reminders
ALTER TABLE IF EXISTS public.return_reminders DROP CONSTRAINT IF EXISTS return_reminders_patient_id_fkey;
ALTER TABLE IF EXISTS public.return_reminders ADD CONSTRAINT return_reminders_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;


-- ============================================================
-- PARTE C - FIX: consultas → agenda_medica
-- ============================================================

-- Clean up any orphaned references safely before creating strict FKs
UPDATE public.prescricoes_medicas SET consulta_id = NULL 
WHERE consulta_id IS NOT NULL AND consulta_id NOT IN (SELECT id FROM public.agenda_medica);

UPDATE public.transcricoes SET consulta_id = NULL 
WHERE consulta_id IS NOT NULL AND consulta_id NOT IN (SELECT id FROM public.agenda_medica);

UPDATE public.analises_clinicas SET consulta_id = NULL 
WHERE consulta_id IS NOT NULL AND consulta_id NOT IN (SELECT id FROM public.agenda_medica);

-- 8. prescricoes_medicas
ALTER TABLE IF EXISTS public.prescricoes_medicas DROP CONSTRAINT IF EXISTS prescricoes_medicas_consulta_id_fkey;
ALTER TABLE IF EXISTS public.prescricoes_medicas ADD CONSTRAINT prescricoes_medicas_consulta_id_fkey 
    FOREIGN KEY (consulta_id) REFERENCES public.agenda_medica(id) ON DELETE CASCADE;

-- 9. transcricoes
ALTER TABLE IF EXISTS public.transcricoes DROP CONSTRAINT IF EXISTS transcricoes_consulta_id_fkey;
ALTER TABLE IF EXISTS public.transcricoes ADD CONSTRAINT transcricoes_consulta_id_fkey 
    FOREIGN KEY (consulta_id) REFERENCES public.agenda_medica(id) ON DELETE SET NULL;

-- 10. analises_clinicas
ALTER TABLE IF EXISTS public.analises_clinicas DROP CONSTRAINT IF EXISTS analises_clinicas_consulta_id_fkey;
ALTER TABLE IF EXISTS public.analises_clinicas ADD CONSTRAINT analises_clinicas_consulta_id_fkey 
    FOREIGN KEY (consulta_id) REFERENCES public.agenda_medica(id) ON DELETE SET NULL;

-- ============================================================
-- AUDIT LOG
-- ============================================================
INSERT INTO public.audit_logs (action, entity, table_name, details)
VALUES (
    'SCHEMA_FIX', 
    'CORE_DB', 
    'multiple_medical_tables', 
    '{"message": "Final unification of FKs to pacientes and agenda_medica applied successfully.", "tables_affected": ["iris_images", "iris_analyses", "medical_reports", "patient_consents", "medical_access_logs", "patient_tag_assignments", "return_reminders", "prescricoes_medicas", "transcricoes", "analises_clinicas"]}'
) ON CONFLICT DO NOTHING;
