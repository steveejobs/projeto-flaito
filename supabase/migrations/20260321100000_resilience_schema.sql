-- Migration: Resilience Schema (Retry Control)
-- Created: 2026-03-21 10:00:00

-- 1. Ampliando a infraestrutura de retentativas em notificacoes_fila
ALTER TABLE public.notificacoes_fila 
    ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error_code TEXT,
    ADD COLUMN IF NOT EXISTS last_error_message TEXT,
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS attempts_json JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS correlation_id UUID DEFAULT gen_random_uuid();

-- 2. Adição de Constraint para Status Final
DO $$ 
BEGIN 
    ALTER TABLE public.notificacoes_fila DROP CONSTRAINT IF EXISTS notificacoes_fila_status_check;
EXCEPTION 
    WHEN undefined_object THEN NULL; 
END $$;

ALTER TABLE public.notificacoes_fila 
    ADD CONSTRAINT notificacoes_fila_status_check 
    CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'FAILED_PERMANENT'));

-- 3. Índices para performance do Worker
CREATE INDEX IF NOT EXISTS idx_notificacoes_fila_worker 
    ON public.notificacoes_fila(status, next_retry_at) 
    WHERE (status = 'PENDING');

CREATE INDEX IF NOT EXISTS idx_notificacoes_fila_office 
    ON public.notificacoes_fila(office_id, status);

-- 4. Audit Log do Z-API Config (Ajuste em notificacao_config se existir)
-- Trigger para auditar mudanças em tokens e instâncias
CREATE OR REPLACE FUNCTION public.fn_audit_office_notif_config()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (
        entity_type,
        entity_id,
        action,
        actor_user_id,
        office_id,
        before_snapshot,
        after_snapshot
    ) VALUES (
        'OFFICE_CONFIG',
        COALESCE(NEW.id, OLD.id)::text,
        TG_OP,
        auth.uid(),
        COALESCE(NEW.office_id, OLD.office_id),
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_notif_config ON public.notificacao_config;
CREATE TRIGGER trg_audit_notif_config
    AFTER INSERT OR UPDATE OR DELETE ON public.notificacao_config
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_office_notif_config();
