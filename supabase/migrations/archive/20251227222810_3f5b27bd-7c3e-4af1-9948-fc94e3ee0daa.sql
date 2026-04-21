-- =====================================================
-- 1) VIEW: KPIs gerais
-- =====================================================
CREATE OR REPLACE VIEW public.vw_financial_kpis AS
SELECT
  -- totais
  SUM(CASE WHEN status IN ('CONFIRMED'::asaas_payment_status, 'RECEIVED'::asaas_payment_status) THEN value ELSE 0 END) AS total_paid,
  SUM(CASE WHEN status = 'PENDING'::asaas_payment_status THEN value ELSE 0 END) AS total_pending,
  SUM(CASE WHEN status = 'OVERDUE'::asaas_payment_status THEN value ELSE 0 END) AS total_overdue,
  SUM(CASE WHEN status IN ('CANCELED'::asaas_payment_status, 'REFUNDED'::asaas_payment_status) THEN value ELSE 0 END) AS total_canceled,

  -- contagens
  COUNT(*) AS total_charges,
  COUNT(*) FILTER (WHERE status IN ('CONFIRMED'::asaas_payment_status, 'RECEIVED'::asaas_payment_status)) AS paid_charges,

  -- métricas
  AVG(value) FILTER (WHERE status IN ('CONFIRMED'::asaas_payment_status, 'RECEIVED'::asaas_payment_status)) AS ticket_medio,

  -- taxa de conversão
  CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(
      (COUNT(*) FILTER (WHERE status IN ('CONFIRMED'::asaas_payment_status, 'RECEIVED'::asaas_payment_status))::numeric
      / COUNT(*)::numeric) * 100, 2
    )
  END AS conversion_rate_percent
FROM public.asaas_payments;

-- =====================================================
-- 2) VIEW: Faturamento mensal (últimos 12 meses)
-- =====================================================
CREATE OR REPLACE VIEW public.vw_financial_monthly AS
SELECT
  date_trunc('month', COALESCE(paid_at, created_at)) AS month,
  SUM(value) FILTER (WHERE status IN ('CONFIRMED'::asaas_payment_status, 'RECEIVED'::asaas_payment_status)) AS total_paid,
  SUM(value) FILTER (WHERE status = 'PENDING'::asaas_payment_status) AS total_pending,
  SUM(value) FILTER (WHERE status = 'OVERDUE'::asaas_payment_status) AS total_overdue,
  COUNT(*) AS total_charges
FROM public.asaas_payments
WHERE created_at >= now() - interval '12 months'
GROUP BY 1
ORDER BY 1 DESC;

-- =====================================================
-- 3) RPC: KPIs gerais (para dashboard)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_financial_kpis()
RETURNS TABLE (
  total_paid numeric,
  total_pending numeric,
  total_overdue numeric,
  total_canceled numeric,
  total_charges bigint,
  paid_charges bigint,
  ticket_medio numeric,
  conversion_rate_percent numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    total_paid,
    total_pending,
    total_overdue,
    total_canceled,
    total_charges,
    paid_charges,
    ticket_medio,
    conversion_rate_percent
  FROM public.vw_financial_kpis;
$$;

-- =====================================================
-- 4) RPC: Faturamento mensal (gráfico)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_financial_monthly()
RETURNS SETOF public.vw_financial_monthly
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.vw_financial_monthly
  ORDER BY month DESC;
$$;