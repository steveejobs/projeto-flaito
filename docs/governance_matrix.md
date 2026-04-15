# Matriz de Governança e Auditoria Flaito (V1.0)

Este documento define a arquitetura de missão crítica para os motores médico e jurídico, garantindo rastreabilidade total, segurança clínica e integridade processual.

## 1. Motores e Camadas

### ⚖️ Motor Jurídico (7 Camadas de Integridade)
A esteira de processamento jurídico segue o rigor de "Artifact before Action".

1.  **Ingestão:** Captura de arquivos com geração de `integrity_hash` (SHA-256) e metadados de origem.
2.  **Classificação:** Identificação do tipo documental (Petição, Laudo, E-mail, etc.) com score de confiança.
3.  **Estruturação:** Extração atômica de fatos, datas e valores para o Ledger Fático.
4.  **Indexação:** Vetorização e armazenamento em banco relacional estruturado com referências cruzadas.
5.  **Reconstrução:** Montagem da Timeline Fática (Ponto 1.2) baseada em evidências auditáveis.
6.  **Raciocínio (Audit Trace):** Log de raciocínio (Chain-of-Thought) e análise de lacunas documentais.
7.  **Geração:** Produção da peça final com Nível de Validação (A-D) e transparência de fontes.

### 🩺 Motor Médico (Segurança e Neutralização)
Focado em apoio à decisão sem substituição do médico.

*   **Neutralização Clínica:** Filtro mandatório que impede diagnósticos determinísticos automáticos.
*   **Hierarquia de Relatório (7 Blocos):**
    1. Identificação
    2. Material Analisado
    3. Metodologia (IA + Parâmetros)
    4. Achados Semióticos
    5. Correlação Iridológica/Fenotípica
    6. Limitações do Método IA
    7. Conclusão para Revisão Médica

## 2. Níveis de Validação de Saída (Output Levels)

| Nível | Descrição | Restrição | Exemplo |
| :--- | :--- | :--- | :--- |
| **LEVEL_A** | Raw / Experimental | Apenas uso interno do desenvolvedor. | Protótipos |
| **LEVEL_B** | AI-Assisted (Draft) | Sugestão de texto/fatos, exige revisão pesada. | Resumos de docs |
| **LEVEL_C** | Validated (High Trust) | Dados estruturados e tese sugerida. | Timeline processual |
| **LEVEL_D** | Final Audit (Human in Loop) | Exige assinatura digital para exportação. | Petição Inicial / Laudo |

## 3. Protocolos de Auditoria

*   **Rastreabilidade:** Cada `audit_log` deve conter `model_version`, `system_prompt_version` e `reasoning_log`.
*   **Integridade:** O `integrity_hash` deve ser validado em todas as etapas da Pipeline.
*   **Neutralização:** O "Watchdog" médico bloqueia saídas se detectar termos de prescrição ou diagnóstico final no nível de usuário comum.

---
*Assinado pelo Auditor Digital Flaito*
