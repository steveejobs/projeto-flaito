# ARCHITECTURE - Projeto Flaito

Documentação da arquitetura técnica do sistema Flaito.

## Visão Geral
O Flaito é uma plataforma multi-inquilino (multi-tenant) baseada em uma arquitetura de microsserviços leves (Edge Functions) e um frontend unificado focado em fluxos específicos para medicina e advocacia.

## Fluxo de Mensagens & Notificações
O sistema de mensagens é composto por três partes principais:
1.  **Scheduler**: Agenda as mensagens baseada em gatilhos do sistema.
2.  **Worker**: Processa a fila de mensagens e as envia via Z-API.
3.  **Webhook Handler**: Recebe atualizações de status e mensagens recebidas.

## Estrutura de Pastas
- `/src`: Código fonte do frontend React.
- `/supabase`: Configurações do backend, migrations e Edge Functions.
- `/docs`: Documentação técnica adicional.

## Segurança & Multitenancy
- O isolamento de dados é garantido via RLS (Row Level Security) no Supabase, utilizando o `office_id` ou `client_id` como chaves mestras.
