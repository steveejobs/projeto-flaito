import { defineConfig } from "vitest/config";
import path from "node:path";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./supabase/functions/_shared"),
      // Mapeamento de imports HTTPS para Stubs locais (Runtime Harness)
      "https://deno.land/std@0.168.0/http/server.ts": path.resolve(__dirname, "./supabase/functions/tests/stubs/deno-std.ts"),
      "https://esm.sh/@supabase/supabase-js@2": path.resolve(__dirname, "./supabase/functions/tests/stubs/supabase-js.ts"),
      "https://esm.sh/@supabase/supabase-js@2.39.3": path.resolve(__dirname, "./supabase/functions/tests/stubs/supabase-js.ts"),
      "https://esm.sh/@supabase/supabase-js@2.49.1": path.resolve(__dirname, "./supabase/functions/tests/stubs/supabase-js.ts"),
      "jsr:@supabase/functions-js/edge-runtime.d.ts": path.resolve(__dirname, "./supabase/functions/tests/stubs/deno-std.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: [
      "src/**/*.test.{ts,tsx}",
      "supabase/functions/tests/**/*.test.ts"
    ],
  },
});
