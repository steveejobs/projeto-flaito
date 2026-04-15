-- Migration: 20260428100000 - Professional Templates Configuration
-- Description: Updates office branding to support the new professional template system.

BEGIN;

UPDATE public.offices
SET branding = branding || jsonb_build_object(
  'colors', jsonb_build_object(
    'primary', COALESCE(branding->>'primary_color', '#1e40af'),
    'secondary', '#64748b',
    'accent', '#3b82f6'
  ),
  'watermark', jsonb_build_object(
    'enabled', true,
    'opacity', 0.05,
    'position', 'center',
    'size', 'md'
  ),
  'documentStyle', jsonb_build_object(
    'legal', 'premium_elegant',
    'medical', 'modern_executive'
  )
)
WHERE branding IS NULL OR NOT (branding ? 'colors');

-- Log the migration
INSERT INTO public.system_migration_logs (migration_name, details)
VALUES ('PROFESSIONAL_TEMPLATES_CONFIG', '{"updated_branding_structure": true}');

COMMIT;
