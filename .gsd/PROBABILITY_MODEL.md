# Modelo de Probabilidade Jurídica (NIJA-PROBABILITY)

Este documento descreve o modelo matemático e a lógica de pesos utilizada pelo motor de probabilidade do Flaito para calcular o êxito de casos jurídicos.

## Arquitetura de Scoring

O sistema utiliza uma **Média Ponderada** de 6 fatores fundamentais, avaliados individualmente em uma escala de 0 a 10 por um agente de IA especializado (Juiz IA).

| Fator | Peso | Descrição |
| :--- | :--- | :--- |
| **Provas** | 30% | Qualidade, tempestividade e robustez dos documentos e indícios. |
| **Fundamentação** | 20% | Força dos argumentos jurídicos e teses aplicadas. |
| **Coerência** | 15% | Consistência lógica entre fatos narrados e pedidos formulados. |
| **Jurisprudência** | 15% | Alinhamento com decisões de tribunais superiores e precedentes. |
| **Lacunas** | 10% | Presença de pontos obscuros ou falta de provas em fatos chave. |
| **Risco** | 10% | Exposição a riscos processuais, prescrição ou nulidades. |

## Fórmula de Cálculo

A probabilidade $P$ é calculada como:

$$P = \sum (Score_i \times Peso_i) \times 10$$

Onde $Score_i \in [0, 10]$ e $\sum Peso_i = 1.0$.

## Faixas de Classificação

O resultado final é mapeado em 4 faixas táticas:

1.  **ALTA_PROBABILIDADE** (61% - 100%): Caso sólido, baixo risco de improcedência.
2.  **BOA_CHANCE** (46% - 60%): Argumentação forte, mas dependente de tese ou instrução.
3.  **RISCO_MODERADO** (31% - 45%): Equilíbrio entre provas e contra-argumentos.
4.  **BAIXA_PROBABILIDADE** (0% - 30%): Risco crítico de improcedência ou carência probatória.

## Auditabilidade e Feedback Loop

O sistema é auditável em dois níveis:
1.  **Transparência Visual**: O `NijaJudgeReport` exibe o score individual de cada fator.
2.  **Maestro Feedback**: Se o Juiz IA decidir por "Procedente" mas o score for $< 45\%$, o orquestrador força uma reiteração corretiva para alinhar a narrativa ou mitigar riscos.

---
*Versão 1.0 - Implementado em Abril/2026*
