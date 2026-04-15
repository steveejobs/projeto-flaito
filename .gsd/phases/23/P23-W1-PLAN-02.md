---
phase: 23
plan: 2
wave: 1
gap_closure: false
---

# P23-W1-PLAN-02: Cryptography & Resolver Infrastructure

Implementar helpers compartilhados para segurança de chaves e resolução dinâmica de contexto de billing.

## Tasks

- [x] Criar `supabase/functions/_shared/crypto.ts`
  - [x] Implementar `encrypt(text)` e `decrypt(text)` usando AES-GCM e `VAULT_PLATFORM_KEY`
- [x] Criar `supabase/functions/_shared/billing-resolver.ts`
  - [x] Implementar `resolveBillingClient(officeId, context)`
  - [x] Implementar `logBillingUsage(params)` integrado à nova tabela de auditoria
- [ ] Refatorar `_shared/auth.ts` se necessário para prover contexto facilitado para o resolver

## Verify
- [ ] Testar `encrypt` / `decrypt` com strings de teste via script Deno local.
- [ ] Validar que `resolveBillingClient` lança erro correto ao tentar usar `OPERATIONAL` context sem integração ativa.
