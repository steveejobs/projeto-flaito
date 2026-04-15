# Summary: Fix Fallback Confuso de Identidade e RAG via ILIKE

## Completed Tasks

- **Consolidate test accounts script**
  - Created SQL migration `supabase/migrations/20260325141200_consolidate_clients.sql` to backfill `client_id` for patients safely.
- **Refactor variableResolver and webhook logic**
  - Updated `supabase/functions/whatsapp-webhook/index.ts` to strictly search `clients` table by `normalized_phone`.
  - Removed confusing fallback logic targeting `pacientes` and raw `telefone`.
  - Streamlined `_shared/variableResolver.ts` so table references correctly match `clients` or `pacientes` cleanly based on `client_id` without nested `else` guesswork.

## Verification
- Code successfully updated and lint errors fixed. Logic strictly relies on unified `client_id`.
