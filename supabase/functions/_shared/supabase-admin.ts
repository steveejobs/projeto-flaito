import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Cria um cliente Supabase Admin otimizado para Edge Functions.
 * Utiliza o Connection Pooler se a URL estiver configurada corretamente.
 */
export const getSupabaseAdmin = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // Em produção, deve-se usar a URL do Pooler (porta 6543) para conexões DB diretas se necessário,
  // mas para o cliente JS, a URL da API padrão é suficiente. 
  // O ponto aqui é centralizar para permitir injeção de logs ou instanciamento único no futuro.
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

/**
 * Helper para lidar com retentativas em chamadas de banco/funções (Resiliência)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`[RETRY] Attempt ${i + 1} failed. Retrying in ${delayMs}ms...`);
      await new Promise(res => setTimeout(res, delayMs * Math.pow(2, i))); // Exponential backoff
    }
  }
  throw lastError;
}
