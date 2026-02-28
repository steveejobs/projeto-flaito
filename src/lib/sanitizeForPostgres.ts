// src/lib/sanitizeForPostgres.ts

export function sanitizeForPostgresText(input: unknown): string {
  if (input === null || input === undefined) return "";
  let s = typeof input === "string" ? input : String(input);

  // Remove NUL (causa direta do Postgres 22P05)
  s = s.replace(/\u0000/g, "");

  // Remove controles C0/C1 (mantém \n)
  s = s.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");

  // Remove invisíveis/zero-width comuns em PDFs
  s = s.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, "");

  // Normaliza quebras
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Tabs -> espaço
  s = s.replace(/\t/g, " ");

  // Remove espaços à direita por linha (inclui NBSP)
  s = s.replace(/[ \u00A0]+$/gm, "");

  // Colapsa excesso de linhas vazias
  s = s.replace(/\n{4,}/g, "\n\n\n");

  return s.trim();
}

export function sanitizeJsonForPostgres<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") return sanitizeForPostgresText(obj) as unknown as T;

  if (Array.isArray(obj)) {
    return obj.map((v) => sanitizeJsonForPostgres(v)) as unknown as T;
  }

  if (typeof obj === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const [k, v] of Object.entries(obj as any)) {
      out[k] = sanitizeJsonForPostgres(v);
    }
    return out as T;
  }

  return obj;
}
