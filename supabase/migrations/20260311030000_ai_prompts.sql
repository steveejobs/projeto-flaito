-- Migration para a tabela de configurações de IA (ai_prompts)

CREATE TABLE IF NOT EXISTS ai_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'openai', -- openai, anthropic
    api_key TEXT,
    
    -- Prompts de sistema customizáveis (textos longos)
    prompt_iridology TEXT,
    prompt_clinical_analysis TEXT,
    prompt_case_decoder TEXT,

    -- Data controle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique para cada escritório ter sua config de IA
    UNIQUE(office_id)
);

-- Habilitar RLS
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "usuários podem ler config de sua clínica"
    ON ai_config FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM office_members
            WHERE office_members.office_id = ai_config.office_id
            AND office_members.user_id = auth.uid()
        )
    );

CREATE POLICY "usuários podem criar/atualizar config de sua clínica"
    ON ai_config FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM office_members
            WHERE office_members.office_id = ai_config.office_id
            AND office_members.user_id = auth.uid()
            AND office_members.role IN ('owner', 'admin')
        )
    );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_ai_config_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_config_mtime
BEFORE UPDATE ON ai_config
FOR EACH ROW EXECUTE PROCEDURE update_ai_config_modtime();
