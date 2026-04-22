-- Tabela para gerenciar o estado das execuções do NIJA
CREATE TABLE IF NOT EXISTS nija_pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING')),
    current_stage TEXT NOT NULL DEFAULT 'STARTING',
    progress_percentage INTEGER DEFAULT 0,
    dossier_id UUID,
    final_piece_id UUID,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    logs TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE nija_pipeline_runs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para isolamento multi-tenant
CREATE POLICY "Users can view their office's nija runs"
    ON nija_pipeline_runs FOR SELECT
    USING (office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert nija runs for their office"
    ON nija_pipeline_runs FOR INSERT
    WITH CHECK (office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid()));

-- Gatilho para atualizar o updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_nija_pipeline_runs_updated_at
    BEFORE UPDATE ON nija_pipeline_runs
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Webhook para disparar o worker assíncrono (Simulado via Edge Function call ou cron se necessário no futuro)
-- Por enquanto, usaremos chamadas assíncronas via Edge Function que atualizam esta tabela.
