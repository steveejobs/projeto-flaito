-- Stage 7: Voice Agent Safety & Handshake Infrastructure

-- Create status enum for pending actions
DO $$ BEGIN
    CREATE TYPE voice_action_status AS ENUM ('pending', 'confirmed', 'rejected', 'expired', 'executed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table for pending voice actions (The server-side handshake)
CREATE TABLE IF NOT EXISTS public.voice_pending_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_id UUID NOT NULL,
    intent TEXT NOT NULL,
    args JSONB DEFAULT '{}'::jsonb NOT NULL,
    status voice_action_status DEFAULT 'pending' NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enhance audit logs with safety metadata
ALTER TABLE public.voice_agent_audit_logs 
ADD COLUMN IF NOT EXISTS stt_confidence FLOAT,
ADD COLUMN IF NOT EXISTS effective_mode TEXT,
ADD COLUMN IF NOT EXISTS is_wake_word_hit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pending_action_id UUID REFERENCES public.voice_pending_actions(id) ON DELETE SET NULL;

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_voice_pending_expires ON public.voice_pending_actions(expires_at);
CREATE INDEX IF NOT EXISTS idx_voice_pending_user_session ON public.voice_pending_actions(user_id, session_id);

-- RLS for pending actions
ALTER TABLE public.voice_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their own pending actions"
    ON public.voice_pending_actions FOR ALL
    USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.voice_pending_actions IS 'Armazena ações de voz que requerem confirmação explícita antes de serem executadas pelo backend.';
