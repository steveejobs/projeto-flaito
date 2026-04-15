// supabase/functions/_shared/whisper-provider.ts
// Speech-to-Text usando OpenAI Whisper API

export type STTProviderType = "browser" | "openai" | "whisper";

export interface STTOptions {
  language?: string;
  model?: string;
  provider?: STTProviderType;
}

export interface STTResult {
  text: string;
  provider: STTProviderType;
  confidence?: number;
  language?: string;
  durationMs?: number;
  processingMs?: number;
}

/**
 * Provider de STT usando OpenAI Whisper
 * Requer OPENAI_API_KEY configurado no ambiente
 */
export async function transcribeWithWhisper(
  audioBase64: string,
  mimeType: string,
  options?: STTOptions
): Promise<STTResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurado para STT");
  }

  const startTime = Date.now();

  // Decodificar base64 para Uint8Array
  const base64Data = audioBase64.includes(',')
    ? audioBase64.split(',')[1]
    : audioBase64;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Criar FormData
  const formData = new FormData();
  const blob = new Blob([bytes], { type: mimeType });
  formData.append("file", blob, `audio.${mimeType.split('/')[1] || 'webm'}`);
  formData.append("model", options?.model || "whisper-1");
  formData.append("language", options?.language || "pt");
  formData.append("response_format", "json");

  // Enviar para OpenAI Whisper API
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[WHISPER] API Error:", response.status, errText);
    throw new Error(`Whisper API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const processingMs = Date.now() - startTime;

  return {
    text: data.text || "",
    provider: "openai",
    language: options?.language || data.language || "pt",
    durationMs: data.duration, // Whisper retorna duração do áudio em segundos
    processingMs,
  };
}

/**
 * Wrapper que pode ser estendido para outros providers no futuro
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  options?: STTOptions
): Promise<STTResult> {
  const provider = options?.provider || "openai";

  switch (provider) {
    case "openai":
      return transcribeWithWhisper(audioBase64, mimeType, options);
    case "browser":
      throw new Error("browser provider deve ser usado no frontend, não no backend");
    default:
      throw new Error(`Provider STT não suportado: ${provider}`);
  }
}
