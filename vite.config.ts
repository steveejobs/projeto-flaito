import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./supabase/functions/_shared"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["supabase/functions/tests/**/*.test.ts", "src/tests/**/*.test.ts"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./supabase/functions/_shared"),
      // Mantendo os stubs do Deno para as Edge Functions
      ...Object.fromEntries([
        [/^https:\/\/deno\.land\/std.*\/server\.ts$/, path.resolve(__dirname, "./supabase/functions/tests/stubs/deno-std.ts")],
        [/^https:\/\/esm\.sh\/@supabase\/supabase-js(@.*)?$/, path.resolve(__dirname, "./supabase/functions/tests/stubs/supabase-js.ts")],
        [/^jsr:@supabase\/functions-js\/edge-runtime\.d\.ts$/, path.resolve(__dirname, "./supabase/functions/tests/stubs/deno-std.ts")]
      ].map(([find, replacement]) => [find.toString(), replacement]))
    },
  },
}));
