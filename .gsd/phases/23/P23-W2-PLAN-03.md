---
phase: 23
plan: 3
wave: 2
gap_closure: false
---

# P23-W2-PLAN-03: Multi-Tenant Billing Refactor

Refatorar as funções de cobrança e webhooks para utilizar o novo motor de resolução dinâmica e isolamento por conta.

## Tasks

- [x] Refatorar `supabase/functions/asaas-create-payment/index.ts`
  - [x] Importar `resolveBillingClient` e `logBillingUsage`
  - [x] Remover resolução manual de env keys
  - [x] Implementar tratamento de erro específico para integração ausente (Contexto: operational)
- [x] Refatorar `supabase/functions/asaas-webhook/index.ts`
  - [x] Implementar busca de `office_id` baseada no `account_id` recebido no payload do Asaas
  - [x] Validar `webhook_secret` específico do tenant
  - [x] Garantir isolamento total: falha se a conta não corresponder a um tenant ativo
- [x] Criar nova Edge Function `billing-validate-integration`
  - [x] Função para testar chave (PING Asaas) e marcar como `active`
  - [x] Atualizar status para `active` em caso de sucesso

## Verify
- [ ] Testar `create-payment` simulando um tenant com integração customizada.
- [ ] Validar erro 403/503 quando o tenant não tem integração ativa.
- [ ] Testar webhook com `account_id` inválido e verificar bloqueio.
