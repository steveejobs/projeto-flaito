// supabase/functions/_shared/external-adapter.ts
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface ResilientFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  isIdempotent?: boolean;
  serviceName: "openai" | "asaas" | "zapi" | "zapsign";
  correlationId?: string;
}

export interface StructuredLog {
  event: "external_call_start" | "external_call_success" | "external_call_failure" | "circuit_breaker_open" | "retry_attempt";
  service: string;
  url: string;
  method: string;
  status?: number;
  duration_ms?: number;
  correlation_id: string;
  error_type?: string;
  retry_count?: number;
  trace_id?: string;
}

const DEFAULT_TIMEOUT = 30000; // 30s
const DEFAULT_RETRIES = 3;

function logStructured(data: StructuredLog) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...data
  }));
}

/**
 * Adaptador para chamadas externas com Resiliência SRE
 */
export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions
): Promise<Response> {
  const {
    serviceName,
    timeoutMs = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_RETRIES,
    isIdempotent = false,
    correlationId = crypto.randomUUID(),
    ...fetchOptions
  } = options;

  const startTime = performance.now();
  const method = fetchOptions.method || "GET";
  
  // 1. Circuit Breaker Check (Persistente)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: health } = await supabase
    .from("service_health")
    .select("*")
    .eq("service_name", serviceName)
    .single();

  if (health && health.status === "OPEN") {
    const now = new Date();
    const retryAfter = new Date(health.retry_after);
    
    if (now < retryAfter) {
      logStructured({
        event: "circuit_breaker_open",
        service: serviceName,
        url,
        method,
        correlation_id: correlationId,
        error_type: "CIRCUIT_OPEN"
      });
      throw new Error(`Circuit breaker is OPEN for service ${serviceName}. Retry after ${health.retry_after}`);
    }
    // Se passou do tempo, entra em HALF_OPEN (implicitamente na próxima tentativa)
  }

  // 2. Execution with Retry & Timeout
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (attempt > 0) {
        logStructured({
          event: "retry_attempt",
          service: serviceName,
          url,
          method,
          correlation_id: correlationId,
          retry_count: attempt
        });
        // Exponential backoff: 500ms, 1000ms, 2000ms...
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 250));
      }

      logStructured({
        event: "external_call_start",
        service: serviceName,
        url,
        method,
        correlation_id: correlationId
      });

      // Injetar Correlation ID no header
      const headers = new Headers(fetchOptions.headers || {});
      headers.set("x-correlation-id", correlationId);

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal
      });

      const duration = performance.now() - startTime;

      if (response.ok) {
        // Reset Health on Success
        if (health && health.failure_count > 0) {
          await supabase.from("service_health").update({
            status: "CLOSED",
            failure_count: 0,
            last_failure_at: null,
            retry_after: null
          }).eq("service_name", serviceName);
        }

        // ── SRE Telemetry: Success ──────────────────────────
        reportTelemetry(supabase, serviceName, false, false, Math.round(duration));

        logStructured({
            event: "external_call_success",
            service: serviceName,
            url,
            method,
            status: response.status,
            duration_ms: Math.round(duration),
            correlation_id: correlationId
        });

        return response;
      }

      // 3. Error Handling (4xx vs 5xx)
      if (response.status >= 500 || response.status === 429) {
        throw new Error(`Upstream Error: ${response.status}`);
      } else {
        // 4xx Errors are not retryable normally
        // ── SRE Telemetry: Client Error ───────────────
        reportTelemetry(supabase, serviceName, true, false, Math.round(duration), `HTTP_${response.status}`);

        logStructured({
            event: "external_call_failure",
            service: serviceName,
            url,
            method,
            status: response.status,
            correlation_id: correlationId,
            error_type: "CLIENT_ERROR"
        });
        return response; 
      }

    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      const isTimeout = err.name === "AbortError";
      const duration = performance.now() - startTime;
      
      // Update Health on Failure
      if (health) {
        const newFailCount = (health.failure_count || 0) + 1;
        const shouldOpen = newFailCount >= 5;
        
        await supabase.from("service_health").update({
          status: shouldOpen ? "OPEN" : "HALF_OPEN",
          failure_count: newFailCount,
          last_failure_at: new Date().toISOString(),
          retry_after: shouldOpen ? new Date(Date.now() + 300000).toISOString() : null // 5 min se abrir
        }).eq("service_name", serviceName);
      }

      // ── SRE Telemetry: Failure ──────────────────────────
      reportTelemetry(supabase, serviceName, true, isTimeout, Math.round(duration), err.message);

      logStructured({
        event: "external_call_failure",
        service: serviceName,
        url,
        method,
        correlation_id: correlationId,
        error_type: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
        retry_count: attempt
      });

      // Se não for idempotente e for POST/PUT/PATCH, não tenta novo retry após a primeira falha de rede/timeout
      if (!isIdempotent && attempt === 0 && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
          break; 
      }
    }
  }

  throw lastError;
}

/**
 * Reporta métricas para o banco de dados (View de Dashboard)
 */
async function reportTelemetry(
    supabase: SupabaseClient, 
    service: string, 
    isError: boolean, 
    isTimeout: boolean, 
    latencyMs: number,
    reason?: string
) {
    try {
        await supabase.rpc("increment_service_telemetry", {
            target_service: service,
            is_error: isError,
            is_timeout: isTimeout,
            latency_ms: latencyMs,
            failure_reason: reason
        });
    } catch (e) {
        // Silencioso: Telemetria não deve quebrar a execução principal
        console.error("[SRE] Failed to report telemetry:", e.message);
    }
}
