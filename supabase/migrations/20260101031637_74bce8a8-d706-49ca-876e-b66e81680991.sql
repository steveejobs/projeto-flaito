-- Tabela para armazenar snapshots de auditoria técnica
-- Apenas ADMIN/OWNER podem ler e inserir

CREATE TABLE IF NOT EXISTS public.audit_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'DONE' CHECK (status IN ('DONE', 'FAILED')),
  report_md text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'edge',
  hash text NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_snapshots_office_created 
  ON public.audit_snapshots(office_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_snapshots_office_id 
  ON public.audit_snapshots(office_id, id);

-- Habilitar RLS
ALTER TABLE public.audit_snapshots ENABLE ROW LEVEL SECURITY;

-- Função helper para verificar se usuário é ADMIN ou OWNER do office
-- Usa SECURITY INVOKER (padrão) para respeitar RLS
CREATE OR REPLACE FUNCTION public.lexos_is_owner_or_admin(p_office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.office_members 
    WHERE office_id = p_office_id 
      AND user_id = auth.uid() 
      AND role IN ('OWNER', 'ADMIN')
  );
$$;

-- Policy SELECT: apenas ADMIN/OWNER podem ler snapshots do seu office
CREATE POLICY "audit_snapshots_select_admin_owner" ON public.audit_snapshots
  FOR SELECT
  USING (
    public.lexos_is_owner_or_admin(office_id)
  );

-- Policy INSERT: apenas ADMIN/OWNER podem inserir, e created_by deve ser o usuário atual
CREATE POLICY "audit_snapshots_insert_admin_owner" ON public.audit_snapshots
  FOR INSERT
  WITH CHECK (
    public.lexos_is_owner_or_admin(office_id)
    AND created_by = auth.uid()
  );

-- Sem policies de UPDATE/DELETE (negar por padrão via RLS)

-- Comentários
COMMENT ON TABLE public.audit_snapshots IS 'Histórico de snapshots de auditoria técnica do sistema';
COMMENT ON COLUMN public.audit_snapshots.report_md IS 'Relatório em formato Markdown';
COMMENT ON COLUMN public.audit_snapshots.meta IS 'Metadados (contagens, versões, etc)';
COMMENT ON COLUMN public.audit_snapshots.risk IS 'Classificação de riscos (CRÍTICO/ALTO/MÉDIO/BAIXO)';
COMMENT ON COLUMN public.audit_snapshots.hash IS 'SHA256 do report_md para deduplicação';
COMMENT ON FUNCTION public.lexos_is_owner_or_admin(uuid) IS 'Verifica se usuário atual é OWNER ou ADMIN do office especificado';