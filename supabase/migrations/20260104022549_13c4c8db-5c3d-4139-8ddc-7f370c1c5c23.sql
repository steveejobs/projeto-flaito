DROP POLICY IF EXISTS client_contract_terms_structural_select ON public.client_contract_terms;

CREATE POLICY client_contract_terms_structural_select
ON public.client_contract_terms
AS PERMISSIVE
FOR SELECT
TO public
USING (true);