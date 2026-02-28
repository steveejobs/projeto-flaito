export type LexosChatMode =
  | "chat"
  | "quick_preview"
  | "summarize"
  | "next_step"
  | "generate_draft"
  | "checklist";

export interface LexosChatAssistantPayload {
  mode: LexosChatMode;
  message: string;

  // aceita payloads mais ricos sem quebrar (thread_id, scope, case_id, route, context, etc.)
  [key: string]: unknown;
}

export function assertLexosChatPayload(p: unknown): asserts p is LexosChatAssistantPayload {
  if (!p || typeof p !== "object") {
    throw new Error("Payload inválido: objeto esperado");
  }

  const payload = p as Record<string, unknown>;

  const message = payload.message;
  if (typeof message !== "string" || !message.trim()) {
    throw new Error("Payload inválido: 'message' é obrigatório");
  }

  const mode = payload.mode;
  const validModes: LexosChatMode[] = [
    "chat",
    "quick_preview",
    "summarize",
    "next_step",
    "generate_draft",
    "checklist",
  ];
  if (typeof mode !== "string" || !validModes.includes(mode as LexosChatMode)) {
    throw new Error("Payload inválido: 'mode' inválido");
  }
}
