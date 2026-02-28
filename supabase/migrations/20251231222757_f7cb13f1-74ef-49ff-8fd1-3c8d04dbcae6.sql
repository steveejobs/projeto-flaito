-- Update user role to OWNER for full access
UPDATE public.office_members 
SET role = 'OWNER' 
WHERE user_id = '19e092f9-2f71-4cbf-96d0-907314ee0c1a';