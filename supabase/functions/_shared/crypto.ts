/**
 * Cryptography Utilities
 * Localização: supabase/functions/_shared/crypto.ts
 * 
 * Implementação de criptografia simétrica (AES-GCM) para proteção de 
 * segredos de terceiros (como chaves de API do Asaas) no banco de dados.
 */

const ALGORITHM = "AES-GCM";
const KEY_NAME = "VAULT_PLATFORM_KEY";

/**
 * Retorna a chave de criptografia da plataforma baseada no segredo do ambiente.
 */
async function getPlatformKey(): Promise<CryptoKey> {
  const secret = Deno.env.get(KEY_NAME);
  if (!secret) {
    throw new Error(`[crypto] ${KEY_NAME} not configured in environment`);
  }

  // Se a chave for menor que 32 bytes, fazemos padding ou hash para 256 bits
  const encoder = new TextEncoder();
  const rawKeyData = encoder.encode(secret);
  
  // Usar SHA-256 para garantir que a chave tenha sempre 256 bits, independente do tamanho do secret
  const hash = await crypto.subtle.digest("SHA-256", rawKeyData);

  return await crypto.subtle.importKey(
    "raw",
    hash,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Criptografa um texto e retorna no formato iv:ciphertext (hex)
 */
export async function encrypt(text: string): Promise<string> {
  const key = await getPlatformKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // IV (Initialization Vector) - 12 bytes é o recomendado para GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("");
  const ciphertextHex = Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, "0")).join("");

  return `${ivHex}:${ciphertextHex}`;
}

/**
 * Descriptografa um texto no formato iv:ciphertext (hex)
 */
export async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText.includes(":")) {
    throw new Error("[crypto] Invalid encrypted format. Expected iv:ciphertext");
  }

  const [ivHex, ciphertextHex] = encryptedText.split(":");
  const key = await getPlatformKey();

  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const ciphertext = new Uint8Array(ciphertextHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    throw new Error(`[crypto] Decryption failed. Possible key mismatch or data corruption. ${err.message}`);
  }
}
