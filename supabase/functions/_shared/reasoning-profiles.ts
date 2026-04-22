// supabase/functions/_shared/reasoning-profiles.ts
// Real reasoning mode profiles that affect backend inference behavior.

export type ReasoningMode = "fast" | "standard" | "deep" | "maximum";

export interface ReasoningProfile {
  model: string;
  temperature: number;
  max_tokens: number;
  retrieval_count: number;
  rerank: boolean;
  description: string;
}

export const REASONING_PROFILES: Record<ReasoningMode, ReasoningProfile> = {
  fast: {
    model: "google/gemini-2.0-flash-exp",
    temperature: 0.3,
    max_tokens: 2048,
    retrieval_count: 3,
    rerank: false,
    description: "Quick answers, lower cost",
  },
  standard: {
    model: "google/gemini-2.0-flash-exp",
    temperature: 0.7,
    max_tokens: 4096,
    retrieval_count: 5,
    rerank: false,
    description: "Balanced quality and speed",
  },
  deep: {
    model: "google/gemini-2.5-pro-exp-03-25",
    temperature: 0.5,
    max_tokens: 8192,
    retrieval_count: 10,
    rerank: true,
    description: "Thorough analysis, better model",
  },
  maximum: {
    model: "anthropic/claude-sonnet-4-20250514",
    temperature: 0.4,
    max_tokens: 16384,
    retrieval_count: 15,
    rerank: true,
    description: "Best possible answer, highest cost",
  },
};

/**
 * Resolve final runtime parameters by merging reasoning profile defaults
 * with explicit agent config overrides.
 *
 * Agent config values take precedence when explicitly set (non-null/undefined).
 * Reasoning profile provides the defaults for unset values.
 */
export function resolveRuntimeParams(
  reasoningMode: ReasoningMode,
  agentConfig: {
    model?: string | null;
    temperature?: number | null;
    max_tokens?: number | null;
  }
): ReasoningProfile {
  const profile = REASONING_PROFILES[reasoningMode] || REASONING_PROFILES.standard;

  return {
    model: agentConfig.model || profile.model,
    temperature: agentConfig.temperature ?? profile.temperature,
    max_tokens: agentConfig.max_tokens ?? profile.max_tokens,
    retrieval_count: profile.retrieval_count,
    rerank: profile.rerank,
    description: profile.description,
  };
}
