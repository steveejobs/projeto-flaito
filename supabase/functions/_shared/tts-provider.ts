// supabase/functions/_shared/tts-provider.ts
// Camada de abstração TTS — suporta browser (SpeechSynthesis) e ElevenLabs
// Evoluído para suportar configurações dinâmicas por usuário/office

export type TTSProvider = "browser" | "elevenlabs";

export interface TTSConfig {
  provider: TTSProvider;
  enabled: boolean;
  voiceId: string;
  modelId: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface TTSResult {
  provider: TTSProvider;
  enabled: boolean;
  voiceId: string;
  modelId: string;
  audioUrl: string | null;
  audioBase64: string | null;
}

/**
 * Resolve a configuração de TTS baseada em environment variables com overrides opcionais.
 * Prioridade: Overrides (DB) > ENV > Defaults
 */
export function resolveTTSConfig(overrides?: Partial<TTSConfig>): TTSConfig {
  const envApiKey = Deno.env.get("ELEVENLABS_API_KEY");
  const envVoiceId = Deno.env.get("ELEVENLABS_VOICE_ID") || "21m00Tcm4TlvDq8ikWAM"; // Rachel
  const envModelId = Deno.env.get("ELEVENLABS_MODEL_ID") || "eleven_multilingual_v2";

  // Se houver API Key, o provider padrão é ElevenLabs
  const defaultProvider: TTSProvider = envApiKey ? "elevenlabs" : "browser";

  return {
    provider: (overrides?.provider || defaultProvider) as TTSProvider,
    enabled: overrides?.enabled ?? true,
    voiceId: overrides?.voiceId || envVoiceId,
    modelId: overrides?.modelId || envModelId,
    stability: overrides?.stability ?? 0.5,
    similarity_boost: overrides?.similarity_boost ?? 0.75,
    style: overrides?.style ?? 0.0,
    use_speaker_boost: overrides?.use_speaker_boost ?? true,
  };
}

/**
 * Sintetiza texto em fala usando o provider configurado.
 * Se ElevenLabs falhar, faz fallback silencioso para browser.
 */
export async function synthesizeSpeech(
  text: string,
  config: TTSConfig
): Promise<TTSResult> {
  if (!text || text.trim().length === 0) {
    return {
      provider: config.provider,
      enabled: config.enabled,
      voiceId: config.voiceId,
      modelId: config.modelId,
      audioUrl: null,
      audioBase64: null,
    };
  }

  if (config.provider === "elevenlabs" && config.voiceId) {
    return synthesizeElevenLabs(text, config);
  }

  return {
    provider: "browser",
    enabled: true,
    voiceId: "",
    modelId: "",
    audioUrl: null,
    audioBase64: null,
  };
}

/**
 * Chama a API da ElevenLabs para síntese de voz.
 */
async function synthesizeElevenLabs(
  text: string,
  config: TTSConfig
): Promise<TTSResult> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");

  if (!apiKey) {
    console.error("[TTS] ELEVENLABS_API_KEY missing, falling back to browser");
    return browserFallback(config);
  }

  const fallbackResult: TTSResult = {
    provider: "browser",
    enabled: true,
    voiceId: "",
    modelId: "",
    audioUrl: null,
    audioBase64: null,
  };

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text.slice(0, 4000),
          model_id: config.modelId,
          voice_settings: {
            stability: config.stability ?? 0.5,
            similarity_boost: config.similarity_boost ?? 0.75,
            style: config.style ?? 0.0,
            use_speaker_boost: config.use_speaker_boost ?? true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[TTS][ELEVENLABS] API Error:", response.status, errText);
      return fallbackResult;
    }

    const audioBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(audioBuffer);
    const base64 = uint8ArrayToBase64(bytes);

    return {
      provider: "elevenlabs",
      enabled: true,
      voiceId: config.voiceId,
      modelId: config.modelId,
      audioUrl: null,
      audioBase64: `data:audio/mpeg;base64,${base64}`,
    };
  } catch (err: any) {
    console.error("[TTS][ELEVENLABS] Exception:", err.message);
    return fallbackResult;
  }
}

function browserFallback(config: TTSConfig): TTSResult {
  return {
    provider: "browser",
    enabled: true,
    voiceId: "",
    modelId: "",
    audioUrl: null,
    audioBase64: null,
  };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
