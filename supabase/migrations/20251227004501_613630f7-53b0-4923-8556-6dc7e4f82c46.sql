-- Add branding columns to offices table
ALTER TABLE public.offices 
ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#111827',
ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#D4AF37',
ADD COLUMN IF NOT EXISTS header_block text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_offices_slug ON public.offices(slug);

-- Ensure RLS is enabled
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

-- Policy: office members can view their office
DROP POLICY IF EXISTS "Office members can view their office" ON public.offices;
CREATE POLICY "Office members can view their office"
ON public.offices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.office_members om 
    WHERE om.office_id = offices.id 
    AND om.user_id = auth.uid()
  )
);

-- Policy: only OWNER/ADMIN can update office
DROP POLICY IF EXISTS "Office admins can update their office" ON public.offices;
CREATE POLICY "Office admins can update their office"
ON public.offices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.office_members om 
    WHERE om.office_id = offices.id 
    AND om.user_id = auth.uid()
    AND om.role IN ('OWNER', 'ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.office_members om 
    WHERE om.office_id = offices.id 
    AND om.user_id = auth.uid()
    AND om.role IN ('OWNER', 'ADMIN')
  )
);