# Integração Plaud → Zapier → LEXOS

Este documento descreve como configurar a integração entre o Plaud e o LEXOS usando o Zapier como intermediário.

## Visão Geral

```
[Plaud App] → [Zapier Trigger] → [Zapier Webhook Action] → [LEXOS Edge Function] → [Supabase DB] → [Plaud Inbox]
```

## 1. Obter o `office_id`

O `office_id` é o identificador único do seu escritório no LEXOS. Para encontrá-lo:

1. Acesse o LEXOS e vá para **Meu Escritório**
2. O `office_id` está na URL: `/meu-escritorio` (não visível diretamente)
3. Alternativamente, peça ao administrador do sistema para consultar a tabela `offices` no Supabase

**Formato:** UUID v4 (ex: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

## 2. URL do Endpoint

```
https://uxrakfbedmkiqhidruxx.functions.supabase.co/zapier-plaud?office_id=<OFFICE_UUID>
```

**Exemplo completo:**
```
https://uxrakfbedmkiqhidruxx.functions.supabase.co/zapier-plaud?office_id=13196431-0967-407c-ba93-8cadce4a51e1
```

---

## 3. Segurança: Token de Autenticação

**OBRIGATÓRIO:** O endpoint exige um token de autenticação para evitar acesso não autorizado.

### 3.1 Configurar o Secret no Supabase

1. Acesse o [Supabase Dashboard → Settings → Edge Functions](https://supabase.com/dashboard/project/uxrakfbedmkiqhidruxx/settings/functions)
2. Clique em **Add new secret**
3. Configure:
   - **Name:** `ZAPIER_PLAUD_TOKEN`
   - **Value:** Um token seguro (gere com `openssl rand -hex 32` ou similar)
4. Salve

### 3.2 Usar o Token no Zapier

No Zapier, ao configurar o Webhook, adicione o header:

| Header | Valor |
|--------|-------|
| `x-lexos-token` | `<SEU_ZAPIER_PLAUD_TOKEN>` |

**Sem este header, o endpoint retornará 401 Unauthorized.**

---

## 4. Configuração no Zapier

### Passo 1: Criar um novo Zap

1. Acesse [zapier.com](https://zapier.com) e clique em **Create Zap**

### Passo 2: Configurar o Trigger (Plaud)

1. Escolha **Plaud** como app de trigger
2. Selecione o evento **Transcript Ready** (ou similar)
3. Conecte sua conta Plaud
4. Teste o trigger para garantir que está funcionando

### Passo 3: Configurar a Action (Webhooks by Zapier)

1. Escolha **Webhooks by Zapier** como app de action
2. Selecione **POST** como evento
3. Configure os campos:

| Campo | Valor |
|-------|-------|
| **URL** | `https://uxrakfbedmkiqhidruxx.functions.supabase.co/zapier-plaud?office_id=SEU_OFFICE_ID` |
| **Payload Type** | `json` |
| **Headers** | `x-lexos-token: <SEU_TOKEN>` |
| **Data** | (ver mapeamento abaixo) |

### Passo 4: Mapear os campos

Configure o JSON body com os seguintes campos do Plaud:

```json
{
  "id": "{{id do Plaud}}",
  "title": "{{título da gravação}}",
  "transcript": "{{transcrição completa}}",
  "summary": "{{resumo/AI summary}}",
  "language": "{{idioma detectado}}",
  "created_at": "{{data/hora da gravação}}"
}
```

**Campos obrigatórios:**
- `id` (ou `recording_id`, `external_id`) — identificador único da gravação

**Campos opcionais mas recomendados:**
- `title` — título da gravação (fallback: "Plaud Recording")
- `transcript` (ou `text`) — texto completo da transcrição
- `summary` (ou `ai_summary`) — resumo gerado por IA
- `language` — código do idioma (ex: "pt-BR", "en-US")
- `created_at` (ou `timestamp`, `occurred_at`) — data/hora original

### Passo 5: Testar e Ativar

1. Clique em **Test step** para enviar um teste
2. Verifique se a resposta é `{"ok": true}`
3. Ative o Zap

---

## 5. Verificar no LEXOS

Após configurar o Zapier:

1. Acesse o LEXOS → **Sistema** → **Plaud Inbox**
2. Clique em **Atualizar** para recarregar a lista
3. As gravações do Plaud devem aparecer automaticamente
4. Use as abas para filtrar:
   - **Inbox** — novos itens não processados
   - **Meus** — itens atribuídos a você
   - **Todos** — todos os itens do escritório

---

## 6. Troubleshooting

### Erro 401: "Unauthorized"

**Causa:** Token ausente ou inválido no header `x-lexos-token`

**Solução:**
1. Verifique se o header `x-lexos-token` está configurado no Zapier
2. Confirme que o valor do token é idêntico ao secret `ZAPIER_PLAUD_TOKEN` no Supabase
3. Verifique se não há espaços extras no token

---

### Erro 400: "Missing required parameter: office_id"

**Causa:** A URL não contém o parâmetro `office_id`

**Solução:** Adicione `?office_id=SEU_UUID` ao final da URL

---

### Erro 400: "Invalid office_id format"

**Causa:** O `office_id` não é um UUID válido

**Solução:** Verifique se o UUID está no formato correto:
`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

---

### Erro 405: "Method not allowed"

**Causa:** O Zapier está usando GET em vez de POST

**Solução:** No Zapier, certifique-se de escolher **POST** no Webhooks by Zapier

---

### Erro 500: Erro de banco de dados

**Causa:** Problema ao gravar no Supabase

**Possíveis soluções:**
1. Verifique se o `office_id` existe na tabela `offices`
2. Verifique os logs da Edge Function no Supabase Dashboard
3. Confirme que as tabelas `plaud_assets` e `plaud_webhook_events` existem

---

### Resposta `{"ok": true, "duplicated": true}`

**Causa:** Este evento já foi processado anteriormente

**Ação:** Nenhuma necessária — o sistema evitou duplicação automaticamente

---

## 7. Campos do Payload Aceitos

O endpoint aceita qualquer JSON, mas procura especificamente por:

| Campo no payload | Usado para |
|------------------|------------|
| `id`, `recording_id`, `external_id`, `plaud_id` | Identificador único |
| `title`, `name` | Título da gravação |
| `transcript`, `text` | Transcrição completa |
| `summary`, `ai_summary` | Resumo |
| `language` | Idioma |
| `occurred_at`, `created_at`, `timestamp` | Data/hora original |

Todos os campos enviados são salvos no campo `raw` para referência futura.

---

## 8. Testes com cURL

### Teste SEM token (deve retornar 401)

```bash
curl -i -X POST "https://uxrakfbedmkiqhidruxx.functions.supabase.co/zapier-plaud?office_id=13196431-0967-407c-ba93-8cadce4a51e1" \
  -H "Content-Type: application/json" \
  -d '{"id":"test_001","title":"Teste","transcript":"ok"}'
```

**Resposta esperada:** `401 {"ok":false,"error":"Unauthorized"}`

### Teste COM token (deve retornar 200)

```bash
curl -i -X POST "https://uxrakfbedmkiqhidruxx.functions.supabase.co/zapier-plaud?office_id=13196431-0967-407c-ba93-8cadce4a51e1" \
  -H "Content-Type: application/json" \
  -H "x-lexos-token: SEU_TOKEN_AQUI" \
  -d '{"id":"test_001","title":"Teste","transcript":"ok"}'
```

**Resposta esperada:** `200 {"ok":true}`

---

## 9. Suporte

Em caso de problemas:
1. Verifique os logs do Zapier (Task History)
2. Verifique os logs da Edge Function no [Supabase Dashboard → Edge Functions → zapier-plaud → Logs](https://supabase.com/dashboard/project/uxrakfbedmkiqhidruxx/functions/zapier-plaud/logs)
3. Consulte a tabela `plaud_webhook_events` para ver eventos recebidos
