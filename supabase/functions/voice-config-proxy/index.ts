import { authenticateAndAuthorize } from "../_shared/auth.ts";

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
const ALLOWED_ORIGINS = Deno.env.get("CORS_ALLOWED_ORIGINS")?.split(",") || ["*"];

const getCorsHeaders = (origin: string | null) => {
    const isAllowed = origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*"));
    return {
        "Access-Control-Allow-Origin": isAllowed ? origin! : (ALLOWED_ORIGINS[0] || ""),
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    };
};

/**
 * Converte Uint8Array para base64 (compatível com Deno).
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

Deno.serve(async (req: Request) => {
    const origin = req.headers.get("origin");
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: getCorsHeaders(origin) });
    }

    // 1. Authenticate user
    const auth = await authenticateAndAuthorize(req);
    if (!auth.ok) {
        return new Response(JSON.stringify(auth), { 
            status: auth.status, 
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } 
        });
    }

    const { adminClient, user } = auth;

    try {
        const url = new URL(req.url);
        const parts = url.pathname.split("/").filter(Boolean);
        const path = parts.pop();

        console.log(`[voice-config-proxy] Request path: ${path}, method: ${req.method}`);

        // ROUTE: GET /voices
        if (req.method === "GET" && path === "voices") {
            const resp = await fetch("https://api.elevenlabs.io/v1/voices", {
                headers: { "xi-api-key": ELEVENLABS_API_KEY! },
            });
            if (!resp.ok) throw new Error(`ElevenLabs API Error: ${resp.status}`);
            const data = await resp.json();
            return new Response(JSON.stringify(data), { 
                headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } 
            });
        }

        // ROUTE: POST /preview
        if (req.method === "POST" && path === "preview") {
            const body = await req.json();
            const { voice_id, text, stability, similarity_boost } = body;
            
            if (!voice_id || !text) throw new Error("Missing params: voice_id and text are required");

            const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}/stream`, {
                method: "POST",
                headers: {
                    "xi-api-key": ELEVENLABS_API_KEY!,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: { 
                        stability: stability ?? 0.5, 
                        similarity_boost: similarity_boost ?? 0.75 
                    },
                }),
            });

            if (!resp.ok) {
              const errText = await resp.text();
              throw new Error(`ElevenLabs API error: ${resp.status} - ${errText}`);
            }

            const audioBuffer = await resp.arrayBuffer();
            const bytes = new Uint8Array(audioBuffer);
            const base64 = uint8ArrayToBase64(bytes);

            return new Response(JSON.stringify({ audioBase64: `data:audio/mpeg;base64,${base64}` }), { 
                headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } 
            });
        }

        // ROUTE: POST /settings
        if (req.method === "POST" && path === "settings") {
            const settings = await req.json();
            const { error } = await adminClient
                .from("user_voice_settings")
                .upsert({
                    user_id: user.uid,
                    ...settings,
                    updated_at: new Date().toISOString(),
                });

            if (error) throw error;

            return new Response(JSON.stringify({ ok: true }), { 
                headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } 
            });
        }

        return new Response(JSON.stringify({ error: "Path not found or method unsupported", path }), { 
            status: 404, 
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } 
        });

    } catch (err) {
        console.error("[voice-config-proxy] Exception:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500, 
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } 
        });
    }
});
