-- =============================================
-- PARTE 1: Limpeza de templates duplicados inativos
-- =============================================

-- Excluir templates inativos duplicados do escritório
-- (mantém apenas as versões ativas)
DELETE FROM public.document_templates
WHERE id IN (
    SELECT dt.id
    FROM public.document_templates dt
    WHERE dt.office_id IS NOT NULL
      AND dt.is_active = false
      AND EXISTS (
          -- Existe uma versão ativa com o mesmo código no mesmo escritório
          SELECT 1 FROM public.document_templates active
          WHERE active.office_id = dt.office_id
            AND active.code = dt.code
            AND active.is_active = true
      )
);

-- =============================================
-- PARTE 2: Ativar template global PROC se estiver inativo
-- =============================================
UPDATE public.document_templates
SET is_active = true
WHERE code = 'PROC'
  AND office_id IS NULL
  AND is_active = false;

-- =============================================
-- PARTE 3: Padronizar categoria para KIT_INICIAL
-- =============================================
UPDATE public.document_templates
SET category = 'KIT_INICIAL'
WHERE code IN ('PROC', 'DECL', 'CONTRATO')
  AND category != 'KIT_INICIAL';

-- =============================================
-- PARTE 4: Corrigir função clone_global_templates_to_my_office
-- =============================================
CREATE OR REPLACE FUNCTION public.clone_global_templates_to_my_office()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_office_id uuid;
    v_count integer := 0;
BEGIN
    -- Obter office_id do usuário atual
    SELECT office_id INTO v_office_id
    FROM public.office_members
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF v_office_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não pertence a nenhum escritório';
    END IF;

    -- Clonar templates globais ATIVOS que ainda não existem no escritório
    -- Verifica por código (não por nome, pois nome pode ser alterado)
    INSERT INTO public.document_templates (
        name,
        category,
        html_content,
        is_active,
        is_default,
        office_id,
        code,
        template_vars
    )
    SELECT
        dt.name,
        dt.category,
        dt.html_content,
        true, -- sempre ativo ao clonar
        false, -- não é default no escritório
        v_office_id,
        dt.code,
        dt.template_vars
    FROM public.document_templates dt
    WHERE dt.is_default = true
      AND dt.is_active = true  -- CORREÇÃO: apenas templates ativos
      AND dt.office_id IS NULL
      AND dt.code IS NOT NULL
      -- CORREÇÃO: verifica se já existe no escritório (ativo OU inativo)
      AND NOT EXISTS (
          SELECT 1 FROM public.document_templates ot
          WHERE ot.office_id = v_office_id
            AND ot.code = dt.code
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN v_count;
END;
$$;

-- Garantir permissão
GRANT EXECUTE ON FUNCTION public.clone_global_templates_to_my_office() TO authenticated;