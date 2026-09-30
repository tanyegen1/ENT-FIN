import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose — keeps the app's build config
// untouched and lets this stay a plain Node test environment (the engine
// under test is pure logic with no DOM dependency).
export default defineConfig({
  test: {
    // supabase/functions/_shared/** holds the Massive provider adapter's
    // pure parsing/classification logic — plain TS with no Deno-only
    // globals, so it runs fine under this same Node test environment
    // without duplicating it into src/ just to make it testable.
    include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
    environment: "node",
  },
});
