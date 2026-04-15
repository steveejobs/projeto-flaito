-- Flaito Future Assistant Readiness
-- Adiciona comentários semânticos e garante indexação vetorial e padronizações para a futura assistente virtual (NotebookLM/Agentica)

-- 1. ADICIONA COMENTÁRIOS SEMÂNTICOS NO SCHEMA (Database Metadata para LLMs / RAG Extraction)
COMMENT ON TABLE public.legal_documents IS 'FLAITO-CORE: Repositório central de peças jurídicas, teses e súmulas. Usado intensivamente pelos Lexos Agents para argumentação baseada em precedentes e redação técnica.';
COMMENT ON COLUMN public.legal_documents.title IS 'Título descritivo rigoroso para identificação imediata pela IA.';
COMMENT ON COLUMN public.legal_documents.content IS 'Conteúdo integral e bruto injetável no prompt do Agente para aterramento (grounding).';
COMMENT ON COLUMN public.legal_documents.tags IS 'Metadados semânticos para filtros cirúrgicos (ex: ["stf", "tema1046", "tributario"]).';

COMMENT ON TABLE public.protocolos IS 'FLAITO-CORE: Diretrizes clínicas aprovadas pelo gestor da clínica. Fundamental para Medical Agents evitarem alucinação diagnóstica.';
COMMENT ON COLUMN public.protocolos.conteudo IS 'Matriz JSON estruturada do protocolo (passos, medicamentos, condutas). Consumida nativamente pelo Agent para elaborar prescrições ricas.';

COMMENT ON TABLE public.ai_config IS 'FLAITO-CORE: Base de master prompts ou system instructions. Dita o comportamento do Bot por tenant.';

-- 2. GARANTIA DE ESTRUTURA PARA IMPORTAÇÃO/AGENDAMENTO:
-- Se futuramente a assistente for agendar, ela precisará buscar clientes por nome exato (Busca Trigram/GIST).
-- Iremos criar um índice pg_trgm (se suportado/não existente) para auxiliar assistentes na busca unificada ("Find client John").
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS trgm_idx_clients_name ON public.clientes USING GIN (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS trgm_idx_documents_title ON public.legal_documents USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS trgm_idx_protocolos_titulo ON public.protocolos USING GIN (titulo gin_trgm_ops);

-- Garantir que todo conteúdo novo e futuro de assistentes terá tags padronizadas em legal_documents
-- Nada estrito que quebre, mas preparando para NotebookLM onde tags dictam os "Notebooks".
