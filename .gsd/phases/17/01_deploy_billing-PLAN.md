---
phase: 17
name: Infraestrutura de Billing & Asaas
objective: Implantar a base de dados de faturamento e as Edge Functions vinculadas ao Asaas.
---

# PLAN: Infraestrutura de Billing

## Wave 1: Autenticação e Vínculo
### Task 1.1: Login no Supabase CLI
- **Comando**: `npx supabase login`
- **Verificação**: O CLI deve exibir a mensagem informando que está logado ou aceitar o token.

### Task 1.2: Linkar ao projeto
- **Comando**: `npx supabase link --project-ref ccvbosbjtlxewqybvwqj`
- **Verificação**: Arquivo `.supabase/project-ref` (ou similar) atualizado.

## Wave 2: Banco de Dados
### Task 2.1: Push das Migrations
- **Comando**: `npx supabase db push`
- **Verificação**: Mensagem "Total migrations pushed: 2" (ou similar).

## Wave 3: Edge Functions
### Task 3.1: Deploy billing-generate
- **Comando**: `npx supabase functions deploy billing-generate`
### Task 3.2: Deploy billing-approve
- **Comando**: `npx supabase functions deploy billing-approve`
### Task 3.3: Deploy asaas-create-payment
- **Comando**: `npx supabase functions deploy asaas-create-payment`

## Wave 4: Verificação (Smoke Tests)
### Task 4.1: Testes de fumaça (CURL)
- **Comando**: Executar os 3 comandos CURL fornecidos no manual.
- **Verificação**: Status HTTP 401 Unauthorized para todos.
