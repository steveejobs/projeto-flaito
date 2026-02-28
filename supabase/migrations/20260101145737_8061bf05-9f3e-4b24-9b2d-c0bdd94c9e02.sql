-- Add status column to clients table for archiving functionality
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add check constraint for valid status values
ALTER TABLE public.clients 
ADD CONSTRAINT clients_status_check CHECK (status IN ('active', 'archived'));

-- Create index for filtering by status
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);