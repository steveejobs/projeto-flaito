# Módulo NIJA - Forensic Legal Extraction

O NIJA é o motor de extração e auditoria forense da Flaito, especializado em processar documentos judiciais (notadamente do sistema EPROC/TJTO) para identificação automática de eventos e criação de casos no CRM.

## 🏗️ Fluxo de Dados

O pipeline do NIJA segue as seguintes etapas:

1.  **Entrada:** Arquivo PDF (via Upload no Frontend).
2.  **Detecção de Estrutura:**
    - O `pdfBookmarkExtractor` tenta ler o sumário nativo do PDF.
    - Se falhar, o `lexos-extract-text` executa OCR/Extração via Edge Function.
3.  **Processamento de Texto:**
    - O conteúdo é normalizado via `normalizeJudicialText` em `patterns.ts`.
4.  **Extração de Metadados:**
    - Busca por `PÁGINA DE SEPARAÇÃO` (Regex `SEPARADOR_COMPLETO`).
    - Agrupamento de peças vinculadas aos eventos (`HEADER_LINHA` / `HEADER_BLOCO`).
5.  **Provisionamento:**
    - O `caseCreator.ts` utiliza os dados estruturados para criar o cliente e o caso no banco de dados via RPCs de segurança.

## ⚠️ Pontos Críticos

- **Regex Sensitivity:** Os padrões em `patterns.ts` são baseados em heurísticas para o tribunal de Tocantins (TJTO/EPROC). Mudanças nestes tribunais podem exigir ajustes no Regex.
- **Fail-Safe:** O motor foi projetado para degradar a precisão em caso de OCR ruidoso, mas nunca falhar silenciosamente ou quebrar a estrutura de dados.

## 🛠️ Manutenção e Segurança

- **Testes de Regressão:** Localizados em `src/nija/__tests__`. Sempre execute `npx vitest src/nija` antes de modificar padrões de Regex.
- **Backtracking:** Evite adicionar quantificadores aninhados ou gananciosos em `patterns.ts` sem auditoria, para prevenir travamentos com arquivos grandes.
- **Camada de Dados:** Operações de escrita no banco vindas do NIJA utilizam RPCs com `SECURITY DEFINER` para garantir bypass controlado do RLS.

---
**Versão:** 1.0 (Fechamento consolidado após Stage 14)
