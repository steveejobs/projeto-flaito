---
phase: 7
plan: 1
wave: 1
---

# Plan 7.1: Extração Atômica por Documento (Nija V2)

## Objetivo
Implementar a infraestrutura de extração estruturada de documentos individuais, permitindo o processamento paralelo e o cache das informações em um formato canônico jurídico.

## Contexto
- `supabase/functions/lexos-extract-text/index.ts` — extração de texto
- `supabase/migrations/` — local para nova tabela
- Dossier SPEC — Etapa 1 (Extração por Documento)

## Tasks

<task type="auto">
  <name>Criar infra de cache nija_doc_extractions</name>
  <files>supabase/migrations/20260403170000_nija_doc_extractions.sql</files>
  <action>
    Criar tabela para cache de extrações detalhadas por arquivo.
    
    SQL Schema:
    ```sql
    CREATE TABLE nija_doc_extractions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
      case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
      office_id uuid REFERENCES offices(id),
      file_hash text, -- Para evitar re-extração se o arquivo for o mesmo
      tipo_documento text,
      extraction_json jsonb NOT NULL, -- O JSON da Etapa 1
      confidence_score float,
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE nija_doc_extractions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "office_isolation" ON nija_doc_extractions
      USING (office_id = (SELECT office_id FROM profiles WHERE id = auth.uid()));
    CREATE INDEX ON nija_doc_extractions(document_id);
    CREATE INDEX ON nija_doc_extractions(case_id);
    ```
  </action>
  <verify>
    SELECT table_name FROM information_schema.tables WHERE table_name = 'nija_doc_extractions';
  </verify>
  <done>Tabela com RLS e índices criada</done>
</task>

<task type="auto">
  <name>Implementar Edge Function nija-extract-doc</name>
  <files>supabase/functions/nija-extract-doc/index.ts</files>
  <action>
    Criar a função que executa a ETAPA 1 do Dossiê.
    
    ENTRADA: { document_id: string, case_id: string, content: string }
    
    LOGICA:
    1. Usar Prompt de Extração Jurídica Densa (Gemini 2.0 Flash preferencial).
    2. Extrair: tipo_documento, partes, fatos, pedidos, fundamentos, datas.
    3. CLASSIFICAÇÃO OBRIGATÓRIA: fato_confirmado, alegacao_autor, alegacao_reu, prova_documental, prova_ausente.
    4. Persistir em `nija_doc_extractions`.
    
    REGRAS:
    - Retornar APENAS o JSON estruturado.
    - Se falhar, retornar erro claro.
  </action>
  <verify>
    Testar via CURL com um texto de petição conhecido.
    Verificar se o campo `extraction_json` no banco contém a estrutura: { fatos: [], pedidos: [], classificacao_fatos: {...} }
  </verify>
  <done>
    Edge Function deployada e persistindo corretamente no banco.
  </done>
</task>

## Success Criteria
- [ ] Tabela `nija_doc_extractions` persistindo dados
- [ ] Extração unitária correta para petições e decisões
- [ ] Rastreabilidade garantida por `document_id`
