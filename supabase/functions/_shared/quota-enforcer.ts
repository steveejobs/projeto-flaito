/**
 * shared/quota-enforcer.ts
 * Verifica e atualiza quotas de consumo SaaS
 */

export async function checkQuota(
  supabase: any,
  officeId: string,
  type: "legal_pieces" | "medical_analysis"
): Promise<{ allowed: boolean; remaining: number }> {
  const { data: quota, error } = await supabase
    .from("saas_quotas")
    .select("*")
    .eq("office_id", officeId)
    .single();

  if (error || !quota) {
    // Se não houver quota definida, permitimos por padrão (grace period ou trial)
    // Ou podemos bloquear dependendo da regra de negócio. Aqui daremos 1 de margem.
    return { allowed: true, remaining: 1 };
  }

  const limitField = `${type}_limit`;
  const usedField = `${type}_used`;

  const allowed = quota[usedField] < quota[limitField];
  const remaining = quota[limitField] - quota[usedField];

  return { allowed, remaining };
}

export async function consumeQuota(
  supabase: any,
  officeId: string,
  type: "legal_pieces" | "medical_analysis",
  stats?: { forensic_reviews?: number; refinement_cycles?: number }
): Promise<void> {
  const usedField = `${type}_used`;
  
  const updateData: any = {
    [usedField]: 1, // Will be incremented via RPC or manual logic
    updated_at: new Date().toISOString(),
  };

  // Usando RPC increment_quota para evitar race conditions
  const { error } = await supabase.rpc("increment_office_quota", {
    p_office_id: officeId,
    p_type: type,
    p_forensic_inc: stats?.forensic_reviews || 1,
    p_refine_inc: stats?.refinement_cycles || 0
  });

  if (error) {
    console.error("[QuotaEnforcer] Erro ao consumir quota:", error);
    // Fallback: Tentativa manual se o RPC falhar (embora as migrações devessem ter o RPC)
  }
}
