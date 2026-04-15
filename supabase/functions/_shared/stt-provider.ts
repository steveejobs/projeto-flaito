// supabase/functions/_shared/stt-provider.ts
// Interface de Speech-to-Text — placeholder documentado para futura implementação server-side
//
// FLUXO ATUAL (browser):
//   webkitSpeechRecognition → texto → processCommand(texto) → Edge Function
//
// FLUXO FUTURO (server-side):
//   MediaRecorder → Blob áudio → upload → Edge Function → STT Provider → texto → LLM
//
// Para implementar, criar uma classe que implemente SpeechToTextProvider
// e registrar no resolveSTTConfig() com provider "openai" (Whisper) ou outro.

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
}

/**
 * Interface que qualquer provider de STT deve implementar.
 */
export interface SpeechToTextProvider {
  transcribe(audioInput: Blob | ArrayBuffer | Uint8Array, options?: STTOptions): Promise<STTResult>;
}

/**
 * Resolve o provider de STT baseado em configuração.
 * Fase 1: sempre retorna "browser" (implementação atual no frontend)
 * Fase 2: buscar de ENV/DB e retornar provider server-side
 */
export function resolveSTTConfig(): { provider: STTProviderType; enabled: boolean } {
  // TODO: Quando OpenAI Whisper for configurado:
  // const apiKey = Deno.env.get("OPENAI_API_KEY"); // Já existe para LLM
  // if (apiKey) return { provider: "openai", enabled: true };

  return { provider: "browser", enabled: true };
}

/**
 * Placeholder para futura implementação de STT server-side via OpenAI Whisper.
 *
 * Exemplo de implementação futura:
 *
 * export async function transcribeWithWhisper(
 *   audioInput: Blob | ArrayBuffer | Uint8Array,
 *   options?: STTOptions
 * ): Promise<STTResult> {
 *   const apiKey = Deno.env.get("OPENAI_API_KEY");
 *   if (!apiKey) throw new Error("Missing OPENAI_API_KEY for STT");
 *
 *   const formData = new FormData();
 *   formData.append("file", new Blob([audioInput]), "audio.webm");
 *   formData.append("model", options?.model || "whisper-1");
 *   formData.append("language", options?.language || "pt");
 *
 *   const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
 *     method: "POST",
 *     headers: { Authorization: `Bearer ${apiKey}` },
 *     body: formData,
 *   });
 *
 *   if (!response.ok) throw new Error(`Whisper API error: ${response.status}`);
 *   const data = await response.json();
 *
 *   return {
 *     text: data.text,
 *     provider: "openai",
 *     language: options?.language || "pt",
 *   };
 * }
 */
