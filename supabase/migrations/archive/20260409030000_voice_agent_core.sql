-- Create voice agent modes enum
DO $$ BEGIN
    CREATE TYPE voice_agent_mode AS ENUM ('consultation', 'assisted', 'critical', 'automatic');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create user_voice_settings table
CREATE TABLE IF NOT EXISTS public.user_voice_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    voice_enabled BOOLEAN DEFAULT true,
    wake_word TEXT DEFAULT 'flaito',
    default_voice_mode voice_agent_mode DEFAULT 'automatic',
    allow_critical_voice_actions BOOLEAN DEFAULT false,
    require_extra_auth_for_critical_actions BOOLEAN DEFAULT true,
    voice_auto_play_enabled BOOLEAN DEFAULT true,
    
    -- TTS Settings (ElevenLabs specific)
    tts_provider TEXT DEFAULT 'elevenlabs',
    tts_voice_id TEXT DEFAULT '21m00Tcm4TlvDq8ikWAM', -- Rachel
    tts_stability FLOAT DEFAULT 0.5,
    tts_similarity_boost FLOAT DEFAULT 0.75,
    tts_style FLOAT DEFAULT 0.0,
    tts_speed FLOAT DEFAULT 1.0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.voice_agent_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id UUID NOT NULL,
    transcript TEXT,
    intent TEXT,
    mode_requested voice_agent_mode,
    mode_effective voice_agent_mode,
    tool_called TEXT,
    resource_type TEXT,
    resource_id TEXT,
    confirmation_required BOOLEAN DEFAULT false,
    confirmation_received BOOLEAN DEFAULT false,
    extra_auth_required BOOLEAN DEFAULT false,
    extra_auth_passed BOOLEAN DEFAULT false,
    action_status TEXT, -- 'success', 'failed', 'blocked', 'cancelled'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for user_voice_settings
ALTER TABLE public.user_voice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own voice settings"
    ON public.user_voice_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voice settings"
    ON public.user_voice_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice settings"
    ON public.user_voice_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS for voice_agent_audit_logs
ALTER TABLE public.voice_agent_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own voice audit logs"
    ON public.voice_agent_audit_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Anyone authenticated can insert audit logs"
    ON public.voice_agent_audit_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voice_audit_user_id ON public.voice_agent_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_audit_session_id ON public.voice_agent_audit_logs(session_id);
