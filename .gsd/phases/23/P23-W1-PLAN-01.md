---
phase: 23
plan: 1
wave: 1
gap_closure: false
---

# P23-W1-PLAN-01: SaaS Database Infrastructure

Implementar as tabelas de integração de faturamento e logs de auditoria para suporte multi-tenant.

## Tasks

- [x] Criar migração SQL `20260408180000_saas_platform_integrations.sql`
  - [x] Tabela `office_billing_integrations` com suporte a versionamento (`is_active`, `rotated_from_id`)
  - [x] Tabela `office_billing_usage_logs` para auditoria de credenciais
  - [x] Índices de performance para busca por `asaas_account_id` e `is_active`
- [ ] Implementar Políticas RLS
  - [ ] Restrição de leitura/escrita apenas para `OWNER` e `ADMIN`
  - [ ] Proteção estrita do campo `encrypted_api_key`
- [ ] Aplicar migração no Supabase local/remoto

## Verify
- [ ] Verificar existência das tabelas no banco: `SELECT * FROM information_schema.tables WHERE table_name IN ('office_billing_integrations', 'office_billing_usage_logs');`
- [ ] Validar RLS tentando ler integração de outro tenant com usuário comum.
