-- Otimização de performance para o novo ciclo de vida do CRM
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON public.crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_deleted_at ON public.crm_leads(deleted_at);
CREATE INDEX IF NOT EXISTS idx_crm_leads_pipeline_stage ON public.crm_leads(pipeline_stage);

-- Índice para busca rápida de expurgo
CREATE INDEX IF NOT EXISTS idx_crm_leads_purge_at ON public.crm_leads(purge_at) WHERE status = 'trashed';

-- Índice para histórico cronológico
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON public.crm_activities(created_at DESC);
