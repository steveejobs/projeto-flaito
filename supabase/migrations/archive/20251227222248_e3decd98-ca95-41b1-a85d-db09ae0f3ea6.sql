-- Helper function para verificar se case está pago
CREATE OR REPLACE FUNCTION public.is_case_paid(p_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asaas_payments
    WHERE case_id = p_case_id
      AND status IN ('CONFIRMED'::asaas_payment_status, 'RECEIVED'::asaas_payment_status)
  );
$$;

-- Policy para agenda_items: bloquear INSERT quando pagamento não confirmado
DROP POLICY IF EXISTS p_agenda_require_payment ON public.agenda_items;

CREATE POLICY p_agenda_require_payment
ON public.agenda_items
FOR INSERT
WITH CHECK (
  case_id IS NULL OR public.is_case_paid(case_id)
);

-- Policy para generated_documents: bloquear INSERT quando pagamento não confirmado
DROP POLICY IF EXISTS p_docs_require_payment ON public.generated_documents;

CREATE POLICY p_docs_require_payment
ON public.generated_documents
FOR INSERT
WITH CHECK (
  case_id IS NULL OR public.is_case_paid(case_id)
);