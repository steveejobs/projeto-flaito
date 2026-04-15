// supabase/functions/_shared/nija-probability-engine.ts
// Motor de Cálculo de Probabilidade Jurídica Estruturado

export interface ProbabilityFactors {
  provas: number;          // 0-10
  fundamentacao: number;   // 0-10
  coerencia: number;       // 0-10
  jurisprudencia: number;   // 0-10
  lacunas: number;         // 0-10
  risco: number;           // 0-10
}

export const PROBABILITY_WEIGHTS = {
  provas: 30,
  fundamentacao: 20,
  coerencia: 15,
  jurisprudencia: 15,
  lacunas: 10,
  risco: 10
};

export function calculateLegalProbability(factors: ProbabilityFactors): number {
  const weightedSum = 
    (factors.provas * PROBABILITY_WEIGHTS.provas) +
    (factors.fundamentacao * PROBABILITY_WEIGHTS.fundamentacao) +
    (factors.coerencia * PROBABILITY_WEIGHTS.coerencia) +
    (factors.jurisprudencia * PROBABILITY_WEIGHTS.jurisprudencia) +
    (factors.lacunas * PROBABILITY_WEIGHTS.lacunas) +
    (factors.risco * PROBABILITY_WEIGHTS.risco);

  // Normaliza para 0-100 (visto que a soma dos pesos é 100 e scores são 0-10)
  return Math.round(weightedSum / 10);
}

export function classifyProbability(score: number): string {
  if (score <= 30) return "BAIXA_PROBABILIDADE";
  if (score <= 60) return "RISCO_MODERADO";
  if (score <= 80) return "BOA_CHANCE";
  return "ALTA_PROBABILIDADE";
}

export type ProbabilityResult = {
  score: number;
  faixa: string;
  fatores: ProbabilityFactors;
  pesos: typeof PROBABILITY_WEIGHTS;
};
