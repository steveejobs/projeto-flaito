---
phase: 6
plan: 2
wave: 2
---

# Plan 6.2: RAG em Produção — Refatoração do nija-generate-piece

## Objetivo
Substituir a busca por keyword (`ilike`) no `nija-generate-piece` pela busca vetorial semântica com reranking e source tracking. A peça gerada passa a ter rastreabilidade de fontes.

## Contexto
- `supabase/functions/nija-generate-piece/index.ts` — arquivo principal a modificar
- `supabase/functions/_shared/` — adicionar helper de busca vetorial aqui
- `.gsd/phases/6/1-PLAN.md` — tabela `legal_chunks` já deve existir (wave 1)

## Tasks

<task type="auto">
  <name>Criar helper de busca vetorial em _shared</name>
  <files>supabase/functions/_shared/vectorSearch.ts</files>
  <action>
    Criar módulo TypeScript com função `searchLegalChunks`:

    ASSINATURA:
    ```
    searchLegalChunks(supabase, query: string, options: {
      ramo?: string,
      tipo?: string,
      topK?: number,       // default: 8
      minScore?: number    // default: 0.70
    }): Promise<LegalChunk[]>
    ```

    PROCESSAMENTO:
    1. Gerar embedding da query via LOVABLE_API_KEY:
       - URL: https://ai.gateway.lovable.dev/v1/embeddings
       - model: "text-embedding-3-small"
       - input: query string
    2. Chamar Supabase RPC `match_legal_chunks` (criar migration com a função abaixo)
    3. Filtrar por minScore (cosine similarity)
    4. Reranking: PRECEDENTE > TESE > TEMPLATE em caso de empate de score
    5. Retornar array de chunks com: chunk_text, score, document_id, metadata

    MIGRATION para função RPC (incluir no mesmo arquivo de migration):
    ```sql
    CREATE OR REPLACE FUNCTION match_legal_chunks(
      query_embedding vector(1536),
      match_threshold float DEFAULT 0.70,
      match_count int DEFAULT 8,
      filter_ramo text DEFAULT NULL
    )
    RETURNS TABLE (
      id uuid, document_id uuid, chunk_text text,
      metadata jsonb, similarity float
    )
    LANGUAGE plpgsql AS $$
    BEGIN
      RETURN QUERY
      SELECT lc.id, lc.document_id, lc.chunk_text, lc.metadata,
             1 - (lc.embedding <=> query_embedding) AS similarity
      FROM legal_chunks lc
      WHERE 1 - (lc.embedding <=> query_embedding) > match_threshold
        AND (filter_ramo IS NULL OR lc.metadata->>'ramo' ILIKE '%' || filter_ramo || '%')
      ORDER BY lc.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;
    ```

    NÃO: usar `<->` (L2 distance) — usar `<=>` (cosine distance) para texto
    NÃO: retornar chunks com score < 0.70 — ruído é pior que ausência
  </action>
  <verify>
    Testar via Supabase SQL: chamar match_legal_chunks com embedding fictício (array de 1536 zeros).
    Deve retornar 0 linhas (nenhum match real) sem erro.
  </verify>
  <done>
    - `vectorSearch.ts` criado em _shared
    - Migration com função RPC `match_legal_chunks` aplicada
    - Função retorna chunks ranqueados por similaridade cosine
  </done>
</task>

<task type="auto">
  <name>Refatorar nija-generate-piece para RAG vetorial</name>
  <files>supabase/functions/nija-generate-piece/index.ts</files>
  <action>
    Substituir o bloco "MVP RAG" (linhas ~332–392) pelo novo RAG vetorial:

    1. Importar `searchLegalChunks` de `../_shared/vectorSearch.ts`
    2. Construir query semântica: combinar ramo + tipo_peca + labels dos vícios + labels das estratégias
       Exemplo: "prescrição intercorrente cível execução contestação"
    3. Chamar `searchLegalChunks(supabase, queryStr, { ramo, topK: 8 })`
    4. Se chunks retornados > 0:
       - Formatar `internalDocsStr` com os chunks, incluindo: chunk_text + metadata.tipo + similarity score
       - Adicionar ao prompt: "Fontes: [lista de document_ids]" para source tracking
    5. Se chunks = 0: manter comportamento atual (aviso de ausência de base)

    MANTER: toda a lógica de agentConfig, fallback, guardrails, variableResolver
    NÃO: remover os guardrails de alucinação — eles são mais críticos que nunca com RAG
    NÃO: injetar chunks sem limite — máximo de 4000 chars de contexto RAG total
  </action>
  <verify>
    Deploy da função. Chamar com um caso real que tenha documentos indexados.
    Verificar nos logs: `[NIJA-PIECE] RAG V2: Found X chunks with avg similarity Y`
    Verificar que a peça gerada menciona teses alinhadas com os chunks retornados.
  </verify>
  <done>
    - `nija-generate-piece` usa busca vetorial em produção
    - Logs indicam chunks recuperados com score de similaridade
    - Peça gerada contém fundamentação alinhada ao banco interno
    - Fallback funcional quando banco está vazio
  </done>
</task>

## Success Criteria
- [ ] Helper `vectorSearch.ts` criado e funcional
- [ ] Função RPC `match_legal_chunks` deployada no Supabase
- [ ] `nija-generate-piece` usa RAG vetorial com logs de chunks recuperados
- [ ] Peça gerada alinhada às teses internas quando banco contém documentos relevantes
