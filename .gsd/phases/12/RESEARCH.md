# Research: Motor de Revisão Jurídica (NIJA-REVIEW V2)

## Contexto
O usuário solicitou um motor de revisão que atua como um advogado sênior crítico. A implementação requer uma Edge Function capaz de processar 9 etapas de auditoria distintas.

## Desafios Técnicos

### 1. Coerência Fática (Etapa 2) e Verificação de Provas (Etapa 5)
- **Desafio**: Cross-reference entre o texto da peça e o dossiê JSON.
- **Solução**: Utilizar modelos de alto contexto (Gemini 1.5 Pro ou 2.0 Pro) que suportem reasoning complexo. O prompt deve instruir a IA a agir como um "Adversário Técnico", buscando especificamente inconsistências.
- **Tática**: Criar uma "Matriz de Confronto" dentro do prompt, onde a IA lista as entidades do dossiê e verifica sua presença/veracidade na peça.

### 2. Fundamentação Jurídica (Etapa 3)
- **Desafio**: Evitar citações genéricas ou inexistentes.
- **Solução**: Integrar com a base vetorial (`match_legal_chunks`) se possível, ou garantir que a IA tenha acesso ao resumo da estratégia (`legal_strategy`) para validar se as leis citadas batem com o plano original.

### 3. Orquestração das 9 Etapas
- **Abordagem A**: Um único prompt gigante com output JSON complexo. (Mais rápido, menor custo).
- **Abordagem B**: Múltiplas chamadas (uma por etapa). (Mais lento, maior rigor, custo proibitivo de tokens).
- **Decisão**: Abordagem A (Prompt Unificado) com **Chain of Thought (CoT)** explicitamente forçada para cada etapa antes de gerar o JSON final. Isso garante que a IA "pense" sobre a estrutura, fatos, leis, etc., isoladamente antes de consolidar.

## Arquitetura de Prompt
- **Persona**: Senior Litigation Auditor.
- **Tom**: Crítico, técnico, direto, rigoroso.
- **Instrução**: "Sua função é encontrar erros, não elogiar a peça."

## Conclusão
A implementação via Edge Function no Supabase é viável usando o Lovable AI Gateway para acessar modelos de ponta. A estrutura solicitada pelo usuário é compatível com os padrões do NIJA V2.
