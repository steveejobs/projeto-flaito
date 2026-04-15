// supabase/functions/_shared/agent-resolver.ts

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getAutonomousDecision } from "./optimizer-client.ts";


export type ResolutionLevel = "STAGE" | "OFFICE" | "GLOBAL";

export interface ResolvedAgentConfig {
  id: string;
  slug: string;
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  extra_instructions?: string;
  is_active: boolean;
  metadata: any;
  mode: "automatic" | "advanced";
  resolution: {
    config_id: string;
    version: number;
    source_level: ResolutionLevel;
    warnings: string[];
    is_blocked: boolean;
    fallback_used: boolean;
  };
}

export interface ResolverOptions {
  office_id?: string | null;
  pipeline_stage?: string | null;
  fallback?: Partial<ResolvedAgentConfig>;
}

/**
 * Resolve a configuração de um agente de IA baseada na hierarquia:
 * 1. Stage (Slug + Office + Stage)
 * 2. Office (Slug + Office)
 * 3. Global (Slug)
 */
export async function getAgentConfig(
  supabase: SupabaseClient,
  slug: string,
  options: ResolverOptions = {}
): Promise<ResolvedAgentConfig | null> {
  const { office_id = null, pipeline_stage = null, fallback = {} } = options;
  const warnings: string[] = [];

  // 1. Tentar buscar todos os candidatos possíveis em uma única query para eficiência
  // Ordenação por office_id DESC e pipeline_stage DESC garante que:
  // - Stage (non-null) vem antes de null
  // - Office (non-null) vem antes de null (Global)
  const { data: configs, error } = await supabase
    .from("ai_agent_configs")
    .select("*")
    .eq("slug", slug)
    .or(
      `office_id.is.null,office_id.eq.${office_id}`
    )
    .order("office_id", { ascending: false, nullsFirst: false })
    .order("pipeline_stage", { ascending: false, nullsFirst: false });

  if (error) {
    console.error(`[RESOLVER][${slug}] DB Error:`, error.message);
    warnings.push(`DB Error: ${error.message}`);
  }

  // 2. Filtrar o melhor candidato manualmente respeitando a lógica rigorosa
  let selected = null;
  let level: ResolutionLevel = "GLOBAL";

  if (configs && configs.length > 0) {
    // Tentar Stage
    if (office_id && pipeline_stage) {
      selected = configs.find(c => c.office_id === office_id && c.pipeline_stage === pipeline_stage);
      if (selected) level = "STAGE";
    }

    // Tentar Office
    if (!selected && office_id) {
      selected = configs.find(c => c.office_id === office_id && !c.pipeline_stage);
      if (selected) level = "OFFICE";
    }

    // Tentar Global
    if (!selected) {
      selected = configs.find(c => !c.office_id && !c.pipeline_stage);
      if (selected) level = "GLOBAL";
    }
  }

  // 3. Se não encontrou nada no banco, usar Fallback se fornecido
  if (!selected) {
    if (Object.keys(fallback).length === 0) {
      console.warn(`[RESOLVER][${slug}] No config found and no fallback provided.`);
      return null;
    }
    warnings.push("Using hardcoded fallback configuration.");
    return {
      ...fallback as ResolvedAgentConfig,
      resolution: {
        config_id: "fallback",
        version: 0,
        source_level: "GLOBAL",
        warnings,
        is_blocked: false,
        fallback_used: true,
      }
    };
  }

  // 4. Validações e Sanitização
  const isBlocked = !selected.is_active;
  if (isBlocked) {
    warnings.push("Agent is explicitly deactivated.");
  }

  // 5. Stage 17: Autonomous Optimization Override
  // If the agent is in 'automatic' mode, ask the optimizer for a recommendation
  if (selected.mode === "automatic" && !isBlocked) {
    const autonomousDecision = await getAutonomousDecision(supabase, {
      office_id: office_id as string,
      feature: slug, // Assuming slug is the feature identifier
      current_model: selected.model
    });

    if (autonomousDecision && autonomousDecision.recommendation) {
      const oldModel = selected.model;
      if (autonomousDecision.action === "apply" && autonomousDecision.recommendation !== oldModel) {
        selected.model = autonomousDecision.recommendation;
        warnings.push(`Autonomous Optimization: Auto-applied model switch from ${oldModel} to ${selected.model} (Confidence: ${autonomousDecision.confidence_score})`);
      } else if (autonomousDecision.action === "suggest") {
        warnings.push(`Autonomous Optimization Suggestion: ${autonomousDecision.recommendation} (Reason: ${autonomousDecision.reason})`);
      }
    }
  }
  
  // Garantir limites seguros
  const temperature = Math.max(0, Math.min(2, selected.temperature ?? 0.7));
  const maxTokens = Math.max(1, selected.max_tokens ?? 4096);

  console.log(`[RESOLVER][${slug}] Resolved via ${level}${selected.version ? ` (v${selected.version})` : ""} | Office: ${office_id || "GLOBAL"} | Blocked: ${isBlocked}`);


  return {
    id: selected.id,
    slug: selected.slug,
    provider: selected.provider,
    model: selected.model,
    temperature,
    max_tokens: maxTokens,
    system_prompt: selected.system_prompt,
    extra_instructions: selected.extra_instructions,
    is_active: selected.is_active,
    metadata: selected.metadata,
    mode: selected.mode,
    resolution: {
      config_id: selected.id,
      version: selected.version,
      source_level: level,
      warnings,
      is_blocked: isBlocked,
      fallback_used: false
    }
  };
}


