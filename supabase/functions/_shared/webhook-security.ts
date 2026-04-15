/**
 * Webhook Security Utilities
 * Localização: supabase/functions/_shared/webhook-security.ts
 */

/**
 * Valida assinaturas HMAC-SHA256 enviadas por provedores como Meta (WhatsApp).
 * O formato esperado da assinatura da Meta é "sha256=HEX_CODE".
 */
export async function verifyHMACSignature(
  payload: string,
  signature: string | null,
  secret: string,
  algorithm: "SHA-256" = "SHA-256"
): Promise<boolean> {
  if (!signature || !secret) return false;

  // Remover prefixos comuns (ex: "sha256=")
  const cleanSignature = signature.includes("=") 
    ? signature.split("=")[1] 
    : signature;

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: algorithm },
      false,
      ["verify"]
    );

    const verified = await crypto.subtle.verify(
      "HMAC",
      key,
      hexToBytes(cleanSignature),
      payloadData
    );

    return verified;
  } catch (err) {
    console.error("[security] Signature verification error:", err);
    return false;
  }
}

/**
 * Verifica se um timestamp enviado pelo provedor está dentro de uma janela
 * de tempo aceitável (Replay Protection).
 */
export function isTimestampValid(
  providerTimestamp: number | string,
  windowSeconds: number = 300 // Default 5 minutos
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const ts = typeof providerTimestamp === "string" 
    ? parseInt(providerTimestamp) 
    : providerTimestamp;

  if (isNaN(ts)) return false;

  // Aceitar timestamps levemente no futuro e até windowSeconds no passado
  return ts >= (now - windowSeconds) && ts <= (now + 60);
}

/**
 * Utilitário para converter string HEX em Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const part = hex.substring(i * 2, i * 2 + 2);
    bytes[i] = parseInt(part, 16);
  }
  return bytes;
}

/**
 * Validação de token estático (Auth Header or Query Param)
 */
export function verifyStaticToken(received: string | null, expected: string): boolean {
  if (!received || !expected) return false;
  // Comparação de tempo constante para evitar timing attacks
  if (received.length !== expected.length) return false;
  
  let result = 0;
  for (let i = 0; i < received.length; i++) {
    result |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}
