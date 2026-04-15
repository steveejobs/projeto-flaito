# Summary: Fix Risco de RAG Fantasma (Legal) e Guardrails

## Completed Tasks

- **Add Revisão Humana Exigida alert**
  - Added a strict warning alert to `src/components/NijaAutoPetitionButton.tsx` dialog to ensure the user knows the AI-generated content needs human verification.
- **Improve RAG implementation**
  - Included strict anti-hallucination guardrails in the prompt of `supabase/functions/nija-generate-piece/index.ts`, heavily discouraging inventing citations and requiring placeholders instead.

## Verification
- Checked UI components for the required alerts.
- Confirmed the system prompt now enforces guardrails against hallucinations.
