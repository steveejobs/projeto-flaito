# Escavador Integration Contract (v2)

## 1. Endpoints Utilizados
O produto utiliza a API v2 do Escavador para consultas processuais e de envolvidos.

| Endpoint | Versão | Método | Sincronia | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `/processos/numero/{numero}` | v2 | GET | Síncrono | Busca detalhes de um processo pelo número CNJ. |
| `/envolvidos/documento/{doc}` | v2 | GET | Síncrono | Busca processos vinculados a um CPF ou CNPJ. |
| `/envolvidos/nome/{nome}` | v2 | GET | Síncrono | Busca processos vinculados a um nome (URL Encoded). |
| `/busca-assincrona` | v2 | POST | Assíncrono | Dispara uma busca profunda por termo (Nome, OAB, Doc). |
| `/busca-assincrona/{id}` | v2 | GET | Síncrono | Consulta o status/resultado de uma busca assíncrona. |
| `/tribunais/busca-assincrona`| v2 | POST | Assíncrono | Busca direta em tribunais específicos. |
| `/monitoramentos` | v2 | GET/POST| Síncrono | Lista ou cria monitoramentos de termos/processos. |
| `/saldo` | v2 | GET | Síncrono | Consulta o saldo de créditos disponível. |

---

## 2. Autenticação e Headers
- **Tipo:** Bearer Token
- **Header:** `Authorization: Bearer {ESCAVADOR_API_TOKEN}`
- **Accept:** `application/json`

---

## 3. Estruturas de Dados (Shapes)

### 3.1. Resposta de Processo (Simplificado)
```json
{
  "processo": {
    "numero_cnj": "string",
    "tribunal": { "sigla": "string", "nome": "string" },
    "capa": { "classe": "string", "assunto": "string", "valor_causa": "number" },
    "envolvidos": [
      {
        "nome": "string",
        "tipo_normalizado": "string",
        "cpf_cnpj": "string",
        "advogados": [{ "nome": "string", "oab": "string" }]
      }
    ],
    "movimentacoes": [
      { "data": "YYYY-MM-DD", "titulo": "string", "texto": "string" }
    ]
  }
}
```

### 3.2. Fluxo Assíncrono
1. **Request (POST):** Retorna um `search_id`.
2. **Polling (GET):** Retorna status `PENDING`, `PROCESSING` ou `COMPLETED`.
3. **Resultado:** Quando `COMPLETED`, o campo `data` contém a lista de processos ou envolvidos encontrados.

---

## 4. Boundary de Serviço (Zod Validation)
A validação de runtime é realizada na camada de transformação (`escavador-transformer.ts`) e garantida pelo `EscavadorClient`.

---

## 5. Regras de Governança
1. **Cache:** Resultados de processos (`/processos/numero/{numero}`) devem ser cacheados por no mínimo 7 dias para evitar consumo excessivo.
2. **CNJ:** Todo número de processo deve ser validado/normalizado via `normalizeCNJ` antes da chamada.
3. **SRE:** Todas as chamadas devem usar `resilientFetch` com retry exponencial e timeout de 30s.
4. **Token Optimization:** Ao enviar dados para LLMs (Athena), usar o `normalizeEscavadorProcess` para reduzir o payload para o essencial.

---

## 6. Prova de Conformidade (Smoke Test)
Um smoke test automatizado (`scripts/smoke_escavador.ts`) valida o endpoint `/saldo` para garantir que o token e a conectividade estão operacionais.
