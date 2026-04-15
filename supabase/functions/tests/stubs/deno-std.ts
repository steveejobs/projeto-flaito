// supabase/functions/tests/stubs/deno-std.ts
import { vi } from 'vitest';

export let capturedHandler: ((req: Request) => Promise<Response>) | null = null;

export const serve = vi.fn((handler) => {
  capturedHandler = handler;
});

// Em Deno as functions usam Deno.serve
if (typeof (globalThis as any).Deno === 'undefined') {
  (globalThis as any).Deno = {
    serve: (handler: any) => {
      capturedHandler = handler;
    },
    env: {
      get: (key: string) => process.env[key] || '',
    }
  };
}
