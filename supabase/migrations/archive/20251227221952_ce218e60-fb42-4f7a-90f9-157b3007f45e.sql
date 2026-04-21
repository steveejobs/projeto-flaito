-- VIEW para leitura otimizada de pagamentos por case
CREATE OR REPLACE VIEW public.vw_case_payments AS
SELECT
  id,
  case_id,
  client_id,
  value,
  billing_type,
  status,
  due_date,
  paid_at,
  invoice_url,
  boleto_url,
  pix_qr_code_base64,
  pix_payload,
  created_at
FROM public.asaas_payments
ORDER BY created_at DESC;

-- RPC para buscar pagamentos por case_id com RLS
CREATE OR REPLACE FUNCTION public.get_case_payments(p_case_id uuid)
RETURNS SETOF public.vw_case_payments
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT *
  FROM public.vw_case_payments
  WHERE case_id = p_case_id
  ORDER BY created_at DESC;
$$;

-- Habilitar Realtime para asaas_payments (INSERT/UPDATE)
ALTER PUBLICATION supabase_realtime ADD TABLE public.asaas_payments;