# SPECIFICATION - Flaito Dossier Engine (V2)
**Status**: FINALIZED
**Role**: Principal Legal Data Architect

## 1. Overview
O Motor de Dossiê do Processo é o componente central de inteligência da Flaito. Ele transforma dados brutos (PDFs, textos, metadados) em uma estrutura canônica, versionada e compreensível para agentes de IA (Juiz, Estrategista, Gerador de Peças).

## 2. Requisitos Funcionais

### 2.1 Estrutura do Dossiê
O dossiê deve conter:
- **Identificação**: client_id, case_id, número do processo, tribunal, área, fase.
- **Partes**: Autor, Réu, Advogados (com papéis definidos).
- **Fatos**: Narrativa cronológica mapeada por eventos.
- **Pedidos**: Lista estruturada de pedidos principais e secundários.
- **Provas**: Mapeamento de provas materiais vs. fatos alegados.
- **Detecção de Lacunas**: Identificação automática de fatos sem prova ou documentos ausentes.
- **Resumo Executivo**: Visão tática para o advogado (30s de leitura).

### 2.2 Ingestão e Processamento
- Agregação de múltiplos documentos do caso.
- OCR e extração inteligente de entidades (NER jurídico).
- Classificação automática de complexidade e risco.

### 2.3 Integração
- Output em JSON estruturado para consumo de outros agentes.
- Vínculo direto com a timeline do caso no Supabase.

## 3. Modelo de Dados
- Tabela `process_dossiers` (versionada).
- Relacionamento com `cases` e `documents`.

## 4. Critérios de Aceite
1. Estruturação completa de um caso a partir de múltiplos documentos.
2. Identificação precisa de Partes, Fatos e Pedidos.
3. Geração de Timeline Factual vs. Processual.
4. Relatório de Lacunas (Gaps) coerente com a área do direito.
5. Histórico de versões mantido no banco.
