-- ============================================================
-- MILSTONE: INSTITUTIONAL DOCUMENT ENGINE & GOVERNANCE
-- PHASE 1: SCHEMA FOUNDATION & VERSIONING (v3 Compliant)
-- ============================================================

-- 0. FOUNDATION: Ensure core tables exist for fresh bootstrap
CREATE TABLE IF NOT EXISTS public.document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    content TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.generated_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    client_id UUID,
    case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id),
    title TEXT,
    content_html TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 1. ENHANCE document_templates
ALTER TABLE public.document_templates 
ADD COLUMN IF NOT EXISTS code text,
ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS vertical text DEFAULT 'LEGAL' CHECK (vertical IN ('LEGAL', 'MEDICAL', 'BOTH')),
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS ai_instructions text,
ADD COLUMN IF NOT EXISTS active_version_id uuid;

-- Backfill codes for existing templates
UPDATE public.document_templates SET code = UPPER(REPLACE(name, ' ', '_')) WHERE code IS NULL;

-- 2. CREATE document_template_versions
CREATE TABLE IF NOT EXISTS public.document_template_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
    version_number int NOT NULL,
    content_html text NOT NULL,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    change_log text,
    created_at timestamptz DEFAULT now(),
    published_at timestamptz,
    created_by uuid REFERENCES auth.users(id),
    
    UNIQUE (template_id, version_number)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON public.document_template_versions(template_id);

-- 3. CREATE document_variables (The Catalog)
CREATE TABLE IF NOT EXISTS public.document_variables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE, -- NULL for system variables
    key text NOT NULL,
    label text NOT NULL,
    type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'long_text', 'number', 'date', 'currency', 'boolean', 'enum')),
    source_type text NOT NULL CHECK (source_type IN ('system', 'manual', 'ai', 'office_custom')),
    vertical text NOT NULL DEFAULT 'BOTH' CHECK (vertical IN ('LEGAL', 'MEDICAL', 'BOTH')),
    category text DEFAULT 'Geral',
    required boolean DEFAULT false,
    default_value text,
    help_text text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    
    UNIQUE (office_id, key)
);

-- 4. ENHANCE generated_docs (Audit & Snapshots)
ALTER TABLE public.generated_docs
ADD COLUMN IF NOT EXISTS template_version_id uuid REFERENCES public.document_template_versions(id),
ADD COLUMN IF NOT EXISTS generation_mode text DEFAULT 'system' CHECK (generation_mode IN ('system', 'manual', 'ai_assisted')),
ADD COLUMN IF NOT EXISTS used_variables jsonb DEFAULT '{}'::jsonb;

-- 5. SEED SYSTEM VARIABLES (Canonical Catalog)
INSERT INTO public.document_variables (key, label, type, source_type, vertical, category, required, help_text)
VALUES 
    ('client.full_name', 'Nome Completo do Cliente', 'text', 'system', 'BOTH', 'Cliente', true, 'Nome completo conforme cadastro.'),
    ('client.cpf', 'CPF do Cliente', 'text', 'system', 'BOTH', 'Cliente', false, 'CPF formatado.'),
    ('client.email', 'E-mail do Cliente', 'text', 'system', 'BOTH', 'Cliente', false, 'E-mail principal.'),
    ('case.cnj_number', 'Número do Processo', 'text', 'system', 'LEGAL', 'Processo', false, 'Número único do CNJ.'),
    ('office.name', 'Nome do Escritório', 'text', 'system', 'BOTH', 'Escritório', true, 'Nome institucional da unidade.'),
    ('user.name', 'Nome do Profissional', 'text', 'system', 'BOTH', 'Usuário', true, 'Nome do usuário que está gerando o documento.')
ON CONFLICT (office_id, key) DO NOTHING;

-- 6. RLS POLICIES
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_docs ENABLE ROW LEVEL SECURITY;

-- Policy for templates
DROP POLICY IF EXISTS "Templates visíveis por escritório ou sistema" ON public.document_templates;
CREATE POLICY "Templates visíveis por escritório ou sistema" ON public.document_templates
FOR SELECT USING (
    office_id IS NULL OR 
    EXISTS (SELECT 1 FROM public.office_members WHERE office_id = document_templates.office_id AND user_id = auth.uid())
);

-- Policy for versions
DROP POLICY IF EXISTS "Allow read versions for office members" ON public.document_template_versions;
CREATE POLICY "Allow read versions for office members" ON public.document_template_versions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.document_templates dt
        LEFT JOIN public.office_members om ON om.office_id = dt.office_id
        WHERE dt.id = document_template_versions.template_id
        AND (dt.office_id IS NULL OR om.user_id = auth.uid())
    )
);

-- Policy for variables
DROP POLICY IF EXISTS "Allow read variables for office members" ON public.document_variables;
CREATE POLICY "Allow read variables for office members" ON public.document_variables
FOR SELECT USING (
    office_id IS NULL OR 
    EXISTS (SELECT 1 FROM public.office_members WHERE office_id = document_variables.office_id AND user_id = auth.uid())
);

-- Policy for generated docs
DROP POLICY IF EXISTS "Documentos gerados restritos ao escritório" ON public.generated_docs;
CREATE POLICY "Documentos gerados restritos ao escritório" ON public.generated_docs
FOR ALL USING (
    office_id IS NULL OR 
    EXISTS (SELECT 1 FROM public.office_members WHERE office_id = generated_docs.office_id AND user_id = auth.uid())
);

-- 7. FUNCTIONS
-- 7.1 Automatic Version Incrementor
CREATE OR REPLACE FUNCTION public.increment_template_version()
RETURNS TRIGGER AS $$
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 
    INTO NEW.version_number
    FROM public.document_template_versions
    WHERE template_id = NEW.template_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_template_version ON public.document_template_versions;
CREATE TRIGGER trg_increment_template_version
BEFORE INSERT ON public.document_template_versions
FOR EACH ROW EXECUTE FUNCTION public.increment_template_version();

-- 7.2 THE CORE ENGINE: render_template_preview_raw
CREATE OR REPLACE FUNCTION public.render_template_preview_raw(
  p_content text, 
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_content text := p_content;
  v_value text;
  v_cond_value text;
  r record;
  v_var_regex text;
BEGIN
  IF v_content IS NULL THEN
    RETURN NULL;
  END IF;

  -- Conditional Blocks {{#if var}}...{{/if}}
  FOR r IN SELECT DISTINCT (regexp_matches(v_content, '\{\{#if\s+([a-zA-Z0-9._[\]]+)\s*\}\}', 'gi'))[1] as cond_name
  LOOP
    BEGIN
      v_cond_value := jsonb_extract_path_text(p_data, variadic string_to_array(r.cond_name, '.'));
    EXCEPTION WHEN OTHERS THEN
      v_cond_value := NULL;
    END;
    
    IF v_cond_value IS NULL OR v_cond_value = '' OR v_cond_value = 'null' OR v_cond_value = 'false' OR v_cond_value = '[]' OR v_cond_value = '{}' THEN
      v_content := regexp_replace(v_content, '\{\{#if\s+' || regexp_replace(r.cond_name, '([.[\]])', '\\\1', 'g') || '\s*\}\}.*?\{\{/if\}\}', '', 'gis');
    ELSE
      v_content := regexp_replace(v_content, '\{\{#if\s+' || regexp_replace(r.cond_name, '([.[\]])', '\\\1', 'g') || '\s*\}\}', '', 'gi');
    END IF;
  END LOOP;
  v_content := regexp_replace(v_content, '\{\{/if\}\}', '', 'gi');

  -- Variable Substitution
  FOR r IN SELECT DISTINCT (regexp_matches(v_content, '\{\{\{?\s*([a-zA-Z0-9._[\]]+)\s*\}?\}\}', 'g'))[1] as var_name
  LOOP
    BEGIN
      v_value := jsonb_extract_path_text(p_data, variadic string_to_array(r.var_name, '.'));
    EXCEPTION WHEN OTHERS THEN
      v_value := NULL;
    END;
    v_value := COALESCE(v_value, '');
    v_var_regex := regexp_replace(r.var_name, '([.[\]])', '\\\1', 'g');
    
    v_content := regexp_replace(v_content, '\{\{\{\s*' || v_var_regex || '\s*\}\}\}', replace(replace(v_value, '\', '\\'), E'\n', '<br>'), 'gi');
    v_content := regexp_replace(v_content, '\{\{\s*' || v_var_regex || '\s*\}\}', replace(replace(v_value, '\', '\\'), E'\n', '<br>'), 'gi');
  END LOOP;

  -- Final Cleanup
  v_content := regexp_replace(v_content, '\{\{\{[^}]+\}\}\}', '', 'g');
  v_content := regexp_replace(v_content, '\{\{#if\s+[^}]+\}\}', '', 'gi');
  v_content := regexp_replace(v_content, '\{\{/if\}\}', '', 'gi');
  v_content := regexp_replace(v_content, '\{\{[^}]+\}\}', '', 'g');

  RETURN v_content;
END;
$$;

GRANT EXECUTE ON FUNCTION public.render_template_preview_raw(text, jsonb) TO authenticated, service_role;
