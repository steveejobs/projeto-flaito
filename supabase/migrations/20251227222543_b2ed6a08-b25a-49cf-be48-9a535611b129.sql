DO $$
BEGIN
  -- 1) Helper: verifica se o caso está pago
  CREATE OR REPLACE FUNCTION public.is_case_paid(p_case_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = public
  AS $f$
    SELECT EXISTS (
      SELECT 1
      FROM public.asaas_payments
      WHERE case_id = p_case_id
        AND status IN ('CONFIRMED'::asaas_payment_status, 'RECEIVED'::asaas_payment_status)
    );
  $f$;

  -- 2) AGENDA — bloqueia INSERT sem pagamento
  IF to_regclass('public.agenda_items') IS NOT NULL THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS p_agenda_require_payment ON public.agenda_items';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    EXECUTE $p$
      CREATE POLICY p_agenda_require_payment
      ON public.agenda_items
      FOR INSERT
      WITH CHECK (
        case_id IS NULL OR public.is_case_paid(case_id)
      );
    $p$;
  END IF;

  -- 3) DOCUMENTOS GERADOS — bloqueia INSERT sem pagamento (tabela correta: generated_documents)
  IF to_regclass('public.generated_documents') IS NOT NULL THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS p_docs_require_payment ON public.generated_documents';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    EXECUTE $p$
      CREATE POLICY p_docs_require_payment
      ON public.generated_documents
      FOR INSERT
      WITH CHECK (
        case_id IS NULL OR public.is_case_paid(case_id)
      );
    $p$;
  END IF;

END$$;