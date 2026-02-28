-- Criar tabela office_ui_settings
CREATE TABLE public.office_ui_settings (
  office_id uuid PRIMARY KEY REFERENCES public.offices(id) ON DELETE CASCADE,
  ui_font text NOT NULL DEFAULT 'inter',
  ui_scale numeric NOT NULL DEFAULT 1.0,
  ui_density text NOT NULL DEFAULT 'normal',
  accent text NOT NULL DEFAULT 'gold',
  sidebar_logo_scale numeric NOT NULL DEFAULT 1.0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Comentario da tabela
COMMENT ON TABLE public.office_ui_settings IS 'Configuracoes de aparencia da UI por escritorio';

-- Trigger de validacao e atualizacao automatica
CREATE OR REPLACE FUNCTION public.validate_office_ui_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validar ui_font
  IF NEW.ui_font NOT IN ('inter', 'ibm_plex_sans', 'source_sans_3') THEN
    RAISE EXCEPTION 'ui_font invalido: %. Valores permitidos: inter, ibm_plex_sans, source_sans_3', NEW.ui_font;
  END IF;
  
  -- Validar ui_scale (0.95 a 1.05)
  IF NEW.ui_scale < 0.95 OR NEW.ui_scale > 1.05 THEN
    RAISE EXCEPTION 'ui_scale deve estar entre 0.95 e 1.05. Valor recebido: %', NEW.ui_scale;
  END IF;
  
  -- Validar ui_density
  IF NEW.ui_density NOT IN ('compact', 'normal', 'comfortable') THEN
    RAISE EXCEPTION 'ui_density invalido: %. Valores permitidos: compact, normal, comfortable', NEW.ui_density;
  END IF;
  
  -- Validar accent
  IF NEW.accent NOT IN ('gold', 'silver', 'blue') THEN
    RAISE EXCEPTION 'accent invalido: %. Valores permitidos: gold, silver, blue', NEW.accent;
  END IF;
  
  -- Validar sidebar_logo_scale (0.90 a 1.15)
  IF NEW.sidebar_logo_scale < 0.90 OR NEW.sidebar_logo_scale > 1.15 THEN
    RAISE EXCEPTION 'sidebar_logo_scale deve estar entre 0.90 e 1.15. Valor recebido: %', NEW.sidebar_logo_scale;
  END IF;
  
  -- Auto-atualizar campos de auditoria
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_office_ui_settings
  BEFORE INSERT OR UPDATE ON public.office_ui_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_office_ui_settings();

-- Trigger para auto-criar settings quando office eh criado
CREATE OR REPLACE FUNCTION public.auto_create_office_ui_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.office_ui_settings (office_id)
  VALUES (NEW.id)
  ON CONFLICT (office_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_office_ui_settings
  AFTER INSERT ON public.offices
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_office_ui_settings();

-- Inicializar settings para offices existentes
INSERT INTO public.office_ui_settings (office_id)
SELECT id FROM public.offices
ON CONFLICT (office_id) DO NOTHING;

-- Habilitar RLS
ALTER TABLE public.office_ui_settings ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: membros do office podem visualizar
CREATE POLICY "Members can view office_ui_settings"
  ON public.office_ui_settings
  FOR SELECT
  TO authenticated
  USING (public.is_office_member(office_id));

-- Policy INSERT: apenas owner/admin
CREATE POLICY "Admins can insert office_ui_settings"
  ON public.office_ui_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_office_admin(office_id));

-- Policy UPDATE: apenas owner/admin
CREATE POLICY "Admins can update office_ui_settings"
  ON public.office_ui_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_office_admin(office_id))
  WITH CHECK (public.is_office_admin(office_id));

-- Policy DELETE: apenas owner/admin
CREATE POLICY "Admins can delete office_ui_settings"
  ON public.office_ui_settings
  FOR DELETE
  TO authenticated
  USING (public.is_office_admin(office_id));

-- RPC para carregar settings
CREATE OR REPLACE FUNCTION public.get_office_ui_settings(p_office_id uuid)
RETURNS TABLE (
  office_id uuid,
  ui_font text,
  ui_scale numeric,
  ui_density text,
  accent text,
  sidebar_logo_scale numeric,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    ous.office_id,
    ous.ui_font,
    ous.ui_scale,
    ous.ui_density,
    ous.accent,
    ous.sidebar_logo_scale,
    ous.updated_at
  FROM public.office_ui_settings ous
  WHERE ous.office_id = p_office_id
  LIMIT 1;
$$;

-- Grant execute na RPC
GRANT EXECUTE ON FUNCTION public.get_office_ui_settings(uuid) TO authenticated;