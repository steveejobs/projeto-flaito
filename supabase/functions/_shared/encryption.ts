/**
 * shared/encryption.ts
 * Utilitários para criptografia de segredos (Asaas API Keys, etc)
 * Algoritmo: AES-256-GCM
 */

const MASTER_KEY_HEX = Deno.env.get("ENCRYPTION_MASTER_KEY");

async function getMasterKey() {
  if (!MASTER_KEY_HEX) {
    throw new Error("ENCRYPTION_MASTER_KEY não configurada no ambiente.");
  }
  
  // Converter Hex para Uint8Array
  const keyBuffer = new Uint8Array(
    MASTER_KEY_HEX.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  return await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Criptografa uma string usando AES-256-GCM
 * Retorna { encryptedData: hex, iv: hex }
 */
export async function encrypt(text: string): Promise<{ encryptedData: string; iv: string }> {
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // IV recomendado para GCM é 12 bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  const encryptedArray = new Uint8Array(encryptedBuffer);
  
  return {
    encryptedData: Array.from(encryptedArray).map(b => b.toString(16).padStart(2, '0')).join(''),
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('')
  };
}

/**
 * Decriptografa uma string hex
 */
export async function decrypt(encryptedHex: string, ivHex: string): Promise<string> {
  const key = await getMasterKey();
  
  const iv = new Uint8Array(
    ivHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  
  const encryptedData = new Uint8Array(
    encryptedHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedData
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
