---
phase: 6
plan: 1
wave: 1
---

# Plan 6.1: RAG Vetorial — Infraestrutura e Indexação

## Objetivo
Habilitar busca semântica por embeddings no banco jurídico do Flaito, substituindo a busca por keyword (ilike) por recuperação vetorial com reranking. Esta é a fundação do RAG Avançado.

## Contexto
- `supabase/migrations/` — histórico de migrations
- `supabase/functions/nija-generate-piece/index.ts` — RAG MVP atual (ilike)
- `supabase/functions/_shared/` — shared utilities

## Tasks

<task type="auto">
  <name>Habilitar pgvector e criar tabela legal_chunks</name>
  <files>supabase/migrations/[timestamp]_legal_chunks_vector.sql</files>
  <action>
    Criar migration SQL que:
    1. Habilita extensão: `CREATE EXTENSION IF NOT EXISTS vector;`
    2. Cria tabela `legal_chunks`:
       - id uuid PRIMARY KEY DEFAULT gen_random_uuid()
       - document_id uuid REFERENCES legal_documents(id) ON DELETE CASCADE
       - chunk_index integer NOT NULL
       - chunk_text text NOT NULL
       - embedding vector(1536)
       - metadata jsonb DEFAULT '{}' (tipo, ramo, tribunal, data_decisao, score_relevancia)
       - created_at timestamptz DEFAULT now()
    3. Cria índice HNSW: `CREATE INDEX ON legal_chunks USING hnsw (embedding vector_cosine_ops);`
    4. Habilita RLS: `ALTER TABLE legal_chunks ENABLE ROW LEVEL SECURITY;`
    5. Policy de leitura para usuários autenticados (SELECT via office_id no metadata)

    NÃO: criar índice ivfflat (inferior ao HNSW para este caso de uso)
    NÃO: usar vector(3072) — custo 2x sem ganho real para texto jurídico curto
  </action>
  <verify>
    Execute no Supabase: `SELECT * FROM pg_extension WHERE extname = 'vector';`
    Deve retornar 1 linha. Verificar também: `\d legal_chunks`
  </verify>
  <done>
    - Extension vector instalada
    - Tabela legal_chunks criada com coluna embedding vector(1536)
    - Índice HNSW ativo
    - RLS habilitado
  </done>
</task>

<task type="auto">
  <name>Criar Edge Function nija-embed-chunks</name>
  <files>supabase/functions/nija-embed-chunks/index.ts</files>
  <action>
    Criar Edge Function que indexa documentos do legal_documents em chunks semânticos:

    ENTRADA: { document_id?: string, force_reindex?: boolean }
    - Se document_id informado: reindexar apenas aquele documento
    - Se não informado: indexar todos os documentos sem chunks (batch)

    PROCESSAMENTO:
    1. Buscar document(s) de legal_documents (title, content, type, ramo)
    2. Chunking: dividir content em chunks de ~500 tokens com overlap de 50 tokens
       - Estratégia: dividir por parágrafos primeiro; se chunk > 600 chars, dividir por sentença
    3. Para cada chunk: chamar OpenAI text-embedding-3-small
       - URL: https://ai.gateway.lovable.dev/v1/embeddings
       - model: "text-embedding-3-small"
       - input: "[TIPO: {type}] [RAMO: {ramo}]\n\n{chunk_text}"  (prefixo melhora precisão)
    4. Upsert em legal_chunks (chunk_index, embedding, metadata)
    5. Retornar: { indexed: N, document_id, chunks_created: M }

    USAR: SUPABASE_SERVICE_ROLE_KEY (não anon) para escrever na tabela
    NÃO: indexar chunks vazios ou com menos de 50 chars
    NÃO: chamar OpenAI para chunks já indexados (checar se embedding IS NOT NULL)
  </action>
  <verify>
    Chamar a função com um document_id real. Verificar:
    `SELECT count(*) FROM legal_chunks WHERE document_id = '[uuid]';`
    Deve retornar > 0.
  </verify>
  <done>
    - Edge Function deployada e funcional
    - Documentos existentes indexados (pelo menos 5)
    - Embeddings não-nulos na tabela legal_chunks
  </done>
</task>

## Success Criteria
- [ ] `pgvector` habilitado no Supabase do projeto
- [ ] Tabela `legal_chunks` criada com índice HNSW ativo
- [ ] Edge Function `nija-embed-chunks` indexa documentos com sucesso
- [ ] Pelo menos 5 documentos jurídicos indexados com embeddings válidos
